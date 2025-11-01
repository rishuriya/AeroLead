"""
Configuration settings for AI Blog Generator
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Project paths
BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "output"
LOGS_DIR = BASE_DIR / "logs"

# Create necessary directories
OUTPUT_DIR.mkdir(exist_ok=True)
LOGS_DIR.mkdir(exist_ok=True)

# AI API Keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Default settings
DEFAULT_AI_MODEL = os.getenv("DEFAULT_AI_MODEL", "gemini")
DEFAULT_WORD_COUNT = int(os.getenv("DEFAULT_WORD_COUNT", "1000"))
MAX_BULK_ARTICLES = int(os.getenv("MAX_BULK_ARTICLES", "20"))

# Output settings
OUTPUT_FORMAT = os.getenv("OUTPUT_FORMAT", "markdown")  # markdown or html
OUTPUT_FILE_PREFIX = os.getenv("OUTPUT_FILE_PREFIX", "blog")

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FILE = LOGS_DIR / "blog_generator.log"

