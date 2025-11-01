# AeroLead Project

This repository contains multiple applications for AeroLead:

## 📁 Project Structure

```
AeroLead/
├── Autodialer-app/          # Rails application with Autodialer, Blog Generator & LinkedIn Scraper
├── Linkedin-scrapper/       # Puppeteer-based LinkedIn scraping tool
└── render.yaml             # Render.com deployment configuration
```

## 🚀 Applications

### 1. Autodialer-app
Full-featured Ruby on Rails application with:
- **Automated Phone Calling** (Twilio integration)
- **AI Blog Generator** (Gemini/OpenAI)
- **LinkedIn Profile Scraper** (Puppeteer + AI)

📖 **Documentation:** [Autodialer-app/README.md](./Autodialer-app/README.md)

### 2. Linkedin-scrapper
Standalone Puppeteer script for LinkedIn profile scraping.

## 📝 Configuration Files

### render.yaml (Root Directory)
Located at: `/AeroLead/render.yaml`

This file configures:
- Web service (`autodialer-web`) - Rails + Puma
- Worker service (`autodialer-sidekiq`) - Background jobs
- PostgreSQL database
- Redis instance

**Important:** The `rootDirectory` is set to `./Autodialer-app` so Render knows which directory contains the Rails app.

### LinkedIn Scraper Path
The scraper path is set to `./Linkedin-scrapper` relative to the AeroLead root, allowing the Rails app to access the scraper.

## 🛠 Development Setup

See individual README files:
- [Autodialer-app Setup](./Autodialer-app/README.md#-installation)
- [LinkedIn Scraper Setup](./Autodialer-app/README.md#linkedin-scraper-setup)

## 🔗 Quick Links

- **Main App:** [Autodialer-app](./Autodialer-app/)
- **App Documentation:** [README.md](./Autodialer-app/README.md)
- **Deployment Config:** [render.yaml](./render.yaml)
- **LinkedIn Scraper:** [Linkedin-scrapper](./Linkedin-scrapper/)

## 📞 Support

For issues or questions:
- Open an issue on GitHub
- Check the [Autodialer-app README](./Autodialer-app/README.md)

---

**Built with ❤️ for AeroLeads**
