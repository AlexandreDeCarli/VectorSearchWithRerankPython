import pytest
from unittest.mock import patch, MagicMock

def test_routes_require_authentication(test_client):
    """Verify that search routes return 401 Unauthorized without auth headers."""
    # 1. GET /api/search/models
    res_models = test_client.get('/api/search/models')
    assert res_models.status_code == 401

    # 2. POST /api/search
    res_search = test_client.post('/api/search', json={'query': 'test'})
    assert res_search.status_code == 401

def test_get_search_models(test_client, auth_headers):
    """Verify GET /api/search/models returns configured models and highlights default."""
    res = test_client.get('/api/search/models', headers=auth_headers)
    assert res.status_code == 200
    
    models = res.json()
    assert isinstance(models, list)
    assert len(models) >= 1
    
    # Assert model keys structure
    for m in models:
        assert 'id' in m
        assert 'name' in m
        assert 'language' in m
        assert 'type' in m
        assert 'description' in m
        assert 'is_default' in m
        
    # Verify exactly one model is marked default (matching environment setting: ms-marco-MiniLM-L-12-v2)
    defaults = [m for m in models if m['is_default']]
    assert len(defaults) == 1
    assert defaults[0]['id'] == 'ms-marco-MiniLM-L-12-v2'

@patch('backend.routers.search.get_embedding')
@patch('backend.routers.search.rerank')
@patch('backend.routers.search.init_ranker')
def test_post_search_success(mock_init_ranker, mock_rerank, mock_get_embedding, test_client, auth_headers):
    """Verify POST /api/search returns comparative original and reranked results."""
    # 1. Mock embedding generator
    mock_get_embedding.return_value = [0.1] * 768
    
    # 2. Mock database recall execution
    mock_db_recall_rows = [
        (1, 'titulo_1.txt', 'conteudo do documento 1', 0.85),
        (2, 'titulo_2.txt', 'conteudo do documento 2', 0.72)
    ]
    # Retrieve the mocked cursor from the database connection mock
    from backend.database import get_connection
    mock_conn = get_connection()
    mock_cursor = mock_conn.cursor()
    mock_cursor.fetchall.return_value = mock_db_recall_rows
    mock_cursor.description = [('id',), ('titulo',), ('conteudo',), ('similarity',)]
    
    # 3. Mock Reranker output
    mock_reranked_output = [
        {
            'id': '2',
            'text': 'conteudo do documento 2',
            'score': 0.96,
            'meta': {
                'id': 2,
                'titulo': 'titulo_2.txt',
                'conteudo': 'conteudo do documento 2',
                'similarity': 0.72
            }
        },
        {
            'id': '1',
            'text': 'conteudo do documento 1',
            'score': 0.44,
            'meta': {
                'id': 1,
                'titulo': 'titulo_1.txt',
                'conteudo': 'conteudo do documento 1',
                'similarity': 0.85
            }
        }
    ]
    mock_rerank.return_value = mock_reranked_output
    
    # 4. Trigger search request with custom model
    search_payload = {
        'query': 'busca teste',
        'metric': 'COSINE',
        'model': 'unicamp-dl/monoptt5-base'
    }
    
    res = test_client.post('/api/search', json=search_payload, headers=auth_headers)
    
    assert res.status_code == 200
    data = res.json()
    
    # Verify model initialization was switched
    mock_init_ranker.assert_called_once_with('unicamp-dl/monoptt5-base')
    
    # Verify response layout structure
    assert 'original' in data
    assert 'reranked' in data
    
    # Assert Original (database recall ordered by similarity: doc 1, then doc 2)
    original = data['original']
    assert len(original) == 2
    assert original[0]['id'] == 1
    assert original[0]['titulo'] == 'titulo_1.txt'
    assert original[0]['similarity'] == 0.85
    assert 'rerank_score' not in original[0]
    
    assert original[1]['id'] == 2
    assert original[1]['titulo'] == 'titulo_2.txt'
    assert original[1]['similarity'] == 0.72
    
    # Assert Reranked (cross-encoder re-sorted: doc 2 (score 0.96), then doc 1 (score 0.44))
    reranked = data['reranked']
    assert len(reranked) == 2
    assert reranked[0]['id'] == 2
    assert reranked[0]['titulo'] == 'titulo_2.txt'
    assert reranked[0]['similarity'] == 0.72
    assert reranked[0]['rerank_score'] == 0.96
    
    assert reranked[1]['id'] == 1
    assert reranked[1]['titulo'] == 'titulo_1.txt'
    assert reranked[1]['similarity'] == 0.85
    assert reranked[1]['rerank_score'] == 0.44

@patch('backend.routers.search.get_embedding')
@patch('backend.routers.search.init_ranker')
def test_post_search_empty_database(mock_init_ranker, mock_get_embedding, test_client, auth_headers):
    """Verify search returns empty comparison lists if database yields no candidates."""
    mock_get_embedding.return_value = [0.1] * 768
    
    from backend.database import get_connection
    mock_conn = get_connection()
    mock_cursor = mock_conn.cursor()
    mock_cursor.fetchall.return_value = [] # DB returns empty recall list
    
    res = test_client.post('/api/search', json={'query': 'termo'}, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    
    assert data == {'original': [], 'reranked': []}
