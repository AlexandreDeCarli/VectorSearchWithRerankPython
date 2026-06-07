"""Vector search route with two-stage retrieval: vector recall + FlashRank reranking."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Literal
from backend.auth import get_current_user
from backend.database import get_connection
from backend.gemini_client import get_embedding
from backend.sql_dialect import get_vector_search_sql
from backend.reranker import rerank
from backend.config import RERANK_TOP_K
import json

router = APIRouter(prefix='/api', tags=['search'])


# ---------------------------------------------------------------------------
# Request model
# ---------------------------------------------------------------------------

class SearchBody(BaseModel):
    query: str
    metric: Optional[Literal['COSINE', 'DOT', 'EUCLIDEAN']] = 'COSINE'


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _row_to_dict(cursor, row):
    """Convert a raw DB row to a dict using cursor.description."""
    columns = [col[0] for col in cursor.description]
    return dict(zip(columns, row))


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.post('/search')
async def search(body: SearchBody, _user=Depends(get_current_user)):
    """
    Two-stage search pipeline:
      1. Vector recall  – fetch top-K candidates by vector similarity.
      2. FlashRank rerank – re-score candidates with a cross-encoder model.
    """
    with get_connection() as conn:
        try:
            # --- Generate query embedding ---
            embedding = get_embedding(body.query)
            embedding_string = '[' + ','.join(str(v) for v in embedding) + ']'

            # --- SQL fragments for the chosen metric ---
            score_sql, order_sql = get_vector_search_sql(body.metric)

            # --- Stage 1: Vector recall (top-K from database) ---
            sql = (
                f'SELECT id, titulo, conteudo, {score_sql} AS similarity '
                f'FROM vector_documentos '
                f'ORDER BY {order_sql} '
                f'LIMIT {int(RERANK_TOP_K)}'
            )
            cursor = conn.cursor()
            cursor.execute(sql, (embedding_string,))
            raw_rows = cursor.fetchall()

            if not raw_rows:
                return []

            rows = [_row_to_dict(cursor, r) for r in raw_rows]

            # --- Stage 2: FlashRank reranking ---
            passages = [
                {
                    'id': str(r['id']),
                    'text': r['conteudo'],
                    'meta': {
                        'id': r['id'],
                        'titulo': r['titulo'],
                        'conteudo': r['conteudo'],
                        'similarity': float(r['similarity']),
                    },
                }
                for r in rows
            ]

            reranked = rerank(query=body.query, passages=passages, top_n=10)

            # --- Build response ---
            results = [
                {
                    'id': item['meta']['id'],
                    'titulo': item['meta']['titulo'],
                    'conteudo': item['meta']['conteudo'],
                    'similarity': item['meta']['similarity'],
                    'rerank_score': item['score'],
                }
                for item in reranked
            ]

            return results

        except Exception as exc:
            print(f'[Error] POST /api/search failed: {exc}')
            raise HTTPException(
                status_code=500,
                detail=f'Erro na busca por vetor: {exc}',
            )
