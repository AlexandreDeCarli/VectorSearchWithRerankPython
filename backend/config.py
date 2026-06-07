import os
from dotenv import load_dotenv

load_dotenv()

PORT = int(os.getenv('PORT', '3000'))
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_USER = os.getenv('DB_USER', 'root')
DB_PASS = os.getenv('DB_PASS', 'root')
DB_NAME = os.getenv('DB_NAME', 'meu_vector_db')
DB_PORT = int(os.getenv('DB_PORT', '3306'))
DB_DIALECT = os.getenv('DB_DIALECT', 'mariadb').lower()

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-embedding-2')

APP_USERNAME = os.getenv('APP_USERNAME', 'admin')
APP_PASSWORD = os.getenv('APP_PASSWORD', '')
JWT_SECRET = os.getenv('JWT_SECRET', 'local_jwt_secret')

RERANK_MODEL = os.getenv('RERANK_MODEL', 'unicamp-dl/monoptt5-base')
RERANK_TOP_K = int(os.getenv('RERANK_TOP_K', '20'))
