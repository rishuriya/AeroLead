# 🚀 Autodialer with AI Blog Generator & LinkedIn Scraper

A comprehensive Ruby on Rails application that combines automated phone calling, AI-powered blog content generation, and LinkedIn profile scraping capabilities. Built for ScaleScribes Technical Assessment.

[![Ruby on Rails](https://img.shields.io/badge/Ruby_on_Rails-7.1-CC0000?style=flat&logo=ruby-on-rails)](https://rubyonrails.org/)
[![Ruby Version](https://img.shields.io/badge/Ruby-3.4.1-red?style=flat&logo=ruby)](https://www.ruby-lang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![Sidekiq](https://img.shields.io/badge/Sidekiq-7.0-B1003E?style=flat)](https://sidekiq.org/)

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Deployment](#-deployment)
- [Architecture](#-architecture)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### 📞 1. Automated Phone Calling (Autodialer)

Make automated phone calls with custom messages using Twilio API.

**Key Features:**
- **Bulk Calling:** Upload CSV files or paste multiple phone numbers
- **Custom Messages:** Set personalized voice messages for each campaign
- **Real-time Status Tracking:** Monitor call status (Queued, Ringing, Completed, Failed)
- **Retry Logic:** Automatic retry for failed calls
- **Analytics Dashboard:** View success rates, call duration, and detailed logs
- **Webhook Integration:** Real-time updates via Twilio webhooks
- **Call Logs:** Comprehensive history with filters and search
- **Background Processing:** Asynchronous job processing with Sidekiq

**Supported Call Statuses:**
- Queued
- Ringing
- In-Progress
- Completed
- Failed
- Busy
- No Answer
- Canceled

### ✍️ 2. AI-Powered Blog Generator

Generate high-quality blog content using AI models (Gemini, OpenAI, Anthropic).

**Key Features:**
- **Multiple AI Models:** Gemini (primary), OpenAI GPT, Anthropic Claude
- **Bulk Generation:** Generate up to 20 articles simultaneously
- **Customizable Word Count:** 300-3000 words per article
- **Context-Aware:** Add custom context for more relevant content
- **Auto-SEO Optimization:** Automatic excerpt generation and meta descriptions
- **Status Management:** Draft, Published, Archived workflows
- **Reading Time Calculation:** Automatic reading time estimation
- **Slug Generation:** SEO-friendly URL slugs
- **Background Jobs:** AI generation runs asynchronously via Sidekiq

**Supported AI Models:**
- Google Gemini 2.5 Flash (default)
- OpenAI GPT-4/GPT-3.5
- Anthropic Claude (optional)

### 🔍 3. LinkedIn Profile Scraper

Scrape LinkedIn profiles to extract professional information using Puppeteer.

**Key Features:**
- **Bulk Scraping:** Process multiple LinkedIn profiles simultaneously
- **AI-Powered Extraction:** Uses Gemini AI to parse profile content
- **Cookie Persistence:** Maintains login sessions across scrapes
- **Batch Processing:** Efficient batch scraping with single browser instance
- **Real-time Updates:** Live status updates during scraping
- **Retry Mechanism:** Automatic retry for failed profiles
- **Detailed Data Extraction:**
  - Full name and headline
  - Current position and company
  - Location and about section
  - Complete work experience history
  - Education background
  - Skills (all skills + top skills)
  - Contact information (when available)
  - Profile image URL
  - Connections count
  - Pronouns

**Scraping Methods:**
- Single URL input
- Bulk paste (multiple URLs)
- CSV file upload

**Status Tracking:**
- Pending
- Scraping
- Completed
- Failed (with error messages)

### 📊 4. Analytics & Reporting

Comprehensive analytics across all features.

**Available Metrics:**
- **Phone Calls:** Success rate, total calls, pending, completed, failed
- **Blog Posts:** Total articles, published, drafts, archived
- **LinkedIn Profiles:** Success rate, total scraped, pending, completed
- **Time-based Analysis:** Daily, weekly, monthly trends
- **Performance Metrics:** Average call duration, scraping time, generation time

### 🎨 5. Modern UI/UX

Beautiful, responsive interface with real-time updates.

**UI Features:**
- **Responsive Design:** Works on desktop, tablet, and mobile
- **Real-time Polling:** Auto-refresh when jobs are active
- **Smart Polling:** Doesn't interrupt user input
- **Modern Styling:** Clean, professional design with Bootstrap 5
- **Status Badges:** Color-coded status indicators
- **Loading States:** User feedback during operations
- **Flash Messages:** Success/error notifications

---

## 🛠 Tech Stack

### Backend
- **Ruby on Rails 7.1** - Web application framework
- **Ruby 3.4.1** - Programming language
- **PostgreSQL 15** - Primary database
- **Redis 7** - Cache & Sidekiq queue storage
- **Sidekiq 7** - Background job processing

### Frontend
- **Bootstrap 5** - CSS framework
- **JavaScript (Vanilla)** - Client-side interactions
- **jQuery 3.7** - DOM manipulation
- **Turbo Rails** - SPA-like navigation
- **Stimulus** - JavaScript framework

### APIs & Services
- **Twilio API** - Phone calling service
- **Google Gemini AI** - Content generation & profile parsing
- **OpenAI API** - Alternative AI model (optional)
- **Anthropic Claude** - Alternative AI model (optional)

### Scraping & Automation
- **Puppeteer (Node.js)** - Headless browser for LinkedIn scraping
- **Chrome/Chromium** - Browser engine

### Development Tools
- **RuboCop** - Ruby code linter
- **Brakeman** - Security scanner
- **Kaminari** - Pagination
- **Phonelib** - Phone number validation
- **Faraday** - HTTP client

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

### Required
- **Ruby 3.4.1** ([Install Ruby](https://www.ruby-lang.org/en/documentation/installation/))
- **Rails 7.1+** (`gem install rails`)
- **PostgreSQL 15+** ([Install PostgreSQL](https://www.postgresql.org/download/))
- **Redis 7+** ([Install Redis](https://redis.io/download))
- **Node.js 18+** ([Install Node.js](https://nodejs.org/))
- **Bundler** (`gem install bundler`)

### For LinkedIn Scraping (Optional)
- **Chrome/Chromium browser**
- **npm/yarn** for Puppeteer dependencies

### API Keys Required
- **Twilio Account** ([Sign up](https://www.twilio.com/try-twilio))
  - Account SID
  - Auth Token
  - Twilio Phone Number
- **Google Gemini API Key** ([Get API Key](https://makersuite.google.com/app/apikey))
- **OpenAI API Key** (optional) ([Get API Key](https://platform.openai.com/api-keys))

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/autodialer-app.git
cd autodialer-app
```

### 2. Install Dependencies

```bash
# Install Ruby gems
bundle install

# Install Node packages (for asset compilation)
npm install
# or
yarn install
```

### 3. Set Up LinkedIn Scraper (Optional)

The LinkedIn scraper is integrated in `lib/linkedin_scraper/`. Dependencies are automatically installed during Docker builds. For local development:

```bash
cd lib/linkedin_scraper
npm install
cd ../..
```

### 4. Configure Database

```bash
# Create database
rails db:create

# Run migrations
rails db:migrate

# Optional: Seed sample data
rails db:seed
```

### 5. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```bash
# Twilio
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890

# Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Database
DATABASE_URL=postgresql://localhost/autodialer_development

# Redis
REDIS_URL=redis://localhost:6379/0

# Rails
RAILS_MASTER_KEY=df1b1c9524505387d155a55e2dc16883
```

### 6. Start the Application

**Option A: All services together**

```bash
# Terminal 1: Rails server
rails server

# Terminal 2: Sidekiq worker
bundle exec sidekiq

# Terminal 3: Redis (if not running as service)
redis-server
```

**Option B: Using Procfile (Foreman)**

```bash
gem install foreman
foreman start
```

### 7. Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

---

## ⚙️ Configuration

### Environment Variables

All configuration is done via environment variables. See `.env.example` for a complete list.

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | `your_auth_token` |
| `TWILIO_PHONE_NUMBER` | Your Twilio phone number | `+15551234567` |
| `GEMINI_API_KEY` | Google Gemini API key | `AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXX` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://localhost/db_name` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |

#### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | - |
| `ANTHROPIC_API_KEY` | Anthropic API key | - |
| `LINKEDIN_SCRAPER_PATH` | Path to scraper directory | `lib/linkedin_scraper` |
| `MAX_PHONE_NUMBERS_PER_BATCH` | Max numbers per batch | `100` |
| `MAX_BULK_ARTICLES` | Max articles per generation | `20` |
| `WEB_CONCURRENCY` | Puma workers | `2` |
| `RAILS_MAX_THREADS` | Puma threads | `5` |

### Twilio Webhooks

Configure these webhook URLs in your Twilio console:

- **Status Callback:** `https://your-domain.com/webhooks/twilio/status`
- **Voice Callback:** `https://your-domain.com/webhooks/twilio/voice`

### LinkedIn Scraper Setup

The scraper is integrated in `lib/linkedin_scraper/`. For local development:

1. Navigate to scraper directory:
```bash
cd lib/linkedin_scraper
```

2. Install dependencies:
```bash
npm install
```

3. First-time login (saves cookies):
```bash
node puppeteer_scraper.js login-only --no-headless
```

4. Test scraping:
```bash
node puppeteer_scraper.js scrape https://www.linkedin.com/in/example
```

---

## 📖 Usage

### 1. Autodialer - Making Phone Calls

#### Via Web Interface

1. Navigate to **Autodialer** page
2. Choose input method:
   - **Manual Entry:** Paste phone numbers (one per line)
   - **CSV Upload:** Upload a CSV file with `phone_number` column
3. Enter your message (max 500 characters)
4. Click **"Start Calling"**
5. Monitor progress in **Call Logs**

#### Via API

```bash
# Make a single call
curl -X POST http://localhost:3000/api/v1/phone_calls \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+15551234567",
    "message": "This is a test call"
  }'

# Bulk calls
curl -X POST http://localhost:3000/api/v1/phone_calls/bulk_create \
  -H "Content-Type: application/json" \
  -d '{
    "phone_numbers": ["+15551234567", "+15557654321"],
    "message": "Bulk test call"
  }'
```

### 2. Blog Generator - Creating AI Content

#### Via Web Interface

1. Navigate to **Generate Blog** page
2. Enter blog titles (one per line)
3. Set word count (300-3000 words)
4. Add optional context
5. Click **"Generate Articles"**
6. View generated posts in **Blog Posts** page

#### Via API

```bash
# Generate a single blog post
curl -X POST http://localhost:3000/api/v1/blog_posts/generate \
  -H "Content-Type: application/json" \
  -d '{
    "title": "10 Benefits of Daily Exercise",
    "word_count": 1000,
    "context": "Focus on mental health benefits"
  }'

# Get all blog posts
curl http://localhost:3000/api/v1/blog_posts
```

### 3. LinkedIn Scraper - Extracting Profiles

#### Via Web Interface

1. Navigate to **LinkedIn Scraper** page
2. Click **"Add LinkedIn Profiles"**
3. Choose input method:
   - **Single URL:** Enter one profile URL
   - **Bulk Paste:** Multiple URLs (one per line)
   - **CSV Upload:** Upload file with URLs
4. Click **"Start Scraping"**
5. Monitor progress in **LinkedIn Profiles** page

#### Via Command Line

```bash
# Scrape a single profile
cd lib/linkedin_scraper
node puppeteer_scraper.js scrape https://www.linkedin.com/in/example

# Scrape multiple profiles
node puppeteer_scraper.js scrape https://linkedin.com/in/profile1 https://linkedin.com/in/profile2
```

#### Via Rails Console

```bash
rails console

# Queue a profile for scraping
profile = LinkedinProfile.create!(profile_url: "https://www.linkedin.com/in/example")
BatchLinkedinScrapingJob.perform_later([profile.id])

# Check status
profile.reload.status # => "pending", "scraping", "completed", or "failed"

# View scraped data
profile.name
profile.headline
profile.experience_list
```

### 4. Monitoring Background Jobs

Access the Sidekiq dashboard:

```
http://localhost:3000/sidekiq
```

Features:
- View active jobs
- Monitor queue sizes
- Retry failed jobs
- View job history

---

## 🔌 API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication
Currently, the API is unauthenticated. Add authentication for production use.

### Endpoints

#### Phone Calls

##### Get All Calls
```http
GET /api/v1/phone_calls
```

**Response:**
```json
{
  "phone_calls": [
    {
      "id": 1,
      "phone_number": "+15551234567",
      "status": "completed",
      "message": "Test call",
      "duration": 45,
      "called_at": "2025-11-01T10:30:00Z"
    }
  ]
}
```

##### Create Call
```http
POST /api/v1/phone_calls
Content-Type: application/json

{
  "phone_number": "+15551234567",
  "message": "Your custom message here"
}
```

##### Bulk Create Calls
```http
POST /api/v1/phone_calls/bulk_create
Content-Type: application/json

{
  "phone_numbers": ["+15551234567", "+15557654321"],
  "message": "Bulk message"
}
```

#### Blog Posts

##### Get All Posts
```http
GET /api/v1/blog_posts
```

##### Get Single Post
```http
GET /api/v1/blog_posts/:slug
```

##### Generate Post
```http
POST /api/v1/blog_posts/generate
Content-Type: application/json

{
  "title": "Your Blog Title",
  "word_count": 1000,
  "context": "Optional context"
}
```

##### Update Post
```http
PUT /api/v1/blog_posts/:slug
Content-Type: application/json

{
  "title": "Updated Title",
  "content": "Updated content",
  "status": "published"
}
```

##### Delete Post
```http
DELETE /api/v1/blog_posts/:slug
```

## 🏗 Architecture

### Application Structure

```
autodialer-app/
├── app/
│   ├── controllers/       # Request handlers
│   ├── models/           # Business logic & database
│   ├── jobs/             # Background jobs (Sidekiq)
│   ├── services/         # External API integrations
│   ├── views/            # HTML templates
│   └── helpers/          # View helpers
├── config/
│   ├── routes.rb         # URL routing
│   ├── database.yml      # Database config
│   ├── sidekiq.yml       # Background jobs config
│   └── puma.rb           # Web server config
├── db/
│   ├── migrate/          # Database migrations
│   └── schema.rb         # Database schema
└── bin/                  # Executable scripts
```

### Data Flow

#### Phone Calling Flow
```
User Input → Controller → PhoneCall Model → TwilioJob (Sidekiq)
→ Twilio API → Make Call → Webhook → Update Status → UI Polling
```

#### Blog Generation Flow
```
User Input → Controller → BlogGenerationJob (Sidekiq)
→ GeminiService → AI API → Parse Response → BlogPost Model → UI Polling
```

#### LinkedIn Scraping Flow
```
User Input → Controller → LinkedinProfile Model → BatchLinkedinScrapingJob
→ LinkedinScraperService → Puppeteer Script → Gemini AI (parsing)
→ Update Model → UI Polling
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 🔒 Security

### Important Notes

- **Never commit API keys** to version control
- Use environment variables for all secrets
- Enable 2FA on Twilio account
- Implement rate limiting for production
- Add authentication to API endpoints
- Sanitize user input
- Use HTTPS in production

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Twilio** - Phone calling API
- **Google Gemini** - AI content generation
- **OpenAI** - Alternative AI model
- **Puppeteer** - Web scraping automation
- **Rails Community** - Framework and gems
- **Bootstrap** - UI components

---

## 🗺 Roadmap

### Planned Features

- [ ] User authentication & authorization
- [ ] Email integration (SendGrid)
- [ ] SMS messaging support
- [ ] Advanced analytics dashboard
- [ ] Export data to CSV/Excel
- [ ] API rate limiting
- [ ] Webhook management UI
- [ ] Multi-language support
- [ ] Dark mode
- [ ] Mobile app (React Native)

### Completed

- [x] Automated phone calling
- [x] AI blog generation
- [x] LinkedIn profile scraping
- [x] Background job processing
- [x] Call analytics
- [x] Deployment configuration
- [x] API endpoints

---

**Built with ❤️ for ScaleScribes Technical Assessment**

**Version:** 1.0.1
**Last Updated:** November 2025
**Author:** Rishav Kumar

---

## Quick Links

- [Installation Guide](#-installation)
- [Contributing Guidelines](#-contributing)

---

*Made with Ruby on Rails, powered by AI* 🚀
