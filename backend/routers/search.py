"""Vector search route with two-stage retrieval: vector recall + FlashRank reranking."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Literal
from backend.auth import get_current_user
from backend.database import get_connection
from backend.gemini_client import get_embedding
from backend.sql_dialect import get_vector_search_sql
from backend.reranker import rerank, init_ranker
from backend.config import RERANK_TOP_K, RERANK_MODEL
import json

router = APIRouter(prefix='/api', tags=['search'])


# ---------------------------------------------------------------------------
# Request model
# ---------------------------------------------------------------------------

class SearchBody(BaseModel):
    query: str
    metric: Optional[Literal['COSINE', 'DOT', 'EUCLIDEAN']] = 'COSINE'
    model: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _row_to_dict(cursor, row):
    """Convert a raw DB row to a dict using cursor.description."""
    columns = [col[0] for col in cursor.description]
    return dict(zip(columns, row))


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get('/search/models')
async def get_search_models(_user=Depends(get_current_user)):
    """Return list of available rerank models, highlighting the default one."""
    models = [
        {
            "id": "unicamp-dl/monoptt5-base",
            "name": "unicamp-dl/monoptt5-base",
            "language": "Português",
            "type": "T5 Seq2Seq (PyTorch)",
            "description": "Altíssimo desempenho para buscas em português. Padrão para língua portuguesa.",
            "is_default": "unicamp-dl/monoptt5-base" == RERANK_MODEL
        },
        {
            "id": "nreimers/mmarco-mMiniLMv2-L12-H384-v1",
            "name": "mmarco-mMiniLMv2-L12-H384-v1",
            "language": "Multilíngue",
            "type": "Cross-Encoder (PyTorch)",
            "description": "Excelente reranker multilíngue de tamanho moderado.",
            "is_default": "nreimers/mmarco-mMiniLMv2-L12-H384-v1" == RERANK_MODEL
        },
        {
            "id": "ms-marco-MiniLM-L-12-v2",
            "name": "ms-marco-MiniLM-L-12-v2",
            "language": "Inglês",
            "type": "FlashRank (ONNX)",
            "description": "Altíssima velocidade e baixíssimo consumo de memória, otimizado para inglês.",
            "is_default": "ms-marco-MiniLM-L-12-v2" == RERANK_MODEL
        },
        {
            "id": "ms-marco-MultiBERT-L-12",
            "name": "ms-marco-MultiBERT-L-12",
            "language": "Multilíngue",
            "type": "FlashRank (ONNX)",
            "description": "Modelo multilíngue rápido baseado em ONNX runtime.",
            "is_default": "ms-marco-MultiBERT-L-12" == RERANK_MODEL
        },
        {
            "id": "BAAI/bge-reranker-v2-m3",
            "name": "BAAI/bge-reranker-v2-m3",
            "language": "Multilíngue",
            "type": "Cross-Encoder (PyTorch)",
            "description": "Precisão de estado da arte para buscas multilíngues, mas requer GPU/RAM robusta.",
            "is_default": "BAAI/bge-reranker-v2-m3" == RERANK_MODEL
        }
    ]

    # If the default model is not in the list, insert it dynamically
    known_ids = {m["id"] for m in models}
    if RERANK_MODEL not in known_ids:
        models.insert(0, {
            "id": RERANK_MODEL,
            "name": RERANK_MODEL,
            "language": "Configurado (.env)",
            "type": "Customizado",
            "description": "Modelo customizado configurado via variáveis de ambiente.",
            "is_default": True
        })

    return models


@router.post('/search')
async def search(body: SearchBody, _user=Depends(get_current_user)):
    """
    Two-stage search pipeline returning comparative results:
      - original: Top 10 results directly from vector database recall.
      - reranked: Top 10 results after applying the selected Cross-Encoder reranker.
    """
    with get_connection() as conn:
        try:
            # --- Initialize/switch model dynamically ---
            chosen_model = body.model or RERANK_MODEL
            init_ranker(chosen_model)

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
                return {
                    "original": [],
                    "reranked": []
                }

            rows = [_row_to_dict(cursor, r) for r in raw_rows]

            # --- Extract top 10 original recall results ---
            original_results = [
                {
                    'id': r['id'],
                    'titulo': r['titulo'],
                    'conteudo': r['conteudo'],
                    'similarity': float(r['similarity']),
                }
                for r in rows[:10]
            ]

            # --- Stage 2: Reranking ---
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

            # --- Build reranked results ---
            reranked_results = [
                {
                    'id': item['meta']['id'],
                    'titulo': item['meta']['titulo'],
                    'conteudo': item['meta']['conteudo'],
                    'similarity': item['meta']['similarity'],
                    'rerank_score': item['score'],
                }
                for item in reranked
            ]

            return {
                "original": original_results,
                "reranked": reranked_results
            }

        except Exception as exc:
            print(f'[Error] POST /api/search failed: {exc}')
            raise HTTPException(
                status_code=500,
                detail=f'Erro na busca por vetor: {exc}',
            )

