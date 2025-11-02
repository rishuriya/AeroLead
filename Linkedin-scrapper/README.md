# LinkedIn Profile Scraper - Production Ready

An advanced, production-ready LinkedIn scraper using Puppeteer with intelligent CAPTCHA solving, cookie-based session management, multi-tab concurrent scraping, and AI-powered data extraction.

## Why This Approach is Better

### 🚀 Production-Ready Features

1. **Cookie-Based Session Management**: Login once, cookies are saved automatically. Next runs skip login entirely if cookies are valid.
2. **Three-Phase Workflow**: 
   - Phase 1: Login in non-headless mode (you can see and solve reCAPTCHA if needed)
   - Phase 2: Scrape in headless mode (fast, using saved cookies)
   - Phase 3: Export to CSV automatically
3. **Automatic Multi-Tab for Multiple URLs**: When scraping multiple profiles, opens different tabs in the same browser for concurrent scraping (3-5x faster)
4. **No Repeated Login**: Login only when cookies expire - saves time and reduces detection risk
5. **Smart Cookie Validation**: Automatically detects expired cookies and triggers re-login only when needed

### ✨ Key Advantages

- **Faster**: No login overhead after first run
- **More Reliable**: Persistent sessions mean fewer login challenges
- **Better UX**: You only login when needed, can see browser during login
- **Production Ready**: Designed for repeated use in production environments
- **Efficient**: Multi-tab scraping for multiple URLs in the same browser session

## Features

