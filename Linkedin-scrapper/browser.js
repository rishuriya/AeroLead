/**
 * Browser initialization and management utilities
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const { delay, findChromePath } = require('./utils');

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

class BrowserManager {
  constructor(options = {}) {
    this.headless = options.headless !== false;
    this.browser = null;
    this.page = null;
    this.cookiesPath = path.join(process.cwd(), '.linkedin_cookies.json');
  }

  async init() {
    try {
      const chromePath = findChromePath();
      const launchOptions = {
        headless: this.headless ? 'new' : false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--window-size=1920,1080',
        ],
        ignoreHTTPSErrors: true,
        defaultViewport: {
          width: 1920,
          height: 1080,
        },
      };

      if (chromePath) {
        launchOptions.executablePath = chromePath;
        console.log(`Using system Chrome: ${chromePath}`);
      } else {
        console.log('Using bundled Chromium from Puppeteer');
      }

      this.browser = await puppeteer.launch(launchOptions);
      this.page = await this.browser.newPage();
      
      // Set user agent
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Additional anti-detection measures
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
      });

      return true;
    } catch (error) {
      console.error(`Failed to initialize browser: ${error.message}`);
      return false;
    }
  }

  async loadCookies() {
    try {
      if (fs.existsSync(this.cookiesPath)) {
        const cookiesData = fs.readFileSync(this.cookiesPath, 'utf8');
        const cookies = JSON.parse(cookiesData);
        
        // Check if cookies are still valid (not expired)
        const now = Date.now();
        const validCookies = cookies.filter(cookie => {
          if (cookie.expires && cookie.expires * 1000 < now) {
            return false;
          }
          return true;
        });
        
        if (validCookies.length > 0) {
          console.log(`Loaded ${validCookies.length} cookies from previous session`);
          return validCookies;
        } else {
          console.log('Saved cookies have expired, will need to login again');
          return null;
        }
      }
      return null;
    } catch (error) {
      console.warn(`Failed to load cookies: ${error.message}`);
      return null;
    }
  }

  async saveCookies() {
    try {
      if (this.page) {
        const cookies = await this.page.cookies();
        if (cookies && cookies.length > 0) {
          fs.writeFileSync(this.cookiesPath, JSON.stringify(cookies, null, 2));
          console.log(`Saved ${cookies.length} cookies for future sessions`);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.warn(`Failed to save cookies: ${error.message}`);
      return false;
    }
  }

  async setCookies(cookies) {
    try {
      if (this.page && cookies && cookies.length > 0) {
        await this.page.goto('https://www.linkedin.com', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        
        for (const cookie of cookies) {
          try {
            await this.page.setCookie(cookie);
          } catch (cookieError) {
            continue;
          }
        }
        
        console.log(`Set ${cookies.length} cookies on page`);
        return true;
      }
      return false;
    } catch (error) {
      console.warn(`Failed to set cookies: ${error.message}`);
      return false;
    }
  }

  async verifyCookies() {
    try {
      if (!this.page) return false;
      
      await this.page.goto('https://www.linkedin.com/feed', {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
      
      await delay(2000);
      
      const currentUrl = this.page.url();
      
      const isLoggedIn = await this.page.evaluate(() => {
        return document.querySelector('[data-test-id="nav-settings"]') !== null ||
               document.querySelector('[data-test-id="nav-item-feed"]') !== null ||
               document.body.textContent.includes('Sign out') ||
               window.location.href.includes('/feed') ||
               window.location.href.includes('/mynetwork');
      });
      
      if (isLoggedIn && !currentUrl.includes('login') && !currentUrl.includes('authwall')) {
        console.log('✓ Cookies are valid - user is logged in');
        return true;
      } else {
        console.log('Cookies are invalid or expired - need to login');
        return false;
      }
    } catch (error) {
      console.warn(`Cookie verification failed: ${error.message}`);
      return false;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

module.exports = BrowserManager;
