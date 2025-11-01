#!/usr/bin/env python3
"""
Standalone AI Blog Generator
Generates blog posts using Gemini or OpenAI based on prompts/titles
"""
import argparse
import json
import logging
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict

from ai_service import get_ai_service
import config

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(config.LOG_FILE),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)


class BlogGenerator:
    """Blog generator using AI services"""

    def __init__(self, ai_model: str = None):
        self.ai_model = ai_model or config.DEFAULT_AI_MODEL
        self.ai_service = get_ai_service(self.ai_model)
        logger.info(f"Initialized BlogGenerator with model: {self.ai_model}")

    def generate_single(
        self,
        title: str,
        context: Optional[str] = None,
        word_count: int = None,
        output_file: Optional[str] = None,
    ) -> Dict:
        """Generate a single blog post"""
        word_count = word_count or config.DEFAULT_WORD_COUNT

        logger.info(f"Generating blog post: '{title}' ({word_count} words)")

        result = self.ai_service.generate_article(
            title=title, context=context, word_count=word_count
        )

        if result["success"]:
            # Save to file if output_file specified
            if output_file:
                self._save_article(title, result["content"], output_file)
            else:
                # Auto-generate filename
                filename = self._generate_filename(title)
                self._save_article(title, result["content"], filename)

            logger.info(f"✓ Successfully generated: {title}")
            return {
                "success": True,
                "title": title,
                "content": result["content"],
                "model": result.get("model", self.ai_model),
                "filename": output_file or self._generate_filename(title),
            }
        else:
            logger.error(f"✗ Failed to generate: {title} - {result.get('error', 'Unknown error')}")
            return {
                "success": False,
                "title": title,
                "error": result.get("error", "Unknown error"),
            }

    def generate_bulk(
        self,
        titles: List[str],
        context: Optional[str] = None,
        word_count: int = None,
        output_dir: Optional[str] = None,
    ) -> List[Dict]:
        """Generate multiple blog posts"""
        word_count = word_count or config.DEFAULT_WORD_COUNT
        output_dir = Path(output_dir) if output_dir else config.OUTPUT_DIR

        if len(titles) > config.MAX_BULK_ARTICLES:
            logger.warning(
                f"Too many titles ({len(titles)}). Maximum is {config.MAX_BULK_ARTICLES}"
            )
            titles = titles[: config.MAX_BULK_ARTICLES]

        logger.info(f"Generating {len(titles)} blog posts...")

        results = []
        for i, title in enumerate(titles, 1):
            logger.info(f"[{i}/{len(titles)}] Processing: {title}")

            result = self.generate_single(
                title=title, context=context, word_count=word_count
            )

            results.append(result)

            # Rate limiting - small delay between requests
            if i < len(titles):
                time.sleep(1)

        # Summary
        successful = sum(1 for r in results if r["success"])
        logger.info(f"\n{'='*50}")
        logger.info(f"Generation Complete: {successful}/{len(titles)} successful")
        logger.info(f"{'='*50}\n")

        return results

    def _save_article(self, title: str, content: str, filename: str):
        """Save article to file"""
        output_path = config.OUTPUT_DIR / filename

        # Add metadata header
        header = f"""---
title: {title}
generated_at: {datetime.now().isoformat()}
model: {self.ai_model}
word_count: {len(content.split())}
---

"""

        full_content = header + content

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(full_content)

        logger.info(f"Saved article to: {output_path}")

    def _generate_filename(self, title: str) -> str:
        """Generate a filename from title"""
        # Clean title for filename
        safe_title = "".join(c if c.isalnum() or c in (" ", "-", "_") else "" for c in title)
        safe_title = safe_title.replace(" ", "-").lower()[:50]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        extension = "md" if config.OUTPUT_FORMAT == "markdown" else "txt"
        return f"{config.OUTPUT_FILE_PREFIX}_{safe_title}_{timestamp}.{extension}"


def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        description="AI Blog Generator - Generate blog posts using Gemini or OpenAI"
    )
    parser.add_argument(
        "titles",
        nargs="*",
        help="Blog post title(s) to generate. Can provide multiple titles.",
    )
    parser.add_argument(
        "-f",
        "--file",
        type=str,
        help="File containing blog titles (one per line)",
    )
    parser.add_argument(
        "-m",
        "--model",
        choices=["gemini", "openai"],
        default=config.DEFAULT_AI_MODEL,
        help=f"AI model to use (default: {config.DEFAULT_AI_MODEL})",
    )
    parser.add_argument(
        "-w",
        "--word-count",
        type=int,
        default=config.DEFAULT_WORD_COUNT,
        help=f"Target word count (default: {config.DEFAULT_WORD_COUNT})",
    )
    parser.add_argument(
        "-c",
        "--context",
        type=str,
        help="Additional context or instructions for the article",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=str,
        help="Output filename (for single article) or directory (for bulk)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON",
    )

    args = parser.parse_args()

    # Collect titles from arguments or file
    titles = []

    if args.file:
        try:
            with open(args.file, "r", encoding="utf-8") as f:
                titles = [line.strip() for line in f if line.strip()]
        except FileNotFoundError:
            logger.error(f"File not found: {args.file}")
            sys.exit(1)
    elif args.titles:
        titles = args.titles
    else:
        parser.print_help()
        logger.error("No titles provided. Use --file or provide titles as arguments.")
        sys.exit(1)

    if not titles:
        logger.error("No valid titles found")
        sys.exit(1)

    # Initialize generator
    try:
        generator = BlogGenerator(ai_model=args.model)
    except ValueError as e:
        logger.error(f"Configuration error: {str(e)}")
        logger.error("Please set GEMINI_API_KEY or OPENAI_API_KEY in .env file")
        sys.exit(1)

    # Generate articles
    if len(titles) == 1:
        result = generator.generate_single(
            title=titles[0],
            context=args.context,
            word_count=args.word_count,
            output_file=args.output,
        )

        if args.json:
            print(json.dumps(result, indent=2))
        else:
            if result["success"]:
                print(f"\n✓ Successfully generated: {result['filename']}")
            else:
                print(f"\n✗ Failed: {result.get('error', 'Unknown error')}")
                sys.exit(1)
    else:
        results = generator.generate_bulk(
            titles=titles,
            context=args.context,
            word_count=args.word_count,
            output_dir=args.output,
        )

        if args.json:
            print(json.dumps(results, indent=2))
        else:
            successful = sum(1 for r in results if r["success"])
            print(f"\n✓ Generated {successful}/{len(results)} articles successfully")


if __name__ == "__main__":
    main()

