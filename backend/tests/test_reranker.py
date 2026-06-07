import pytest
from unittest.mock import MagicMock, patch
import backend.reranker as reranker

@pytest.fixture(autouse=True)
def clean_reranker_state():
    """Reset the reranker global state before each test."""
    reranker.ranker = None
    reranker.tokenizer = None
    reranker.is_sentence_transformer = False
    reranker.is_t5 = False
    reranker.true_token_id = 0
    reranker.false_token_id = 0
    reranker._model_cache = {}
    reranker.active_model_name = ""
    yield

def test_init_ranker_flashrank():
    """Verify FlashRank engine initialization for a native model."""
    model_name = "ms-marco-MiniLM-L-12-v2"
    
    # Mock Ranker class instantiation
    mock_ranker_instance = MagicMock()
    with patch('flashrank.Ranker', return_value=mock_ranker_instance) as mock_ranker_class:
        reranker.init_ranker(model_name)
        
        # Verify correct initialization flags
        assert reranker.is_t5 is False
        assert reranker.is_sentence_transformer is False
        assert reranker.ranker == mock_ranker_instance
        assert reranker.active_model_name == model_name
        mock_ranker_class.assert_called_once_with(model_name=model_name, cache_dir="/app/flashrank_cache")

def test_init_ranker_sentence_transformers_fallback():
    """Verify sentence-transformers fallback for custom Hugging Face models."""
    model_name = "nreimers/mmarco-mMiniLMv2-L12-H384-v1"
    
    mock_cross_encoder_instance = MagicMock()
    with patch('sentence_transformers.CrossEncoder', return_value=mock_cross_encoder_instance) as mock_ce_class:
        import torch
        reranker.init_ranker(model_name)
        
        assert reranker.is_t5 is False
        assert reranker.is_sentence_transformer is True
        assert reranker.ranker == mock_cross_encoder_instance
        assert reranker.active_model_name == model_name
        mock_ce_class.assert_called_once_with(
            model_name,
            model_kwargs={
                'low_cpu_mem_usage': True,
                'torch_dtype': torch.bfloat16,
                'trust_remote_code': True
            }
        )

def test_init_ranker_t5():
    """Verify T5 Seq2Seq model initialization."""
    model_name = "unicamp-dl/monoptt5-base"
    
    mock_tokenizer = MagicMock()
    # Mock tokenizer encodes Sim/Não tokens to specific IDs
    mock_tokenizer.encode.side_effect = lambda t, **kwargs: [100] if "Sim" in t or "true" in t or "yes" in t else ([200] if "Não" in t or "false" in t or "no" in t else [])
    
    mock_model = MagicMock()
    
    with patch('transformers.AutoTokenizer.from_pretrained', return_value=mock_tokenizer) as mock_tok_class, \
         patch('transformers.AutoModelForSeq2SeqLM.from_pretrained', return_value=mock_model) as mock_mod_class:
        
        reranker.init_ranker(model_name)
        
        assert reranker.is_t5 is True
        assert reranker.is_sentence_transformer is False
        assert reranker.tokenizer == mock_tokenizer
        assert reranker.ranker == mock_model.to.return_value
        assert reranker.true_token_id == 100
        assert reranker.false_token_id == 200
        assert reranker.active_model_name == model_name

def test_reranker_caching():
    """Verify that loading a model twice uses cache and doesn't recreate instances."""
    model_name = "ms-marco-MiniLM-L-12-v2"
    
    mock_ranker = MagicMock()
    with patch('flashrank.Ranker', return_value=mock_ranker) as mock_ranker_class:
        # First load
        reranker.init_ranker(model_name)
        assert mock_ranker_class.call_count == 1
        
        # Second load (should pull from memory cache)
        reranker.init_ranker(model_name)
        assert mock_ranker_class.call_count == 1
        assert reranker.ranker == mock_ranker

def test_reranker_dynamic_switching():
    """Verify switching between models retains cached configurations."""
    model1 = "ms-marco-MiniLM-L-12-v2"
    model2 = "nreimers/mmarco-mMiniLMv2-L12-H384-v1"
    
    mock_ranker1 = MagicMock()
    mock_ranker2 = MagicMock()
    
    with patch('flashrank.Ranker', return_value=mock_ranker1) as mock_ranker_class, \
         patch('sentence_transformers.CrossEncoder', return_value=mock_ranker2) as mock_ce_class:
        
        # Load model 1
        reranker.init_ranker(model1)
        assert reranker.ranker == mock_ranker1
        assert reranker.active_model_name == model1
        
        # Load model 2
        reranker.init_ranker(model2)
        assert reranker.ranker == mock_ranker2
        assert reranker.active_model_name == model2
        
        # Switch back to model 1 (cache hit)
        reranker.init_ranker(model1)
        assert reranker.ranker == mock_ranker1
        assert reranker.active_model_name == model1
        
        # No extra initializations
        assert mock_ranker_class.call_count == 1
        assert mock_ce_class.call_count == 1

def test_rerank_uninitialized_throws():
    """Verify rerank raises RuntimeError if ranker is not initialized."""
    with pytest.raises(RuntimeError, match="Ranker not initialized"):
        reranker.rerank("query", [{"text": "doc"}])

def test_rerank_sentence_transformers_sigmoid():
    """Verify sentence-transformers sigmoid scoring and sorting."""
    # Setup sentence transformer state
    reranker.is_sentence_transformer = True
    reranker.is_t5 = False
    
    mock_encoder = MagicMock()
    # Predict returns raw logit scores for 3 passages
    mock_encoder.predict.return_value = [2.0, -1.0, 0.0]
    reranker.ranker = mock_encoder
    
    passages = [
        {"id": "1", "text": "Doc 1"},
        {"id": "2", "text": "Doc 2"},
        {"id": "3", "text": "Doc 3"}
    ]
    
    results = reranker.rerank("search query", passages, top_n=2)
    
    # Assert return size is limited by top_n
    assert len(results) == 2
    
    # Sigmoids: 
    # Sigmoid(2.0) = 1/(1+e^-2) = 0.8807
    # Sigmoid(0.0) = 0.5000
    # Sigmoid(-1.0) = 0.2689
    # Sorted order should be: Doc 1, Doc 3
    assert results[0]["id"] == "1"
    assert results[0]["score"] == pytest.approx(0.880797)
    assert results[1]["id"] == "3"
    assert results[1]["score"] == pytest.approx(0.500000)

def test_rerank_flashrank_delegation():
    """Verify FlashRank ONNX delegation."""
    reranker.is_sentence_transformer = False
    reranker.is_t5 = False
    
    mock_ranker = MagicMock()
    # FlashRank returns list sorted with scores
    mock_ranker.rerank.return_value = [
        {"id": "1", "score": 0.95},
        {"id": "2", "score": 0.82}
    ]
    reranker.ranker = mock_ranker
    
    passages = [{"id": "1", "text": "Doc 1"}, {"id": "2", "text": "Doc 2"}]
    
    with patch('flashrank.RerankRequest') as mock_request:
        results = reranker.rerank("query", passages)
        assert len(results) == 2
        assert results[0]["score"] == 0.95
        mock_request.assert_called_once()
