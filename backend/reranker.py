import math
from typing import Any

ranker: Any = None
tokenizer: Any = None
is_sentence_transformer: bool = False
is_t5: bool = False
true_token_id: int = 0
false_token_id: int = 0


def init_ranker(model_name: str):
    """Initialize the reranker with either FlashRank, Sentence-Transformers, or Seq2Seq T5."""
    global ranker, tokenizer, is_sentence_transformer, is_t5, true_token_id, false_token_id
    print(f'[reranker] Initializing reranker with model: {model_name}')

    # Check if this is a T5 Seq2Seq model
    if 't5' in model_name.lower():
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        import torch

        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[reranker] Loading T5 model on device: {device}")
        
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        ranker = AutoModelForSeq2SeqLM.from_pretrained(model_name).to(device)
        is_t5 = True
        is_sentence_transformer = False

        # Dynamically discover target tokens (Sim/Não for Portuguese, true/false for English, yes/no)
        for token in [" Sim", " true", " yes"]:
            ids = tokenizer.encode(token, add_special_tokens=False)
            if ids:
                true_token_id = ids[0]
                break
        for token in [" Não", " false", " no"]:
            ids = tokenizer.encode(token, add_special_tokens=False)
            if ids:
                false_token_id = ids[0]
                break
        print(f"[reranker] T5 Engine initialized. Target tokens - True: {true_token_id}, False: {false_token_id}")
        return

    # Check if the model is natively supported in FlashRank's registry
    try:
        from flashrank.Ranker import model_file_map
        is_native_flashrank = model_name in model_file_map
    except Exception:
        is_native_flashrank = False

    if is_native_flashrank:
        from flashrank import Ranker
        ranker = Ranker(model_name=model_name, cache_dir="/app/flashrank_cache")
        is_t5 = False
        is_sentence_transformer = False
        print('[reranker] FlashRank engine initialized.')
    else:
        # Fallback to Sentence-Transformers for custom Hugging Face classification models
        try:
            from sentence_transformers import CrossEncoder
            ranker = CrossEncoder(model_name)
            is_t5 = False
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

    if is_t5:
        # T5 Seq2Seq model (generative logits matching Sim/Não)
        import torch
        import torch.nn.functional as F

        device = next(ranker.parameters()).device
        texts = [f"Query: {query} Document: {p['text']} Relevant:" for p in passages]
        
        # Tokenize batch
        inputs = tokenizer(texts, padding=True, truncation=True, max_length=512, return_tensors="pt")
        inputs = {k: v.to(device) for k, v in inputs.items()}

        # Generate output starting with pad token (0)
        decoder_input_ids = torch.zeros((len(passages), 1), dtype=torch.long, device=device)

        with torch.no_grad():
            outputs = ranker(
                input_ids=inputs["input_ids"],
                attention_mask=inputs["attention_mask"],
                decoder_input_ids=decoder_input_ids
            )
            
        # Get logits of first token
        next_token_logits = outputs.logits[:, 0, :]
        
        # Calculate softmax over true and false logits
        true_logits = next_token_logits[:, true_token_id]
        false_logits = next_token_logits[:, false_token_id]
        
        # Softmax to get relative probability of "true"
        scores = torch.softmax(torch.stack([true_logits, false_logits], dim=-1), dim=-1)[:, 0]
        scores = scores.cpu().numpy()

        for p, score in zip(passages, scores):
            p['score'] = float(score)

        # Sort descending by score
        passages.sort(key=lambda x: x['score'], reverse=True)
        return passages[:top_n]

    elif not is_sentence_transformer:
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