- **Cookie-Based Authentication**: Login once, reuse session across multiple runs
- **Smart Login Flow**: Non-headless mode for login (see what's happening), headless mode for scraping (fast)
- **Free CAPTCHA Solving**: Uses Gemini API (free) to solve reCAPTCHA v2 automatically, with manual fallback option
- **Multi-Tab Scraping**: Automatically opens different tabs in the same browser for multiple URLs (3-5x faster)
- **AI-Powered Extraction**: Gemini AI extracts and structures profile data intelligently
- **Smart Text Normalization**: Automatically fixes corrupted text (e.g., "SDESDE" → "Software Development Engineer")
- **Intelligent Cleaning**: Removes duplicate words, expands abbreviations, fixes OCR errors
- **Profile Image Extraction**: Correctly extracts profile pictures (not cover images) using aspect ratio and container detection
- **Automatic CSV Export**: All scraped data automatically saved to CSV
- **Anti-Detection**: Stealth mode with advanced browser fingerprinting evasion
- **Session Persistence**: Cookies saved automatically, reused on next run
- **Modular Architecture**: Clean, maintainable codebase split into focused modules

## Installation

### Step 1: Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies (optional, for Python wrapper)
pip install -r requirements.txt
```

### Step 2: Setup Script (Optional but Recommended)

```bash
# Run the setup script (sets up everything automatically)
bash setup_puppeteer.sh
```

## Quick Start

1. **Create `.env` file** with your credentials:
```env
LINKEDIN_EMAIL=your-email@example.com
LINKEDIN_PASSWORD=your-password
GEMINI_API_KEY=your-gemini-api-key
```

2. **Create `profile_urls.txt`** with LinkedIn URLs (one per line):
```
https://www.linkedin.com/in/profile1/
https://www.linkedin.com/in/profile2/
```

3. **Run the scraper**:
```bash
python linkedin_scraper_puppeteer.py profile_urls.txt
```

4. **First run**: Browser opens for login → solve reCAPTCHA if needed → cookies saved → scraping starts

5. **Next runs**: Skips login → scrapes directly using saved cookies → exports to CSV

## Configuration

Create a `.env` file in the project root:

```env
# Required: LinkedIn credentials
LINKEDIN_EMAIL=your-email@example.com
LINKEDIN_PASSWORD=your-password

# Required: Gemini API key (free from https://ai.google.dev)
GEMINI_API_KEY=your-gemini-api-key

# Optional: 2Captcha API key (fallback if Gemini fails)
TWOCAPTCHA_API_KEY=your-2captcha-key

# Optional: Headless mode (default: true)
HEADLESS=false
```

### Getting a Free Gemini API Key

1. Visit [https://ai.google.dev](https://ai.google.dev)
2. Click "Get API key in Google AI Studio"
3. Sign in with your Google account
4. Create a new API key
5. Copy and paste it into your `.env` file

## Usage

### Recommended: Python Wrapper (Production Ready)

The easiest way to use the scraper is via the Python wrapper, which handles the entire workflow automatically:

```bash
# Scrape profiles from a file (one URL per line)
python linkedin_scraper_puppeteer.py profile_urls.txt

# With custom output file
python linkedin_scraper_puppeteer.py profile_urls.txt -o output.csv

# With verbose logging
python linkedin_scraper_puppeteer.py profile_urls.txt -v

# Test mode (scrape only 5 profiles)
python linkedin_scraper_puppeteer.py profile_urls.txt --test
```

### How It Works (Automatic Workflow)

1. **First Run**: 
   - Opens browser (non-headless) for login
   - You can see the browser and solve reCAPTCHA manually if needed
   - After successful login, cookies are saved automatically
   - Browser closes, then reopens in headless mode for scraping
   - All data exported to CSV

2. **Subsequent Runs**:
   - Loads saved cookies automatically
   - Verifies cookies are valid
   - Skips login if cookies are valid (no browser window needed!)
   - Scrapes in headless mode (fast)
   - Exports to CSV

3. **Multiple URLs**:
   - Automatically detects multiple URLs
   - Opens different tabs in the same browser for concurrent scraping
   - Scrapes 3 profiles at a time (configurable)
   - Much faster than sequential scraping

### Advanced: Direct Node.js Usage

For advanced users who want more control:

```bash
# Single profile
node puppeteer_scraper.js scrape https://www.linkedin.com/in/profile-url/

# Multiple profiles (automatic multi-tab mode)
node puppeteer_scraper.js scrape https://linkedin.com/in/profile1/ https://linkedin.com/in/profile2/

# Customize concurrent tabs
node puppeteer_scraper.js scrape --max-tabs=5 https://linkedin.com/in/profile1/ https://linkedin.com/in/profile2/

# Login only (non-headless mode, saves cookies)
node puppeteer_scraper.js login-only

# Force sequential scraping
node puppeteer_scraper.js scrape --sequential https://linkedin.com/in/profile1/ https://linkedin.com/in/profile2/
```

### File Format

Create `profile_urls.txt` with one URL per line:

```
https://www.linkedin.com/in/profile1/
https://www.linkedin.com/in/profile2/
https://www.linkedin.com/in/profile3/
```

## How It Works

### Three-Phase Production Workflow

#### Phase 1: Login (Non-Headless Mode)
- **Checks for saved cookies first** - if valid, skips login entirely
- If cookies missing/expired, opens browser in **non-headless mode** (you can see it)
- Navigates to LinkedIn login page
- Enters credentials from `.env` file
- **Detects reCAPTCHA** automatically
- **Solves reCAPTCHA**:
  - In non-headless mode: Waits for you to solve manually (up to 120 seconds)
  - Automatically detects when you solve it
  - Falls back to Gemini API solving if configured
- Verifies login success
- **Saves cookies automatically** to `.linkedin_cookies.json`
- Closes browser after login

#### Phase 2: Scraping (Headless Mode)
- Reopens browser in **headless mode** (fast, no UI)
- **Loads saved cookies** from previous login
- Verifies cookies are valid
- **Single URL**: Scrapes sequentially
- **Multiple URLs**: Automatically opens **different tabs in the same browser**
  - Default: 3 concurrent tabs (configurable)
  - Scrapes concurrently for 3-5x speed improvement
  - All tabs share the same session (no re-login needed)
- For each profile:
  - Navigates to profile URL
  - Waits for content to load
  - Scrolls to trigger lazy-loaded content
  - Extracts clean, structured DOM content
  - Sends to Gemini AI for intelligent extraction
  - Falls back to manual extraction if Gemini fails
- Closes browser after all scraping completes

#### Phase 3: Export (Automatic)
- Normalizes all scraped data
- Exports to CSV automatically
- All data saved to `output/linkedin_profiles.csv`

### Cookie Management

- **Cookie File**: `.linkedin_cookies.json` (automatically created after first login)
- **Validation**: Checks cookie expiration before each run
- **Auto-Refresh**: Automatically triggers login if cookies expired
- **Security**: Cookie file is in `.gitignore` (never committed)

### Multi-Tab Scraping Architecture

When multiple URLs are provided:
1. Browser opens once (headless)
2. Cookies loaded into the browser
3. For each batch of URLs:
   - Opens new tabs (up to max_concurrent, default: 3)
   - Each tab scrapes a different profile concurrently
   - All tabs share the same browser session
   - After batch completes, tabs close, next batch starts
4. Much faster than sequential scraping (3-5x speedup)

### Profile Extraction Process

1. **DOM Extraction**:
   - Removes scripts, styles, and irrelevant content
   - Normalizes whitespace and formatting
   - Robust section detection with multiple fallback selectors
   - Only scrapes visible content (no "Show more" clicking)

2. **AI Processing**:
   - Sends extracted content to Gemini AI
   - AI structures data intelligently with text normalization
   - Automatically fixes corrupted text (e.g., "SDESDE" → "Software Development Engineer")
   - Expands abbreviations (SDE, PM, etc.)
   - Removes duplicate words and fixes OCR errors
   - Parses into JSON format

3. **Data Normalization**:
   - Validates all fields
   - Applies defaults for missing fields
   - Normalizes position titles (removes duplicates, expands abbreviations)
   - Extracts profile images correctly (excludes cover images)
   - Converts to CSV-compatible format

## Output Format

### CSV Output (Default)

The scraper automatically exports to CSV with all profile data:

| Column | Description |
|--------|-------------|
| `profile_url` | LinkedIn profile URL |
| `scraped_at` | Timestamp of scraping |
| `name` | Full name |
| `headline` | Professional headline |
| `location` | Location |
| `about` | About/bio section |
| `current_company` | Current company |
| `current_position` | Current position |
| `all_experience` | JSON array of all work experience |
| `education` | Primary education |
| `all_education` | JSON array of all education |
| `top_skills` | Top 10 skills (comma-separated) |
| `all_skills` | All skills (comma-separated) |
| `skills_count` | Number of skills |
| `email` | Email (if available) |
| `phone` | Phone (if available) |
| `website` | Website (if available) |

### JSON Format (Node.js Direct Usage)

When using Node.js directly, returns JSON with the following structure:

```json
[
  {
    "profile_url": "https://linkedin.com/in/profile/",
    "scraped_at": "2025-01-01T12:00:00.000Z",
    "name": "John Doe",
    "headline": "Software Engineer at Google",
    "location": "San Francisco, California",
    "about": "Passionate software engineer with 10+ years...",
    "current_company": "Google",
    "current_position": "Software Engineer",
    "all_experience": [
      {
        "position": "Software Engineer",
        "company": "Google",
        "duration": "2020 - Present"
      }
    ],
    "education": "Stanford University",
    "all_education": [
      {
        "school": "Stanford University",
        "degree": "BS Computer Science"
      }
    ],
    "top_skills": "Python, JavaScript, React",
    "all_skills": "Python, JavaScript, React, Node.js, Docker...",
    "skills_count": 25,
    "email": "N/A",
    "phone": "N/A",
    "website": "N/A",
    "profile_image_url": "https://...",
    "connections": "500+",
    "pronouns": "he/him"
  }
]
```

## CAPTCHA Solving

This scraper uses **intelligent CAPTCHA solving** with multiple strategies:

1. **Manual Solving (Recommended)**: In Phase 1 (login), browser is visible (non-headless)
   - You can see the reCAPTCHA challenge
   - Solve it manually (most reliable)
   - Scraper automatically detects when you solve it
   - Waits up to 120 seconds for manual solving

2. **Gemini API (Automatic)**: Uses free Gemini API to solve reCAPTCHA automatically
   - Works in parallel with manual solving
   - Free and unlimited
   - Falls back to manual if automatic fails

3. **2Captcha (Fallback)**: Paid service as last resort
   - Only used if manual and Gemini both fail
   - Requires `TWOCAPTCHA_API_KEY` in `.env`

**Best Practice**: Run in non-headless mode for login phase, solve reCAPTCHA manually once. Cookies are saved, so you won't need to login again!

## Recent Improvements

### Text Normalization & Cleaning
- **Intelligent Position Title Normalization**: Automatically fixes corrupted text like "SDESDE" → "Software Development Engineer"
- **Abbreviation Expansion**: Expands common abbreviations (SDE, PM, etc.) when context suggests it
- **Duplicate Removal**: Removes duplicate words and fixes OCR errors
- **Practical Validation**: Ensures all position titles are realistic and professional
- **Context-Aware Cleaning**: Uses common sense to infer correct forms when text is garbled

### Profile Image Extraction
- **Correct Image Detection**: Now extracts profile pictures (not cover images)
- **Aspect Ratio Filtering**: Uses image dimensions to distinguish between profile photos (square) and cover photos (wide)
- **Container Detection**: Checks parent elements to exclude cover/background containers
- **Multiple Selector Fallbacks**: Tries multiple selectors to find the correct profile image

### Modular Architecture
- **Clean Codebase**: Refactored into focused modules (`browser.js`, `login.js`, `extraction.js`, `scraper.js`, `cli.js`, `utils.js`)
- **Better Maintainability**: Each module has a single responsibility
- **Easy to Extend**: Add new features without touching existing code

## Performance Tips

### For Best Results

1. **Login Once**: First run will login (you can see the browser), cookies are saved automatically
2. **Subsequent Runs**: No login needed - cookies are reused (much faster!)
3. **Multiple URLs**: Automatically uses multi-tab mode (3-5x faster)
4. **Use Gemini API**: Free and works well for CAPTCHA solving
5. **Solve CAPTCHA Manually**: Most reliable during login phase (browser is visible)

### Rate Limiting

LinkedIn may rate limit if you:
- Scrape too many profiles too quickly
- Use too many concurrent tabs (>5)
- Don't add delays between batches

The scraper includes built-in delays between batches to avoid rate limiting.

### Speed Comparison

- **Sequential**: 1 profile per browser session = ~30-60 seconds per profile
- **Multi-Tab (3 tabs)**: 3 profiles per browser session = ~30-60 seconds for 3 profiles (10-20s per profile)
- **With Saved Cookies**: Skip login entirely = Save 10-30 seconds per run

## Troubleshooting

### Login Fails (First Run)

- Check credentials in `.env` file
- Browser will be visible during login - watch what happens
- Solve reCAPTCHA manually if it appears
- Ensure credentials are correct
- Check if LinkedIn is blocking your IP

### Cookies Expired

- If cookies expire, scraper will automatically trigger login again
- Delete `.linkedin_cookies.json` to force fresh login
- Cookies typically last several weeks

### CAPTCHA Not Solving

- During login phase, browser is visible - solve it manually (most reliable)
- Verify Gemini API key is correct (optional, for automatic solving)
- Check API quota at [https://ai.google.dev](https://ai.google.dev)
- Add 2Captcha API key as fallback (optional)

### "No cookies found" Error

- This means login hasn't been completed yet
- Run the scraper once - it will open browser for login
- After successful login, cookies are saved automatically

### Profile Content Not Loading

- Increase wait times in code
- Check internet connection
- Profile might be private/restricted

### Experience/Education/Skills Not Found

- The scraper only extracts **visible content** without clicking "Show more" buttons
- Some sections might be collapsed or require scrolling to load
- LinkedIn may use different section layouts for different profiles
- The scraper uses multiple fallback selectors to find sections
- If using Gemini AI extraction, the AI may still extract data from partial text
- Run with `--no-headless` to visually inspect what's visible on the page

## Advanced Configuration

### Environment Variables (.env file)

```env
# Required: LinkedIn credentials
LINKEDIN_EMAIL=your-email@example.com
LINKEDIN_PASSWORD=your-password

# Required: Gemini API key (free from https://ai.google.dev)
GEMINI_API_KEY=your-gemini-api-key

# Optional: 2Captcha API key (fallback for CAPTCHA solving)
TWOCAPTCHA_API_KEY=your-2captcha-key

# Optional: Browser settings
HEADLESS=true                     # Phase 2 uses headless (Phase 1 always non-headless for login)
PUPPETEER_EXECUTABLE_PATH=/path  # Custom Chrome path

# Optional: Debugging
DEBUG_SAVE_CONTENT=true          # Save extracted content to files for debugging
```

### Python Wrapper Options

```bash
# Basic usage
python linkedin_scraper_puppeteer.py profile_urls.txt

# Options
-o, --output OUTPUT      # Custom output CSV file path
-n, --profiles N         # Maximum number of profiles to scrape
-v, --verbose            # Enable verbose logging
--test                   # Test mode (scrape only 5 profiles)
```

### Node.js Direct Usage Flags

```bash
# Commands
login-only               # Login only (non-headless, saves cookies)
scrape                   # Scrape profiles (headless, uses cookies)

# Flags
--no-headless            # Show browser window
--headless               # Hide browser window
--sequential             # Disable multi-tab mode (slower)
--multi-tab              # Enable multi-tab mode (faster)
--max-tabs=5             # Set max concurrent tabs
```

## Debugging

### Enable Debug Mode

To see exactly what content is being extracted and sent to Gemini:

```bash
# Set debug flag in .env
DEBUG_SAVE_CONTENT=true

# Run scraper
node puppeteer_scraper.js scrape https://linkedin.com/in/profile/
```

This will:
- Save extracted content to `debug_content_<timestamp>.txt` files
- Show content length and preview in console
- Display Gemini response length
- Log extraction summary (name, experience count, education count, skills count)

### Debug Output Example

```
Extracted content length: 3542 chars
Gemini response length: 1247 chars
✓ Gemini successfully parsed JSON with 19 fields
Extracted: John Doe, Experience: 3, Education: 2, Skills: 15
```

### Understanding the Extraction Process

1. **DOM Extraction** - The scraper extracts visible content:
   ```
   === PROFILE URL ===
   https://linkedin.com/in/profile/

   === SCRAPED AT ===
   2025-01-01T12:00:00.000Z

   === Name ===
   John Doe

   === Headline ===
   Software Engineer at Google

   === Experience ===
   Software Engineer Google 2020 - Present
   ---
   Senior Developer Facebook 2018 - 2020
   ```

2. **Gemini Processing** - Content is sent to Gemini AI with detailed instructions
3. **JSON Parsing** - Response is parsed into structured data
4. **Validation** - Fields are validated and defaults are applied

### Common Issues and Solutions

**Issue: Very little content extracted**
- Check if profile is public
- Ensure you're logged in
- Profile might be mostly private/restricted
- Some sections might not be visible without scrolling

**Issue: Gemini returns empty fields**
- Enable `DEBUG_SAVE_CONTENT=true` to see extracted content
- Check if sections are present in the extracted text
- Gemini might struggle with very short or unusual formatting
- Manual extraction will be used as fallback

**Issue: Parsing errors**
- Gemini response preview will be shown in console
- Usually means Gemini returned non-JSON text
- Check API quota at https://ai.google.dev
- Scraper will fall back to manual extraction

## License

ISC

## Disclaimer

This tool is for educational purposes only. Scraping LinkedIn may violate their Terms of Service. Use at your own risk. Always respect robots.txt and rate limits.

## Why This Approach is Superior

### 🔄 Cookie-Based Session Management

**Traditional Approach:**
- Login every time = Time consuming
- Higher risk of detection = Frequent login challenges
- Can't automate CAPTCHA solving reliably = Manual intervention needed

**Our Approach:**
- ✅ Login once, cookies saved automatically
- ✅ Reuse session across runs (days/weeks)
- ✅ Auto-detects expired cookies, re-login only when needed
- ✅ Much faster subsequent runs (no login overhead)
- ✅ Lower detection risk (less frequent logins)

### 🎯 Three-Phase Production Workflow

**Phase 1: Login (Non-Headless)**
- Browser visible = You can see what's happening
- Solve CAPTCHA manually = Most reliable method
- Cookies saved = Next runs skip login

**Phase 2: Scraping (Headless)**
- Fast headless mode = No UI overhead
- Uses saved cookies = No re-login needed
- Multi-tab for multiple URLs = 3-5x faster
- Same browser session = Shared cookies across tabs

**Phase 3: Export (Automatic)**
- CSV export = Ready to use
- All data normalized = Consistent format
- Automatic = No manual steps

### ⚡ Performance Benefits

| Feature | Traditional | Our Approach | Improvement |
|---------|------------|--------------|-------------|
| Login per run | Every time | Once (cookies) | Save 10-30s per run |
| Multiple URLs | Sequential | Multi-tab concurrent | 3-5x faster |
| CAPTCHA solving | Every login | Once (cookies) | No repeated CAPTCHAs |
| Session persistence | None | Automatic | Weeks of reuse |

### 🛡️ Reliability Benefits

- **Persistent Sessions**: Cookies last weeks, not just one session
- **Automatic Re-login**: Only when needed (cookies expired)
- **Error Recovery**: Invalid cookies trigger automatic fresh login
- **Production Ready**: Designed for repeated, automated use

## Support

For issues or questions:
1. **Check this README** - Most answers are here
2. **First run**: Browser will open for login - watch what happens
3. **Verify credentials**: Check `.env` file has correct credentials
4. **Check cookies**: If issues persist, delete `.linkedin_cookies.json` and re-login
5. **Rate limiting**: Reduce concurrent tabs if LinkedIn blocks requests
6. **Debug mode**: Use `-v` flag for verbose logging

## FAQ

**Q: Do I need to login every time?**
A: No! Login once, cookies are saved. Next runs skip login automatically.

**Q: How long do cookies last?**
A: Typically several weeks. Scraper automatically re-logins when cookies expire.

**Q: Can I use this in production?**
A: Yes! Designed for production use with cookie persistence and error handling.

**Q: What if I get rate limited?**
A: Reduce concurrent tabs (default: 3) or add more delays between batches.

**Q: Why two-phase (login + scraping)?**
A: Login needs visible browser (non-headless) for CAPTCHA, scraping is faster headless.
