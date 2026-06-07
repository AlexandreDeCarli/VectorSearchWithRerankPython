"""Gemini embedding generation via Google Generative AI."""

import google.generativeai as genai
from backend.config import GEMINI_API_KEY, GEMINI_MODEL


def get_embedding(text: str) -> list[float]:
    """Generate a 768-dimensional embedding for the given text via Gemini."""
    if not GEMINI_API_KEY:
        raise ValueError('GEMINI_API_KEY is not defined in the environment.')

    genai.configure(api_key=GEMINI_API_KEY)

    result = genai.embed_content(
        model=f'models/{GEMINI_MODEL}',
        content=text,
        output_dimensionality=768,
    )

    if not result or 'embedding' not in result:
        raise ValueError('Failed to generate embedding: empty response.')

    return result['embedding']
