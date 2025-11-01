"""
Configuration settings for LinkedIn Profile Scraper
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

# LinkedIn credentials (loaded from .env file)
LINKEDIN_EMAIL = os.getenv("LINKEDIN_EMAIL", "")
LINKEDIN_PASSWORD = os.getenv("LINKEDIN_PASSWORD", "")

# Scraping settings
PROFILE_COUNT = int(os.getenv("PROFILE_COUNT", "20"))
REQUEST_DELAY_MIN = int(os.getenv("REQUEST_DELAY_MIN", "3"))
REQUEST_DELAY_MAX = int(os.getenv("REQUEST_DELAY_MAX", "6"))
PAGE_LOAD_TIMEOUT = int(os.getenv("PAGE_LOAD_TIMEOUT", "20"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))

# Output settings
OUTPUT_FILE = os.getenv("OUTPUT_FILE", "linkedin_profiles.csv")
OUTPUT_PATH = OUTPUT_DIR / OUTPUT_FILE

# Browser settings
HEADLESS_MODE = os.getenv("HEADLESS_MODE", "true").lower() == "true"
USE_PROXIES = os.getenv("USE_PROXIES", "false").lower() == "true"
WINDOW_SIZE = os.getenv("WINDOW_SIZE", "1920,1080")

# Proxy settings (if USE_PROXIES is True)
PROXY_LIST = os.getenv("PROXY_LIST", "").split(",") if os.getenv("PROXY_LIST") else []

# User agents for rotation
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
]

# LinkedIn URLs
LINKEDIN_BASE_URL = "https://www.linkedin.com"
LINKEDIN_LOGIN_URL = f"{LINKEDIN_BASE_URL}/login"

# Logging settings
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FILE = LOGS_DIR / "scraper.log"

# Selectors for LinkedIn elements (updated for 2025)
SELECTORS = {
    "login": {
        "email": "input#username",
        "password": "input#password",
        "submit": "button[type='submit']",
    },
    "profile": {
        # Name selectors (multiple fallbacks)
        "name": [
            "h1.text-heading-xlarge.inline.t-24.v-align-middle.break-words",
            "h1.break-words",
            "h1.text-heading-xlarge",
            "h1.top-card-layout__title",
            "h1[data-anonymize='person-name']",
        ],
        # Headline selectors
        "headline": [
            "div.text-body-medium.break-words",
            "div.text-body-medium",
            ".ph5.pb5 .mt1",
            ".text-body-medium.inline.t-black--light.break-words",
        ],
        # Location selectors
        "location": [
            "span.text-body-small.inline.t-black--light.break-words",
            ".text-body-small.inline.t-black--light",
            ".pv-text-details__left-panel span.text-body-small",
        ],
        # About section
        "about": [
            "div.display-flex.ph5.pv3 span[aria-hidden='true']",
            ".pv-about-section .pv-about__summary-text",
            "section[data-section='summary'] .pv-about__summary-text",
        ],
        # Experience section
        "experience_section": [
            "section[data-section='experience']",
            "section#experience-section",
            "section.pv-profile-section.experience-section",
        ],
        # Education section
        "education_section": [
            "section[data-section='education']",
            "section#education-section",
            "section.pv-profile-section.education-section",
        ],
        # Skills section
        "skills_section": [
            "section[data-section='skills']",
            "section#skills-section",
            "section.pv-profile-section.skills-section",
        ],
        # Connections
        "connections": [
            "span.t-black--light span",
            ".pv-top-card-v2-ctas__connections",
            ".t-black--light",
        ],
        # Show more buttons
        "show_more": [
            "button[aria-label*='Show more']",
            "button.artdeco-button--secondary",
            ".inline-show-more-text__button",
        ],
    }
}

# Data fields to extract (core fields)
DATA_FIELDS = [
    "name",
    "headline",
    "location",
    "about",
    "current_company",
    "current_position",
    "education",
    "top_skills",
    "profile_url",
    "connections",
    "scraped_at"
]

# Extended data fields (all skills, contact info, etc.)
EXTENDED_DATA_FIELDS = [
    "all_skills",
    "skills_count",
    "email",
    "phone",
    "website",
    "profile_image_url",
    "pronouns",
    "all_experience",
    "all_education"
]
