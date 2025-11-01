#!/bin/bash
# Setup script for Puppeteer-based LinkedIn scraper

echo "Setting up Puppeteer LinkedIn Scraper..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js found: $(node --version)"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm is not installed!"
    exit 1
fi

echo "✓ npm found: $(npm --version)"
echo ""

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✓ Node.js dependencies installed successfully"
else
    echo "✗ Failed to install Node.js dependencies"
    exit 1
fi

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Create a .env file with your LinkedIn credentials:"
echo "   LINKEDIN_EMAIL=your_email@example.com"
echo "   LINKEDIN_PASSWORD=your_password"
echo "   TWOCAPTCHA_API_KEY=your_api_key  # Optional"
echo ""
echo "2. Run the scraper:"
echo "   python linkedin_scraper_puppeteer.py profile_urls.txt"
echo ""

