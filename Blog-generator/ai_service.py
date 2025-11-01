"""
AI Service for generating blog articles using Gemini or OpenAI
"""
import json
import logging
import time
from typing import Dict, List, Optional

import requests
from openai import OpenAI

import config

logger = logging.getLogger(__name__)


class GeminiService:
    """Google Gemini AI Service"""

    BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or config.GEMINI_API_KEY
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not configured")

    def generate_article(
        self, title: str, context: Optional[str] = None, word_count: int = 1000
    ) -> Dict:
        """Generate a blog article using Gemini"""
        prompt = self._build_article_prompt(title, context, word_count)

        try:
            response = self._make_request(prompt)
            content = self._extract_text(response)

            if content:
                return {
                    "content": content,
                    "title": title,
                    "model": "gemini-2.5-flash",
                    "success": True,
                }
            else:
                return {
                    "content": None,
                    "error": "Empty response from Gemini API",
                    "success": False,
                }
        except Exception as e:
            logger.error(f"Gemini API Error: {str(e)}")
            return {"content": None, "error": str(e), "success": False}

    def _make_request(self, prompt: str, model: str = "gemini-2.5-flash") -> Dict:
        """Make API request to Gemini"""
        url = self.BASE_URL

        body_data = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.9,
                "topK": 40,
                "topP": 0.95,
                "maxOutputTokens": 8192,
                "candidateCount": 1,
            },
        }

        logger.info(f"Making Gemini API request for article generation")

        response = requests.post(
            url,
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": self.api_key,
            },
            json=body_data,
            timeout=60,
        )

        if not response.ok:
            error_details = response.json() if response.text else response.text
            logger.error(f"Gemini API Error Response: {error_details}")
            raise Exception(
                f"API Error: {response.status_code} - {response.reason}. Details: {error_details}"
            )

        return response.json()

    def _extract_text(self, response: Dict) -> str:
        """Extract text from Gemini response"""
        try:
            if not response or "candidates" not in response:
                return ""

            candidates = response["candidates"]
            if not candidates:
                return ""

            content = candidates[0].get("content", {}).get("parts", [])
            if not content:
                return ""

            return content[0].get("text", "")
        except Exception as e:
            logger.error(f"Failed to extract text from Gemini response: {str(e)}")
            return ""

    def _build_article_prompt(
        self, title: str, context: Optional[str] = None, word_count: int = 1000
    ) -> str:
        """Build the prompt for article generation"""
        prompt = f"""Write a comprehensive, SEO-optimized blog article on the following topic:

**Title**: {title}

{f"**Context**: {context}" if context else ""}

**Requirements**:
- Target length: {word_count} words
- Include an engaging introduction
- Use clear section headings (use ## for H2 headings)
- Provide detailed explanations and examples
- Include code snippets where relevant (use markdown code blocks)
- Write in a professional yet accessible tone
- Conclude with a summary or key takeaways
- Use markdown formatting throughout

**Format**: Return ONLY the article content in markdown format, without any preamble or meta-commentary."""
        return prompt


class OpenAIService:
    """OpenAI Service"""

    def __init__(self, api_key: Optional[str] = None):
        api_key = api_key or config.OPENAI_API_KEY
        if not api_key:
            raise ValueError("OPENAI_API_KEY not configured")
        self.client = OpenAI(api_key=api_key)

    def generate_article(
        self, title: str, context: Optional[str] = None, word_count: int = 1000
    ) -> Dict:
        """Generate a blog article using OpenAI"""
        prompt = self._build_article_prompt(title, context, word_count)

        try:
            response = self.client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": "You are a professional technical writer."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
                max_tokens=2500,
            )

            content = response.choices[0].message.content

            return {
                "content": content,
                "title": title,
                "model": "gpt-4-turbo-preview",
                "success": True,
            }
        except Exception as e:
            logger.error(f"OpenAI API Error: {str(e)}")
            return {"content": None, "error": str(e), "success": False}

    def _build_article_prompt(
        self, title: str, context: Optional[str] = None, word_count: int = 1000
    ) -> str:
        """Build the prompt for article generation"""
        prompt = f"""Write a comprehensive, SEO-optimized blog article on the following topic:

**Title**: {title}

{f"**Context**: {context}" if context else ""}

**Requirements**:
- Target length: {word_count} words
- Include an engaging introduction
- Use clear section headings (use ## for H2 headings)
- Provide detailed explanations and examples
- Include code snippets where relevant (use markdown code blocks)
- Write in a professional yet accessible tone
- Conclude with a summary or key takeaways
- Use markdown formatting throughout

**Format**: Return ONLY the article content in markdown format, without any preamble or meta-commentary."""
        return prompt


def get_ai_service(model: str = None) -> object:
    """Get the appropriate AI service based on model"""
    model = model or config.DEFAULT_AI_MODEL
    model_lower = model.lower()

    if model_lower == "openai":
        return OpenAIService()
    elif model_lower == "gemini":
        return GeminiService()
    else:
        logger.warning(f"Unknown model {model}, defaulting to Gemini")
        return GeminiService()

