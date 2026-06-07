import math
from typing import Any

ranker: Any = None
is_sentence_transformer: bool = False


def init_ranker(model_name: str):
    """Initialize the reranker with either FlashRank or Sentence-Transformers."""
    global ranker, is_sentence_transformer
    print(f'[reranker] Initializing reranker with model: {model_name}')

    # Check if the model is natively supported in FlashRank's registry
    try:
        from flashrank.Ranker import model_file_map
        is_native_flashrank = model_name in model_file_map
    except Exception:
        is_native_flashrank = False

    if is_native_flashrank:
        from flashrank import Ranker
        ranker = Ranker(model_name=model_name, cache_dir="/app/flashrank_cache")
        is_sentence_transformer = False
        print('[reranker] FlashRank engine initialized.')
    else:
        # Fallback to Sentence-Transformers for custom Hugging Face models
        try:
            from sentence_transformers import CrossEncoder
            ranker = CrossEncoder(model_name)
            is_sentence_transformer = True
            print('[reranker] Sentence-Transformers engine initialized.')
        except ImportError:
            raise ImportError(
                f"Model '{model_name}' requires sentence-transformers. "
                "Please make sure 'sentence-transformers' is installed in requirements.txt."
            )


def rerank(query: str, passages: list[dict], top_n: int = 10) -> list[dict]:
    """Rerank passages for the given query using the active engine."""
    if ranker is None:
        raise RuntimeError('Ranker not initialized. Call init_ranker() first.')

    if not is_sentence_transformer:
        # FlashRank reranker (ONNX)
        from flashrank import RerankRequest
        rerank_request = RerankRequest(query=query, passages=passages)
        results = ranker.rerank(rerank_request)
        return results[:top_n]
    else:
        # Sentence-Transformers cross-encoder (PyTorch)
        pairs = [(query, p['text']) for p in passages]
        scores = ranker.predict(pairs)

        # Attach normalized scores (using sigmoid function for logits)
        for p, score in zip(passages, scores):
            try:
                score_val = 1 / (1 + math.exp(-float(score)))
            except Exception:
                score_val = float(score)
            
            # FlashRank stores the score inside 'score' key, we match it
            p['score'] = score_val

        # Sort descending by score
        passages.sort(key=lambda x: x['score'], reverse=True)
        return passages[:top_n]

