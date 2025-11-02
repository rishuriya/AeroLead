# ScaleScribe - Multi-Feature Marketing Automation Platform

<div align="center">

[![Ruby on Rails](https://img.shields.io/badge/Ruby_on_Rails-7.1-CC0000?style=flat&logo=ruby-on-rails)](https://rubyonrails.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=node.js)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat&logo=redis)](https://redis.io/)

**A comprehensive marketing automation platform combining automated phone calling, AI-powered blog generation, and intelligent LinkedIn profile scraping.**

🚀 **[Live Demo](https://autodialer-web-699583939041.us-central1.run.app/)** | [Features](#-features) • [Architecture](#-architecture) • [How It Works](#-how-it-works) • [Setup](#-quick-start) • [Limitations](#-current-limitations) • [Roadmap](#-future-enhancements)

</div>

---

## 📋 Table of Contents

- [What It Does](#-what-it-does)
- [Features](#-features)
- [Architecture](#-architecture)
- [How It Works](#-how-it-works)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
- [Current Limitations](#-current-limitations)
- [Future Enhancements](#-future-enhancements)
- [Tech Stack](#-tech-stack)
- [Documentation](#-documentation)

---

## 🎯 What It Does

ScaleScribe is a unified marketing automation platform that solves three critical business needs:

### 1. **Automated Phone Calling (Autodialer)**
Make bulk automated phone calls with custom voice messages. Upload CSV files with hundreds of phone numbers and send personalized messages to all contacts simultaneously. Perfect for:
- Marketing campaigns
- Appointment reminders
- Event notifications
- Survey campaigns

### 2. **AI-Powered Blog Generation**
Generate high-quality, SEO-optimized blog content at scale using AI (Gemini Flash). Create multiple articles simultaneously with:
- Custom word counts (300-3000 words)
- Context-aware content
- Automatic SEO optimization
- Batch processing for up to 20 articles

### 3. **Intelligent LinkedIn Profile Scraping**
Extract comprehensive professional information from LinkedIn profiles using an innovative hybrid scraping approach. The scraper:
- Handles LinkedIn's authentication and CAPTCHA challenges
- Preserves content hierarchy during extraction
- Uses AI to structure the scraped data
- Processes multiple profiles in batches

---

## ✨ Features

### 📞 Autodialer
- **Bulk Processing:** Upload CSV files or paste multiple phone numbers
- **Custom Messages:** Personalized voice messages (up to 500 characters)
- **Real-time Tracking:** Monitor call status (Queued, Ringing, Completed, Failed)
- **Background Processing:** Asynchronous calling with Sidekiq
- **Webhook Integration:** Real-time updates via Twilio webhooks
- **Analytics:** Success rates, call duration, detailed logs
- **⚠️ Free Tier Limitation:** Only verified phone numbers can be called (verify in [Twilio Console](https://console.twilio.com/us1/develop/phone-numbers/manage/verified))

### ✍️ AI Blog Generator
- **Bulk Generation:** Create up to 20 articles simultaneously
- **Customizable:** Adjustable word count and custom context
- **SEO-Optimized:** Auto-generated meta descriptions and excerpts
- **Smart Processing:** Asynchronous generation with status tracking

### 🔍 LinkedIn Scraper (The Beast)
This is the most sophisticated feature, using a **hybrid approach** that balances memory efficiency with functionality:

#### What Makes It Special:
- **Hybrid Authentication:** Opens browser only for login, then reuses cookies
- **Modular Architecture:** Clean, maintainable codebase split into focused modules:
  - `browser.js` - Browser initialization and cookie management
  - `login.js` - Authentication and CAPTCHA handling
  - `extraction.js` - HTML-to-markdown conversion and AI parsing
  - `scraper.js` - Main orchestrator class
  - `cli.js` - Command-line interface
  - `utils.js` - Utility functions
- **Intelligent Data Extraction:**
  - Fetches complete DOM structure
  - Filters out styling, links, and HTML artifacts
  - Converts HTML to clean markdown while **preserving hierarchy** (critical for understanding context)
  - Uses Gemini Flash to structure the raw data into meaningful profiles
  - **Smart Text Normalization:** Automatically fixes corrupted text (e.g., "SDESDE" → "Software Development Engineer")
  - **Intelligent Cleaning:** Expands abbreviations, removes duplicates, fixes OCR errors
- **Comprehensive Data Capture:**
  - Full name, headline, current position
  - Complete work experience history with hierarchy (timeline view in UI)
  - Education background
  - Skills (all + top skills)
  - Contact information (when available)
  - **Profile image** (not cover image) with aspect ratio detection
  - Connections count and pronouns
- **Cookie Management:** Saves LinkedIn session cookies after initial login, enabling:
  - Fast subsequent scraping without repeated logins
  - Lower memory footprint
  - Reduced detection risk

---

## 🏗 Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         ScaleScribe Platform                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────┐    ┌──────────────────┐   ┌─────────────┐ │
│  │  Ruby on Rails  │───▶│   PostgreSQL     │   │    Redis    │ │
│  │   Web Server    │    │     Database     │   │   Cache &   │ │
│  │   (Puma)        │    │                  │   │   Queues    │ │
│  └────────┬────────┘    └──────────────────┘   └──────┬──────┘ │
│           │                                              │        │
│           │              ┌───────────────────────────────┘        │
│           │              │                                        │
│  ┌────────▼──────────────▼──────────┐                           │
│  │       Sidekiq Workers             │                           │
│  │  (Background Job Processing)      │                           │
│  │  • Concurrency: 3 (dev) / 10 (prod)                          │
│  └────┬──────────┬──────────┬───────┘                           │
│       │          │          │                                    │
│  ┌────▼────┐┌───▼──────┐┌──▼───────────────────┐              │
│  │ Twilio  ││ Gemini   ││ LinkedIn Scraper      │              │
│  │   API   ││   AI     ││ (Puppeteer/Node.js)   │              │
│  └─────────┘└──────────┘└───────────────────────┘              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Component Architecture

#### 1. Web Layer (Rails + Puma)
- Handles HTTP requests
- Manages user interface
- Queues jobs to Sidekiq
- Polls for job status updates

#### 2. Job Processing Layer (Sidekiq + Redis)
- Processes background jobs asynchronously
- Manages job queues and retries
- Current configuration:
  - **Development:** 3 concurrent workers
  - **Production:** 10 concurrent workers
  - **Retry logic:** 3 attempts with 5-minute delays

#### 3. External Services Integration
- **Twilio API:** Phone calling
- **Gemini Flash:** AI content generation and LinkedIn data structuring
- **Puppeteer/Node.js:** LinkedIn browser automation

---

## 🔧 How It Works

### Autodialer Flow

```
User Input (CSV/Manual)
    ↓
Controller validates phone numbers
    ↓
Creates PhoneCall records (status: pending)
    ↓
Queues TwilioJob for each number
    ↓
Sidekiq Worker picks up job
    ↓
Calls Twilio API
    ↓
Twilio makes phone call
    ↓
Webhook updates status (ringing → in-progress → completed)
    ↓
UI polls and displays real-time updates
```

**Note:** On free tier, calls only work with verified numbers.

### Blog Generation Flow

```
User inputs titles + word count + context
    ↓
Controller creates BlogPost records (status: pending)
    ↓
Queues BlogGenerationJob for each title
    ↓
Sidekiq Worker picks up job
    ↓
Calls Gemini Flash API with prompt
    ↓
Gemini generates content (fast processing)
    ↓
Parses and saves structured content
    ↓
Updates status to completed
    ↓
UI polls and displays generated articles
```

**Batch Processing:** Up to 20 articles can be generated simultaneously, limited by Sidekiq worker concurrency.

### LinkedIn Scraper Flow (Hybrid Approach)

This is the most complex feature. Here's the detailed workflow:

#### Phase 1: Initial Login (One-time Setup)
```
User requests scraping
    ↓
Check for .linkedin_cookies.json
    ↓
If no cookies found:
    ┌──────────────────────────────────┐
    │ BROWSER OPENS (Puppeteer)        │
    │ • Navigates to LinkedIn login    │
    │ • User enters credentials        │
    │ • If CAPTCHA: User solves manually│
    │ • Saves session cookies to file  │
    │ • BROWSER CLOSES                 │
    └──────────────────────────────────┘
    ↓
Cookies saved for future use
```

#### Phase 2: Scraping (Cookie-based, Modular Architecture)
```
User submits LinkedIn URLs (single/bulk/CSV)
    ↓
Controller creates LinkedinProfile records
    ↓
Queues BatchLinkedinScrapingJob (groups of profiles)
    ↓
Sidekiq Worker picks up batch (max 3 concurrent)
    ↓
For each URL in batch:
    ┌──────────────────────────────────────────┐
    │ BROWSER OPENS (with saved cookies)       │
    │ • browser.js: Loads cookies, initializes │
    │ • login.js: Handles authwall/checkpoint   │
    │ • Navigates to profile URL                │
    │ • extraction.js:                         │
    │   - Converts HTML to clean markdown       │
    │   - Preserves hierarchy (critical!)       │
    │   - Filters out sidebars, suggestions     │
    │   - Extracts profile image (not cover)     │
    │ • BROWSER CLOSES                         │
    └──────────────────────────────────────────┘
    ↓
Clean markdown sent to Gemini Flash
    ↓
extraction.js: Gemini AI structures data with normalization:
    • name, headline, location
    • current position & company (normalized text)
    • work experience (fixed duplicates, expanded abbreviations)
    • education
    • skills (top + all)
    • about section
    • profile_image_url (correct image)
    ↓
Structured data saved to database
    ↓
Status updated: scraping → completed
    ↓
UI polls and displays scraped profiles (with timeline view)
```

#### Why Hierarchy Preservation is Critical

The scraper extracts text like this:
```
Experience
├── Software Engineer at Google
│   ├── June 2020 - Present
│   ├── Led development of...
│   └── Managed team of 5
├── Junior Developer at Startup
│   ├── Jan 2018 - May 2020
│   └── Built features for...
```

If hierarchy is lost, Gemini can't properly associate job descriptions with positions, leading to garbled data.

#### Current Implementation Trade-offs

**Memory vs Speed Trade-off:**
- **Current:** Opens and closes browser for EACH profile
  - ✅ Lower memory usage (~200MB per scrape)
  - ❌ Slower (browser startup overhead)
  - ✅ More stable (each scrape is isolated)

- **Alternative (Future):** Keep browser open for batch
  - ✅ Faster (no startup overhead)
  - ❌ Higher memory usage (2-4GB)
  - ❌ Risk of memory leaks on long sessions

**Why This Approach?**
- Running on free tier with limited resources
- Stability over speed (avoids crashes)
- Easier to handle errors (each scrape is independent)

---

## 📁 Project Structure

```
ScaleScribe/
├── Autodialer-app/              # Main Rails application
│   ├── app/
│   │   ├── controllers/         # HTTP request handlers
│   │   ├── models/              # Database models & business logic
│   │   ├── jobs/                # Sidekiq background jobs
│   │   │   ├── twilio_job.rb
│   │   │   ├── blog_generation_job.rb
│   │   │   └── batch_linkedin_scraping_job.rb
│   │   ├── services/            # External API integrations
│   │   │   ├── twilio_service.rb
│   │   │   ├── gemini_service.rb
│   │   │   └── linkedin_scraper_service.rb
│   │   └── views/               # UI templates
│   ├── config/
│   │   ├── sidekiq.yml          # Worker concurrency config
│   │   ├── database.yml         # PostgreSQL config
│   │   └── initializers/        # App initialization
│   ├── db/
│   │   ├── migrate/             # Database migrations
│   │   └── schema.rb            # Database schema
│   ├── lib/
│   │   └── linkedin_scraper/    # Integrated Puppeteer scraper (Modular)
│   │       ├── puppeteer_scraper.js  # Compatibility wrapper (~30 lines)
│   │       ├── scraper.js        # Main orchestrator class
│   │       ├── browser.js        # Browser initialization & cookies
│   │       ├── login.js          # Authentication & CAPTCHA
│   │       ├── extraction.js     # HTML-to-markdown & AI parsing
│   │       ├── cli.js            # Command-line interface
│   │       ├── utils.js          # Utility functions
│   │       ├── package.json
│   │       └── .linkedin_cookies.json  # Session cookies
│   └── README.md                # Detailed app documentation
├── Blog-generator/              # Standalone Python blog generator
│   ├── blog_generator.py        # Main CLI tool
│   ├── ai_service.py           # Gemini & OpenAI services
│   ├── config.py               # Configuration
│   ├── output/                 # Generated articles
│   └── README.md               # Blog generator docs
├── Linkedin-scrapper/           # Standalone LinkedIn scraper (Modular)
│   ├── puppeteer_scraper.js    # Compatibility wrapper (~30 lines)
│   ├── scraper.js               # Main orchestrator class
│   ├── browser.js               # Browser initialization & cookies
│   ├── login.js                 # Authentication & CAPTCHA
│   ├── extraction.js            # HTML-to-markdown & AI parsing
│   ├── cli.js                   # Command-line interface
│   ├── utils.js                 # Utility functions
│   ├── linkedin_scraper_puppeteer.py  # Python wrapper
│   ├── config.py                # Python config
│   └── README.md               # Scraper docs
│
├── render.yaml                  # Deployment configuration
│   └── Services:
│       ├── autodialer-web       # Rails + Puma
│       ├── autodialer-sidekiq   # Background workers
│       ├── PostgreSQL database
│       └── Redis instance
│
└── README.md                    # This file
```

### Key Files

| File | Purpose |
|------|---------|
| `Autodialer-app/app/services/linkedin_scraper_service.rb` | Rails service that calls Node.js scraper |
| `Autodialer-app/lib/linkedin_scraper/puppeteer_scraper.js` | Compatibility wrapper (~30 lines) - delegates to modules |
| `Autodialer-app/lib/linkedin_scraper/scraper.js` | Main LinkedInScraper orchestrator class |
| `Autodialer-app/lib/linkedin_scraper/browser.js` | Browser initialization, cookie management |
| `Autodialer-app/lib/linkedin_scraper/login.js` | Authentication, CAPTCHA solving |
| `Autodialer-app/lib/linkedin_scraper/extraction.js` | HTML-to-markdown conversion, Gemini AI parsing, profile image extraction |
| `Autodialer-app/lib/linkedin_scraper/cli.js` | Command-line interface |
| `Autodialer-app/app/jobs/batch_linkedin_scraping_job.rb` | Batch processing logic for LinkedIn profiles |
| `Autodialer-app/config/sidekiq.yml` | Worker concurrency configuration |
| `render.yaml` | Multi-service deployment config |

---

## 🚀 Quick Start

### Prerequisites
- Ruby 3.4.1
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Chrome/Chromium (for LinkedIn scraping)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd ScaleScribe

# Navigate to main app
cd Autodialer-app

# Install dependencies
bundle install
npm install

# Setup LinkedIn scraper
cd lib/linkedin_scraper
npm install
cd ../..

# Configure environment
cp .env.example .env
# Edit .env and add your API keys

# Setup database
rails db:create db:migrate

# Start services (3 terminals)
rails server              # Terminal 1
bundle exec sidekiq       # Terminal 2
redis-server              # Terminal 3

# Access application
open http://localhost:3000
```

### First-Time LinkedIn Setup

```bash
cd Autodialer-app/lib/linkedin_scraper

# Login and save cookies (manual CAPTCHA solving)
node puppeteer_scraper.js login-only --no-headless

# Test scraping
node puppeteer_scraper.js scrape https://www.linkedin.com/in/example
```

For detailed setup instructions, see [Autodialer-app/README.md](./Autodialer-app/README.md).

---

## ⚠️ Current Limitations

### 1. LinkedIn Scraper Performance

**Issue:** Browser opens and closes for EACH profile
- **Impact:** Scraping 10 profiles takes 5-6 minutes
- **Why:** Memory optimization for free tier hosting
- **Trade-off:** Sacrificing speed for stability and lower resource usage

**Flow for 10 profiles:**
```
For i = 1 to 10:
    Open browser (2-3 seconds)
    Navigate to profile (2-3 seconds)
    Scrape DOM (3-5 seconds)
    Extract text (1-2 seconds)
    Close browser (1 second)
    Call Gemini API (2-3 seconds)
    Save to database (1 second)
= ~15-20 seconds per profile
= ~5-6 minutes for 10 profiles
```

### 2. Worker Concurrency

**Issue:** Only 3 concurrent workers in development
- **Config:** `Autodialer-app/config/sidekiq.yml`
- **Impact:**
  - Only 3 profiles can be scraped simultaneously
  - Other jobs (calls, blogs) wait in queue
- **Production:** Increases to 10 workers

### 3. Sequential API Processing

**Issue:** API calls happen only once at the end
- **Impact:** Users must wait for entire batch to complete
- **Example:** For 10 profiles, user sees no results for 5-6 minutes, then all 10 at once
- **Better approach (future):** Stream results as each profile completes

### 4. Twilio Free Tier Restrictions

**Issue:** Can only call verified phone numbers
- **Limitation:** Must manually verify each number in [Twilio Console](https://console.twilio.com/us1/develop/phone-numbers/manage/verified)
- **Impact:** Not suitable for large-scale calling without paid plan
- **Workaround:** Verify numbers before calling (one-time setup per number)
- **Upgrade Path:** Upgrade to paid Twilio plan to call unverified numbers

### 5. Browser Reinstantiation Overhead

**Issue:** Puppeteer browser setup/teardown is expensive
- **Current:** ~3 seconds per open/close cycle
- **Optimization potential:** Keep browser alive for batch = save ~3s per profile

### 6. No Progressive UI Updates

**Issue:** UI only polls when all jobs complete
- **Impact:** User doesn't see individual profile completions
- **Better approach:** WebSocket for real-time updates

---

## 🚀 Future Enhancements

### High Priority

#### 1. Stream Results to User

**Current:**
```
Batch completes → Return all results → Update UI
```

**Improved:**
```
Profile 1 completes → Update UI
Profile 2 completes → Update UI
...
Profile 10 completes → Update UI
```

**Implementation:**
- Use Action Cable (WebSockets) for real-time updates
- Broadcast job completion events
- Update UI incrementally

#### 2. Increase Worker Concurrency

**Change:** `config/sidekiq.yml`
```yaml
development:
  :concurrency: 5  # Up from 3
production:
  :concurrency: 15 # Up from 10
```

**Impact:** More parallel processing = faster completion

### Medium Priority

#### 3. Improve UI/UX

**Current Issues:**
- Basic polling mechanism
- No progress indicators during long operations
- Limited real-time feedback

**Enhancements:**
- Real-time progress bars showing:
  - Profiles scraped / total
  - Current profile being processed
  - Estimated time remaining
- Live status updates without polling
- Better error messaging
- Dark mode


#### 4. Batch Optimization

**Current:** Fixed batch size (all profiles in one job)

**Improved:** Dynamic batching
```ruby
# Split into optimal chunks
profiles.in_batches(of: 5) do |batch|
  BatchLinkedinScrapingJob.perform_later(batch.ids)
end
```

**Benefits:**
- Better resource utilization
- Faster failure recovery
- Progressive results

### Low Priority

#### 5. Advanced Features

- **LinkedIn scraper rate limiting:** Avoid detection
- **Proxy support:** Rotate IPs for scraping
- **Export functionality:** Download scraped data as CSV/JSON
- **Scheduled scraping:** Periodic profile updates
- **API authentication:** Secure public API
- **Multi-user support:** User accounts and permissions

#### 6. Monitoring & Analytics

- **Scraper performance metrics:**
  - Average scrape time per profile
  - Success/failure rates
  - Error categorization
- **Resource monitoring:**
  - Memory usage tracking
  - CPU utilization
  - Job queue depth
- **Alerting:**
  - Failed job notifications
  - System health checks

---

## 🛠 Tech Stack

### Backend
- **Ruby on Rails 7.1** - Web framework
- **Ruby 3.4.1** - Language
- **PostgreSQL 15** - Primary database
- **Redis 7** - Cache & job queues
- **Sidekiq 7** - Background job processing

### Frontend
- **Bootstrap 5** - UI framework
- **JavaScript (Vanilla)** - Client-side logic
- **Turbo Rails** - SPA-like navigation
- **Polling** - Status updates (WebSockets planned)

### External Services
- **Twilio API** - Phone calling
- **Google Gemini Flash** - AI content generation & LinkedIn parsing
  - **Why Gemini Flash?** Fast processing, good quality, cost-effective
- **OpenAI** (optional) - Alternative AI model
- **Anthropic Claude** (optional) - Alternative AI model

### Scraping & Automation
- **Puppeteer (Node.js)** - Headless Chrome automation
- **Chrome/Chromium** - Browser engine
- **Cookie persistence** - Session management

### Infrastructure
- **Render.com** - Cloud hosting
- **Docker** - Containerization (GCP deployment)
- **Puma** - Web server

---

## 📚 Documentation

### Detailed Documentation
- **[Autodialer-app README](./Autodialer-app/README.md)** - Comprehensive app documentation
  - API documentation
  - Detailed setup instructions
  - Configuration guide
  - Usage examples
  - Troubleshooting

### Quick Links
- [Installation Guide](./Autodialer-app/README.md#-installation)
- [API Documentation](./Autodialer-app/README.md#-api-documentation)
- [LinkedIn Scraper Setup](./Autodialer-app/README.md#linkedin-scraper-setup)
- [Deployment Guide](./Autodialer-app/README.md#-deployment)

---

## 🤝 Contributing

Contributions are welcome! Here's how the codebase is organized:

### Key Areas for Contribution

1. **LinkedIn Scraper Optimization** (`Autodialer-app/lib/linkedin_scraper/`)
   - Implement persistent browser sessions
   - Add parallel processing
   - Improve error handling

2. **Real-time Updates** (`Autodialer-app/app/channels/`)
   - Replace polling with WebSockets
   - Add progress tracking

3. **UI Improvements** (`Autodialer-app/app/views/`)
   - Better progress indicators
   - Dark mode
   - Mobile responsiveness

4. **Job Processing** (`Autodialer-app/app/jobs/`)
   - Dynamic batching
   - Better retry logic
   - Resource optimization

### Development Workflow

```bash
# Fork repository
git checkout -b feature/your-feature

# Make changes
# Test locally
bundle exec rspec  # Run tests
rubocop            # Check code style

# Commit and push
git commit -m "feat: your feature description"
git push origin feature/your-feature

# Create pull request
```

---

## 🔒 Security Considerations

### Implemented
- Environment variables for API keys
- CSRF protection (Rails default)
- SQL injection prevention (ActiveRecord)
- Input validation and sanitization

### TODO (Future)
- Rate limiting on API endpoints
- User authentication & authorization
- LinkedIn scraping IP rotation
- Encrypted credential storage
- API key rotation
- Audit logging

---

## 📊 Performance Benchmarks

### Current Performance (Free Tier)

| Feature | Metric | Value |
|---------|--------|-------|
| Phone Calls | Single call | 2-3 seconds |
| Phone Calls | Bulk (100) | ~5 minutes |
| Blog Posts | Single article (1000 words) | 15-20 seconds |
| Blog Posts | Bulk (20) | ~6-8 minutes |
| LinkedIn | Single profile | 15-20 seconds |
| LinkedIn | Batch (10) | 5-6 minutes |

### Expected Performance (After Optimization)

| Feature | Metric | Current | Optimized | Improvement |
|---------|--------|---------|-----------|-------------|
| LinkedIn | Single profile | 15-20s | 8-10s | 50% faster |
| LinkedIn | Batch (10) | 5-6 min | 1-2 min | 70% faster |
| LinkedIn | Batch (100) | 50-60 min | 10-15 min | 75% faster |

---

## 🎓 Learning Resources

### Understanding the Codebase

1. **Start with controllers:** `Autodialer-app/app/controllers/`
2. **Check the jobs:** `Autodialer-app/app/jobs/`
3. **Review services:** `Autodialer-app/app/services/`
4. **Study the scraper:** `Autodialer-app/lib/linkedin_scraper/` (modular structure):
   - `scraper.js` - Main orchestrator
   - `browser.js` - Browser & cookies
   - `login.js` - Authentication
   - `extraction.js` - Data extraction & AI parsing

### Key Concepts
- **Sidekiq:** Background job processing
- **Puppeteer:** Headless browser automation
- **Modular Architecture:** Clean separation of concerns (browser, login, extraction)
- **Cookie-based auth:** Session persistence across scrapes
- **HTML-to-markdown:** Clean text extraction with hierarchy preservation
- **AI structuring:** Gemini Flash for intelligent data parsing
- **Text normalization:** Automatic correction of corrupted text (e.g., "SDESDE" → "Software Development Engineer")
- **Profile image detection:** Aspect ratio filtering to exclude cover images

---

## 📞 Support

For issues or questions:
- **GitHub Issues:** [Report bugs or request features]
- **Documentation:** Check [Autodialer-app README](./Autodialer-app/README.md)
- **Code:** Read inline comments in key files

---

## 📄 License

This project is licensed under the MIT License.

---

## 🙏 Acknowledgments

- **Twilio** - Phone calling API
- **Google Gemini** - AI content generation & LinkedIn parsing
- **Puppeteer** - Web scraping automation
- **Ruby on Rails** - Web framework
- **Sidekiq** - Background job processing
- **PostgreSQL** - Database
- **Redis** - Caching & queues

---

## 📈 Project Status

**Version:** 1.0.0
**Last Updated:** November 2024
**Deployment:** 🚀 **[Live on Google Cloud Run](https://autodialer-web-699583939041.us-central1.run.app/)**

### Production Deployment
- **Platform:** Google Cloud Platform (GCP)
- **Service:** Cloud Run (us-central1)
- **Web URL:** https://autodialer-web-699583939041.us-central1.run.app/
- **Database:** Cloud SQL (PostgreSQL 15)
- **Cache:** Memorystore (Redis 7)
- **Worker:** Cloud Run (Sidekiq with Puppeteer)

### Recent Changes
- ✅ LinkedIn scraper **modularized** into clean, maintainable modules
- ✅ **Smart text normalization** - fixes corrupted text (e.g., "SDESDE" → "Software Development Engineer")
- ✅ **Profile image extraction** - correctly extracts profile pictures (not cover images)
- ✅ **Experience timeline view** - beautiful visual timeline in UI
- ✅ Sidekiq concurrency optimized
- ✅ Cookie-based authentication implemented
- ✅ Gemini Flash integration for AI parsing with intelligent cleaning
- ✅ Batch processing for all features
- ✅ HTML-to-markdown conversion for cleaner extraction
- ✅ Deployed to Google Cloud Run
- ✅ Production deployment with Cloud SQL and Memorystore

---

**Built with ❤️ for ScaleScribes Technical Assessment**

*A comprehensive marketing automation platform powered by Ruby on Rails, Node.js, and AI.*
