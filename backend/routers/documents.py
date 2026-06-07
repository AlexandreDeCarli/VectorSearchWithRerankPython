"""Document CRUD routes — 1:1 port of the Elysia.js document endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from backend.auth import get_current_user
from backend.database import get_connection
from backend.gemini_client import get_embedding
from backend.sql_dialect import SQL_STRING_TO_VECTOR, SQL_VECTOR_TO_STRING
import base64
import json

router = APIRouter(prefix='/api/documents', tags=['documents'])


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class DocumentCreateBody(BaseModel):
    titulo: str
    conteudo: str


class DocumentImportBody(BaseModel):
    titulo: str
    conteudoBase64: str


class DocumentUpdateBody(BaseModel):
    titulo: str
    conteudo: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _row_to_dict(cursor, row):
    """Convert a raw DB row to a dict using cursor.description."""
    columns = [col[0] for col in cursor.description]
    return dict(zip(columns, row))


def _serialise_datetime(val):
    """Return an ISO-8601 string for datetime objects, passthrough otherwise."""
    if val is None:
        return val
    if hasattr(val, 'isoformat'):
        return val.isoformat()
    return str(val)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get('')
async def list_documents(_user=Depends(get_current_user)):
    """List all documents (metadata only: id, titulo, created_at, updated_at)."""
    with get_connection() as conn:
        try:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT id, titulo, created_at, updated_at '
                'FROM vector_documentos ORDER BY created_at DESC'
            )
            rows = cursor.fetchall()
            documents = []
            for row in rows:
                d = _row_to_dict(cursor, row)
                d['created_at'] = _serialise_datetime(d.get('created_at'))
                d['updated_at'] = _serialise_datetime(d.get('updated_at'))
                documents.append(d)
            return documents
        except Exception as exc:
            print(f'[Error] GET /api/documents failed: {exc}')
            raise HTTPException(status_code=500, detail=str(exc))


@router.get('/{doc_id}')
async def get_document(doc_id: int, _user=Depends(get_current_user)):
    """Get a single document including content."""
    with get_connection() as conn:
        try:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT id, titulo, conteudo, created_at, updated_at '
                'FROM vector_documentos WHERE id = %s',
                (doc_id,),
            )
            row = cursor.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail='Documento não encontrado')
            d = _row_to_dict(cursor, row)
            d['created_at'] = _serialise_datetime(d.get('created_at'))
            d['updated_at'] = _serialise_datetime(d.get('updated_at'))
            return d
        except HTTPException:
            raise
        except Exception as exc:
            print(f'[Error] GET /api/documents/{doc_id} failed: {exc}')
            raise HTTPException(status_code=500, detail=str(exc))


@router.post('')
async def create_document(body: DocumentCreateBody, _user=Depends(get_current_user)):
    """Create a new document with an embedding generated from its content."""
    with get_connection() as conn:
        try:
            embedding = get_embedding(body.conteudo)
            embedding_string = json.dumps(embedding)

            cursor = conn.cursor()
            cursor.execute(
                f'INSERT INTO vector_documentos (titulo, conteudo, embedding) '
                f'VALUES (%s, %s, {SQL_STRING_TO_VECTOR})',
                (body.titulo, body.conteudo, embedding_string),
            )
            new_id = cursor.lastrowid
            return {'id': new_id, 'titulo': body.titulo, 'success': True}
        except Exception as exc:
            print(f'[Error] POST /api/documents failed: {exc}')
            raise HTTPException(
                status_code=500,
                detail=f'Erro ao gerar embedding ou salvar banco: {exc}',
            )


@router.post('/import')
async def import_document(body: DocumentImportBody, _user=Depends(get_current_user)):
    """Import a document from base64-encoded content with duplicate detection."""
    with get_connection() as conn:
        try:
            # Decode base64 → UTF-8 text
            try:
                decoded_bytes = base64.b64decode(body.conteudoBase64)
                conteudo = decoded_bytes.decode('utf-8')
            except Exception:
                raise HTTPException(status_code=400, detail='Conteúdo base64 inválido')

            cursor = conn.cursor()

            # Check if a document with the same title already exists
            cursor.execute(
                'SELECT id, conteudo FROM vector_documentos WHERE titulo = %s',
                (body.titulo,),
            )
            existing = cursor.fetchone()

            if existing is None:
                # --- CREATE ---
                embedding = get_embedding(conteudo)
                embedding_string = json.dumps(embedding)
                cursor.execute(
                    f'INSERT INTO vector_documentos (titulo, conteudo, embedding) '
                    f'VALUES (%s, %s, {SQL_STRING_TO_VECTOR})',
                    (body.titulo, conteudo, embedding_string),
                )
                new_id = cursor.lastrowid
                return {'success': True, 'action': 'created', 'id': new_id}

            existing_dict = _row_to_dict(cursor, existing)
            existing_id = existing_dict['id']
            existing_conteudo = existing_dict['conteudo']

            if existing_conteudo != conteudo:
                # --- UPDATE ---
                embedding = get_embedding(conteudo)
                embedding_string = json.dumps(embedding)
                cursor.execute(
                    f'UPDATE vector_documentos '
                    f'SET titulo = %s, conteudo = %s, embedding = {SQL_STRING_TO_VECTOR}, '
                    f'updated_at = CURRENT_TIMESTAMP WHERE id = %s',
                    (body.titulo, conteudo, embedding_string, existing_id),
                )
                return {'success': True, 'action': 'updated', 'id': existing_id}

            # --- SKIP ---
            return {'success': True, 'action': 'skipped', 'id': existing_id}

        except HTTPException:
            raise
        except Exception as exc:
            print(f'[Error] POST /api/documents/import failed: {exc}')
            raise HTTPException(
                status_code=500,
                detail=f'Erro ao importar documento: {exc}',
            )


@router.put('/{doc_id}')
async def update_document(
    doc_id: int,
    body: DocumentUpdateBody,
    _user=Depends(get_current_user),
):
    """Update an existing document. Regenerates embedding only if content changed."""
    with get_connection() as conn:
        try:
            cursor = conn.cursor()

            # Fetch existing document
            cursor.execute(
                'SELECT id, conteudo FROM vector_documentos WHERE id = %s',
                (doc_id,),
            )
            row = cursor.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail='Documento não encontrado')

            existing = _row_to_dict(cursor, row)

            if existing['conteudo'] != body.conteudo:
                # Content changed → regenerate embedding
                embedding = get_embedding(body.conteudo)
                embedding_string = json.dumps(embedding)
            else:
                # Content unchanged → keep existing embedding
                cursor.execute(
                    f'SELECT {SQL_VECTOR_TO_STRING} AS emb FROM vector_documentos WHERE id = %s',
                    (doc_id,),
                )
                emb_row = cursor.fetchone()
                emb_dict = _row_to_dict(cursor, emb_row)
                embedding_string = emb_dict['emb']

            cursor.execute(
                f'UPDATE vector_documentos '
                f'SET titulo = %s, conteudo = %s, embedding = {SQL_STRING_TO_VECTOR} '
                f'WHERE id = %s',
                (body.titulo, body.conteudo, embedding_string, doc_id),
            )

            return {'id': doc_id, 'titulo': body.titulo, 'success': True}

        except HTTPException:
            raise
        except Exception as exc:
            print(f'[Error] PUT /api/documents/{doc_id} failed: {exc}')
            raise HTTPException(
                status_code=500,
                detail=f'Erro ao atualizar documento: {exc}',
            )


@router.delete('')
async def delete_all_documents(_user=Depends(get_current_user)):
    """Delete ALL documents."""
    with get_connection() as conn:
        try:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM vector_documentos')
            return {'success': True}
        except Exception as exc:
            print(f'[Error] DELETE /api/documents failed: {exc}')
            raise HTTPException(status_code=500, detail=str(exc))


@router.delete('/{doc_id}')
async def delete_document(doc_id: int, _user=Depends(get_current_user)):
    """Delete a single document by ID."""
    with get_connection() as conn:
        try:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT id FROM vector_documentos WHERE id = %s',
                (doc_id,),
            )
            if cursor.fetchone() is None:
                raise HTTPException(status_code=404, detail='Documento não encontrado')

            cursor.execute(
                'DELETE FROM vector_documentos WHERE id = %s',
                (doc_id,),
            )
            return {'success': True}
        except HTTPException:
            raise
        except Exception as exc:
            print(f'[Error] DELETE /api/documents/{doc_id} failed: {exc}')
            raise HTTPException(status_code=500, detail=str(exc))
