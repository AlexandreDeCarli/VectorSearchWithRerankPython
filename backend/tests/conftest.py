import os
import sys
from unittest.mock import MagicMock

# 1. Setup mock environment variables before backend loading
os.environ['JWT_SECRET'] = 'test_jwt_secret_key_123!'
os.environ['GEMINI_API_KEY'] = 'test_gemini_api_key'
os.environ['APP_USERNAME'] = 'admin'
os.environ['APP_PASSWORD'] = 'admin_password'
os.environ['DB_HOST'] = 'localhost'
os.environ['DB_USER'] = 'root'
os.environ['DB_PASS'] = 'root'
os.environ['DB_NAME'] = 'meu_vector_db'
os.environ['DB_PORT'] = '3306'
os.environ['DB_DIALECT'] = 'mariadb'
os.environ['RERANK_MODEL'] = 'ms-marco-MiniLM-L-12-v2'
os.environ['RERANK_TOP_K'] = '50'

# 2. Mock heavy ML libraries to keep tests offline and fast
mock_transformers = MagicMock()
mock_transformers.AutoTokenizer = MagicMock()
mock_transformers.AutoModelForSeq2SeqLM = MagicMock()
sys.modules['transformers'] = mock_transformers

mock_sentence_transformers = MagicMock()
mock_sentence_transformers.CrossEncoder = MagicMock()
sys.modules['sentence_transformers'] = mock_sentence_transformers

mock_flashrank = MagicMock()
mock_flashrank_ranker_module = MagicMock()
# Model registry map
mock_flashrank_ranker_module.model_file_map = {
    'ms-marco-MiniLM-L-12-v2': {},
    'ms-marco-MultiBERT-L-12': {}
}
sys.modules['flashrank'] = mock_flashrank
sys.modules['flashrank.Ranker'] = mock_flashrank_ranker_module

# 3. Mock database connection lifecycle and migrations
import backend.database as db
db.wait_for_database = MagicMock()
db.init_pool = MagicMock()

import backend.migrate as migrate
migrate.run_migrations = MagicMock()

# Global cursor and connection mocks
mock_conn = MagicMock()
mock_cursor = MagicMock()
mock_conn.__enter__.return_value = mock_conn
mock_conn.cursor.return_value = mock_cursor
db.get_connection = MagicMock(return_value=mock_conn)

import pytest
from fastapi.testclient import TestClient

@pytest.fixture(autouse=True)
def reset_mocks():
    """Reset all mocked call histories before each test."""
    db.wait_for_database.reset_mock()
    db.init_pool.reset_mock()
    migrate.run_migrations.reset_mock()
    mock_conn.reset_mock()
    mock_cursor.reset_mock()

@pytest.fixture
def test_client():
    """FastAPI TestClient fixture."""
    from backend.main import app
    with TestClient(app) as client:
        yield client

@pytest.fixture
def auth_headers():
    """Helper fixture to get administrative auth headers."""
    from jose import jwt
    from datetime import datetime, timedelta
    
    payload = {
        'sub': 'admin',
        'exp': datetime.utcnow() + timedelta(hours=1)
    }
    token = jwt.encode(payload, os.environ['JWT_SECRET'], algorithm='HS256')
    return {'Authorization': f'Bearer {token}'}
