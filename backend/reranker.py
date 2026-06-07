"""FlashRank integration for cross-encoder reranking."""

from flashrank import Ranker, RerankRequest

ranker: Ranker | None = None


def init_ranker(model_name: str):
    """Initialize the FlashRank reranker with the specified model."""
    global ranker
    print(f'[reranker] Initializing FlashRank with model: {model_name}')
    ranker = Ranker(model_name=model_name)
    print('[reranker] FlashRank initialized successfully.')


def rerank(query: str, passages: list[dict], top_n: int = 10) -> list[dict]:
    """Rerank passages for the given query and return the top N results."""
    if ranker is None:
        raise RuntimeError('Ranker not initialized. Call init_ranker() first.')
    rerank_request = RerankRequest(query=query, passages=passages)
    results = ranker.rerank(rerank_request)
    return results[:top_n]
