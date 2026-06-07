"""
Automatic Database Migration Runner

Runs on every app startup. Tracks applied migrations in a `_migrations` table.
Migration files live in `migrations/` as numbered .sql files.

Supports dialect-specific migrations:
  001_initial.sql          → runs on ALL dialects
  002_vectors.mariadb.sql  → runs ONLY on MariaDB
  002_vectors.heatwave.sql → runs ONLY on HeatWave
"""

import os

from backend.database import get_connection, wait_for_database
from backend.config import DB_DIALECT

is_mariadb: bool = DB_DIALECT == 'mariadb'

MIGRATIONS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'migrations')


def clean_sql_comments(sql: str) -> str:
    """Strip single-line SQL comments (-- and #) from a SQL string."""
    lines: list[str] = []
    for line in sql.split('\n'):
        stripped = line.strip()
        if stripped.startswith('--') or stripped.startswith('#'):
            lines.append('')
        else:
            lines.append(line)
    return '\n'.join(lines).strip()


def get_migration_dialect(filename: str) -> str:
    """Determine the dialect a migration file targets based on its filename suffix."""
    if filename.endswith('.mariadb.sql'):
        return 'mariadb'
    if filename.endswith('.heatwave.sql'):
        return 'heatwave'
    return 'all'


def should_run(filename: str) -> bool:
    """Check whether a migration file should be executed for the current dialect."""
    dialect = get_migration_dialect(filename)
    if dialect == 'all':
        return True
    if dialect == 'mariadb':
        return is_mariadb
    if dialect == 'heatwave':
        return not is_mariadb
    return False


def canonical_name(filename: str) -> str:
    """Normalize dialect-specific filenames to a canonical migration name."""
    return filename.replace('.mariadb.sql', '.sql').replace('.heatwave.sql', '.sql')


def ensure_tables_consistency():
    """Reset migration tracking if the main table was dropped externally."""
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT 1 FROM vector_documentos LIMIT 1')
            cursor.fetchall()
            cursor.close()
    except Exception as e:
        err_msg = str(e).lower()
        if "doesn't exist" in err_msg or 'does not exist' in err_msg or '1146' in str(e):
            print('[migrate] Table vector_documentos does not exist. Resetting migration tracking.')
            try:
                with get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute('DELETE FROM _migrations')
                    cursor.close()
            except Exception:
                pass


def run_migrations():
    """Discover and apply pending SQL migrations in order."""
    wait_for_database()

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS _migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cursor.close()

    ensure_tables_consistency()

    # Get applied migrations
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT name FROM _migrations ORDER BY id')
        applied = set(row[0] for row in cursor.fetchall())
        cursor.close()

    # Read migration files
    if not os.path.isdir(MIGRATIONS_DIR):
        print('[migrate] No migrations directory found, skipping.')
        return

    sql_files = sorted(f for f in os.listdir(MIGRATIONS_DIR) if f.endswith('.sql'))
    count = 0

    for filename in sql_files:
        canon = canonical_name(filename)
        if canon in applied:
            continue
        if not should_run(filename):
            continue

        filepath = os.path.join(MIGRATIONS_DIR, filename)
        with open(filepath, 'r') as f:
            sql = f.read()

        print(f'[migrate] Applying: {filename}')

        statements = [
            clean_sql_comments(s) for s in sql.split(';') if clean_sql_comments(s)
        ]

        with get_connection() as conn:
            cursor = conn.cursor()
            for stmt in statements:
                cursor.execute(stmt)
            cursor.execute('INSERT INTO _migrations (name) VALUES (%s)', (canon,))
            cursor.close()

        count += 1

    if count > 0:
        print(f'[migrate] ✅ {count} migration(s) applied.')
    else:
        print('[migrate] Database is up to date.')
