# AI Blog Generator

Standalone Python tool for generating blog articles using AI (Gemini or OpenAI). This is extracted from the AeroLead Autodialer app for standalone use.

## Features

- ✅ Generate single or bulk blog posts
- ✅ Support for Gemini (Gemini 2.5 Flash) and OpenAI (GPT-4 Turbo)
- ✅ Customizable word count and context
- ✅ Markdown output with metadata headers
- ✅ Command-line interface
- ✅ File-based batch processing
- ✅ Automatic file naming and organization

## Installation

### 1. Clone or navigate to the directory

```bash
cd Blog-generator
```

### 2. Create virtual environment (recommended)

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
# Required: At least one API key
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Customize defaults
DEFAULT_AI_MODEL=gemini
DEFAULT_WORD_COUNT=1000
```

## Usage

### Generate Single Blog Post

```bash
python blog_generator.py "Understanding Machine Learning Basics"
```

### Generate with Custom Options

```bash
python blog_generator.py \
  "Advanced Python Techniques" \
  --model gemini \
  --word-count 2000 \
  --context "Focus on practical examples and code snippets" \
  --output my-article.md
```

### Generate Multiple Blog Posts

```bash
python blog_generator.py \
  "Topic 1" \
  "Topic 2" \
  "Topic 3" \
  --model gemini \
  --word-count 1000
```

### Generate from File

Create a file `topics.txt`:

```
Introduction to Python Programming
Advanced Data Structures in Python
Web Scraping with Beautiful Soup
```

Then run:

```bash
python blog_generator.py --file topics.txt --model gemini
```

### JSON Output

```bash
python blog_generator.py "My Article Title" --json
```

## Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `titles` | One or more blog post titles | Required |
| `-f, --file` | File containing titles (one per line) | - |
| `-m, --model` | AI model: `gemini` or `openai` | `gemini` |
| `-w, --word-count` | Target word count | `1000` |
| `-c, --context` | Additional context/instructions | - |
| `-o, --output` | Output file (single) or directory (bulk) | Auto-generated |
| `--json` | Output results as JSON | - |

## Output

Generated articles are saved to the `output/` directory with:
- Metadata header (title, generation date, model, word count)
- Full article content in markdown format
- Automatic filename generation: `blog_{title-slug}_{timestamp}.md`

Example output file:

```markdown
---
title: Understanding Machine Learning Basics
generated_at: 2025-11-01T22:30:00.000000
model: gemini-2.5-flash
word_count: 1250
---

# Understanding Machine Learning Basics

Machine learning is a subset of artificial intelligence...
```

## Examples

### Basic Usage

```bash
# Generate a single article
python blog_generator.py "How to Build REST APIs with Python"

# Generate multiple articles
python blog_generator.py \
  "Python Best Practices" \
  "Django Tutorial" \
  "Flask vs FastAPI" \
  --model gemini
```

### Advanced Usage

```bash
# Custom word count and context
python blog_generator.py \
  "Blockchain Technology Explained" \
  --word-count 2000 \
  --context "Explain for beginners, include real-world examples" \
  --model gemini

# Batch processing from file
python blog_generator.py \
  --file blog_topics.txt \
  --model gemini \
  --word-count 1500 \
  --output custom_output/
```

## Integration with AeroLead

This standalone tool mirrors the blog generation functionality in the AeroLead Autodialer app:

- **Rails App**: `Autodialer-app/app/services/gemini_service.rb`
- **Standalone**: `Blog-generator/ai_service.py`

Both use the same AI models and similar prompts for consistency.

## Requirements

- Python 3.8+
- Gemini API Key (free at https://ai.google.dev)
- OpenAI API Key (optional, from https://platform.openai.com)

## Troubleshooting

### API Key Errors

```
ValueError: GEMINI_API_KEY not configured
```

**Solution**: Ensure your `.env` file contains a valid API key.

### Rate Limiting

The tool includes a 1-second delay between bulk generations to avoid rate limits. If you encounter rate limiting:

- Reduce batch size
- Use `MAX_BULK_ARTICLES` in `.env` to limit automatic batch sizes
- Add longer delays in `blog_generator.py` if needed

### Output Directory

Articles are saved to `output/` by default. Ensure the directory exists and is writable.

## License

Part of the AeroLead project.

