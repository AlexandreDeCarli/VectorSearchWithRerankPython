import mysql.connector
from mysql.connector import pooling
from contextlib import contextmanager
from backend.config import DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT
import time

pool = None


def init_pool():
    global pool
    pool = pooling.MySQLConnectionPool(
        pool_name='app_pool',
        pool_size=10,
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASS,
        database=DB_NAME,
        port=DB_PORT,
        autocommit=True,
    )


@contextmanager
def get_connection():
    conn = pool.get_connection()
    try:
        yield conn
    finally:
        conn.close()


def wait_for_database(retries: int = 15, delay: float = 2.0):
    for i in range(1, retries + 1):
        try:
            print(f'[db] Connecting to database (attempt {i}/{retries})...')
            conn = mysql.connector.connect(
                host=DB_HOST,
                user=DB_USER,
                password=DB_PASS,
                database=DB_NAME,
                port=DB_PORT,
            )
            conn.close()
            print('[db] Database connection established.')
            return
        except Exception as e:
            print(f'[db] Connection attempt {i} failed: {e}')
            if i == retries:
                raise Exception(
                    f'Could not connect to database after {retries} attempts.'
                )
            time.sleep(delay)
