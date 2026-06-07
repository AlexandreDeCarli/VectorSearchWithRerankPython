"""
SQL Dialect Abstraction Layer

Centralizes all database-specific SQL function syntax to support:
- MariaDB 11.7+ (local development & testing)
- MySQL HeatWave (OCI production)

Controlled by the DB_DIALECT environment variable:
- 'mariadb'  (default) → uses VEC_FromText, VEC_DISTANCE_COSINE, VEC_ToText
- 'heatwave'           → uses STRING_TO_VECTOR, DISTANCE(..., 'COSINE'), VECTOR_TO_STRING
"""

from backend.config import DB_DIALECT

is_mariadb: bool = DB_DIALECT == 'mariadb'
is_heatwave: bool = DB_DIALECT == 'heatwave'

SQL_STRING_TO_VECTOR: str = 'VEC_FromText(%s)' if is_mariadb else 'STRING_TO_VECTOR(%s)'
SQL_VECTOR_TO_STRING: str = 'VEC_ToText(embedding)' if is_mariadb else 'VECTOR_TO_STRING(embedding)'
SQL_COSINE_SIMILARITY: str = (
    '(1 - VEC_DISTANCE_COSINE(embedding, VEC_FromText(%s)))'
    if is_mariadb
    else "(1 - DISTANCE(embedding, STRING_TO_VECTOR(%s), 'COSINE'))"
)


def get_vector_search_sql(metric: str = 'COSINE') -> tuple[str, str]:
    """Return a (similarity_expression, order_clause) tuple for the given metric."""
    if is_mariadb:
        if metric == 'COSINE':
            return ('(1 - VEC_DISTANCE_COSINE(embedding, VEC_FromText(%s)))', 'similarity DESC')
        elif metric == 'EUCLIDEAN':
            return ('VEC_DISTANCE_EUCLIDEAN(embedding, VEC_FromText(%s))', 'similarity ASC')
        elif metric == 'DOT':
            return ('VEC_DISTANCE(embedding, VEC_FromText(%s))', 'similarity ASC')
    else:
        if metric == 'COSINE':
            return ("(1 - DISTANCE(embedding, STRING_TO_VECTOR(%s), 'COSINE'))", 'similarity DESC')
        elif metric == 'EUCLIDEAN':
            return ("DISTANCE(embedding, STRING_TO_VECTOR(%s), 'EUCLIDEAN')", 'similarity ASC')
        elif metric == 'DOT':
            return ("DISTANCE(embedding, STRING_TO_VECTOR(%s), 'DOT')", 'similarity DESC')

    # Default fallback
    return ('(1 - VEC_DISTANCE_COSINE(embedding, VEC_FromText(%s)))', 'similarity DESC')
