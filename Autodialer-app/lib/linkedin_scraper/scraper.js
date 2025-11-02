/**
 * Main LinkedIn Scraper class
 * Orchestrates browser, login, and extraction modules
 */

const BrowserManager = require('./browser');
const LoginManager = require('./login');
const ExtractionManager = require('./extraction');
const { delay, getDefaultProfileData } = require('./utils');

class LinkedInScraper {
  constructor(options = {}) {
    this.headless = options.headless !== false;
    this.email = options.email || process.env.LINKEDIN_EMAIL || '';
    this.password = options.password || process.env.LINKEDIN_PASSWORD || '';
    this.geminiApiKey = options.geminiApiKey || process.env.GEMINI_API_KEY || '';
    
    this.browserManager = new BrowserManager({ headless: this.headless });
    this.extractionManager = new ExtractionManager(this.geminiApiKey);
    this.loginManager = null; // Will be initialized after browser init
  }

  async init() {
    const success = await this.browserManager.init();
    if (success && this.browserManager.page) {
      this.loginManager = new LoginManager(
        this.browserManager.page,
        this.email,
        this.password,
        () => this.browserManager.saveCookies()
      );
    }
    return success;
  }

  get page() {
    return this.browserManager.page;
  }

  get browser() {
    return this.browserManager.browser;
  }

  async ensureLoggedIn() {
    if (!this.loginManager) {
      throw new Error('LoginManager not initialized. Call init() first.');
    }

    // Load and verify cookies first
    const savedCookies = await this.browserManager.loadCookies();
    if (savedCookies && savedCookies.length > 0) {
      console.log('=== CHECKING SAVED COOKIES ===');
      await this.browserManager.setCookies(savedCookies);
      const cookiesValid = await this.browserManager.verifyCookies();
      
      if (cookiesValid) {
        console.log('✓ Using saved cookies - already logged in!');
        return true;
      } else {
        console.log('✗ Saved cookies are invalid - need to login again');
        // Delete invalid cookies
        const fs = require('fs');
        if (fs.existsSync(this.browserManager.cookiesPath)) {
          fs.unlinkSync(this.browserManager.cookiesPath);
        }
      }
    }
    
    // Login if needed
    if (this.email && this.password) {
      console.log('=== LOGGING IN TO LINKEDIN ===');
      return await this.loginManager.login();
    }
    
    return false;
  }

  async scrapeProfile(profileUrl) {
    if (!this.page) {
      throw new Error('Browser not initialized. Call init() first.');
    }

    try {
      console.log(`Scraping profile: ${profileUrl}`);
      
      // Navigate to profile
      console.log('Navigating to profile page...');
      try {
        await this.page.goto(profileUrl, {
          waitUntil: 'load',
          timeout: 60000,
        });
        console.log('✓ Page load event fired');
      } catch (timeoutError) {
        console.warn(`Navigation timeout, but page is likely loaded`);
      }

      // Wait for profile content
      console.log('Waiting for profile content to appear...');
      try {
        await Promise.race([
          this.page.waitForSelector('h1', { timeout: 20000 }),
          this.page.waitForSelector('[data-anonymize="person-name"]', { timeout: 20000 }),
          this.page.waitForSelector('.pv-text-details__left-panel', { timeout: 20000 }),
        ]);
        console.log('✓ Profile content detected');
      } catch (e) {
        console.warn('Waiting for profile content timed out, continuing anyway...');
      }

      await delay(3000);

      // Check for authwall
      const currentUrl = this.page.url();
      if (currentUrl.includes('authwall')) {
        console.error('Authwall detected - attempting emergency login...');
        if (this.loginManager) {
          const redirectUrl = await this.loginManager.handleAuthwall(profileUrl);
          await this.page.goto(redirectUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
          });
          await delay(3000);
        } else {
          throw new Error('Authwall detected but LoginManager not initialized');
        }
      }

      // Check for checkpoint
      const urlAfterAuth = this.page.url();
      if (urlAfterAuth.includes('checkpoint') || urlAfterAuth.includes('challenge')) {
        console.log('Checkpoint/challenge page detected. Attempting to solve...');
        if (this.loginManager) {
          await this.loginManager.solveCheckpointChallenge();
          await delay(3000);
        }
      }

      // Scroll to load content
      console.log('Scrolling to load profile content...');
      await this.page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 300;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= scrollHeight || totalHeight >= 3000) {
              clearInterval(timer);
              resolve();
            }
          }, 200);
        });
      });

      await delay(2000);
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await delay(1500);

      // Extract contact info
      console.log('Attempting to extract contact information...');
      const contactInfo = await this.extractionManager.extractContactInfo(this.page);
      console.log(`Contact info: email=${contactInfo.email}, phone=${contactInfo.phone}, website=${contactInfo.website}`);

      // Extract profile data
      let profileData;
      if (this.geminiApiKey) {
        try {
          console.log('Extracting profile data using Gemini AI...');
          profileData = await this.extractionManager.extractProfileDataWithGemini(this.page);
          console.log('✓ Profile data extracted using Gemini AI');
        } catch (error) {
          console.error(`Gemini extraction failed: ${error.message}`);
          console.error(`Error details: ${error.stack}`);
          throw error; // No manual fallback - rely on Gemini or fail
        }
      } else {
        throw new Error('Gemini API key required for extraction');
      }

      // Merge contact info
      if (contactInfo.email !== 'N/A') profileData.email = contactInfo.email;
      if (contactInfo.phone !== 'N/A') profileData.phone = contactInfo.phone;
      if (contactInfo.website !== 'N/A') profileData.website = contactInfo.website;

      console.log(`✓ Extraction completed: name=${profileData.name !== 'N/A' ? profileData.name : 'N/A'}, experience=${profileData.all_experience.length} items`);

      return profileData;
    } catch (error) {
      console.error(`Failed to scrape profile ${profileUrl}: ${error.message}`);
      return getDefaultProfileData(profileUrl, error.message);
    }
  }

  async scrapeProfiles(profileUrls) {
    const results = [];
    for (const url of profileUrls) {
      try {
        await delay(Math.random() * 3000 + 2000); // Random delay between requests
        const profileData = await this.scrapeProfile(url);
        results.push(profileData);
        console.log(`Successfully scraped: ${profileData.name || url}`);
      } catch (error) {
        console.error(`Error scraping ${url}: ${error.message}`);
        results.push(getDefaultProfileData(url, error.message));
      }
    }
    return results;
  }

  async scrapeProfilesInTabs(profileUrls, maxConcurrent = 3) {
    console.log(`\n=== MULTI-TAB SCRAPING MODE ===`);
    console.log(`Scraping ${profileUrls.length} profiles with max ${maxConcurrent} concurrent tabs\n`);

    const results = [];
    const chunks = [];

    // Split URLs into chunks
    for (let i = 0; i < profileUrls.length; i += maxConcurrent) {
      chunks.push(profileUrls.slice(i, i + maxConcurrent));
    }

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      console.log(`\n--- Processing batch ${chunkIndex + 1}/${chunks.length} (${chunk.length} profiles) ---`);

      // Create a new page (tab) for each URL in the chunk
      const pagePromises = chunk.map(async (url, index) => {
        const tabPage = await this.browser.newPage();

        try {
          // Set user agent and anti-detection
          await tabPage.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          );

          await tabPage.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
          });

          console.log(`[Tab ${index + 1}] Starting scrape: ${url}`);
          const profileData = await this.scrapeProfileInTab(tabPage, url);
          console.log(`[Tab ${index + 1}] ✓ Completed: ${profileData.name || 'N/A'}`);
          return profileData;
        } catch (error) {
          console.error(`[Tab ${index + 1}] ✗ Error scraping ${url}: ${error.message}`);
          return getDefaultProfileData(url, error.message);
        } finally {
          await tabPage.close();
        }
      });

      // Wait for all tabs in this chunk to complete
      const chunkResults = await Promise.all(pagePromises);
      results.push(...chunkResults);

      // Add delay between chunks
      if (chunkIndex < chunks.length - 1) {
        const delayTime = Math.random() * 2000 + 2000;
        console.log(`Waiting ${Math.round(delayTime / 1000)}s before next batch...`);
        await delay(delayTime);
      }
    }

    console.log(`\n=== MULTI-TAB SCRAPING COMPLETED ===`);
    console.log(`Successfully scraped ${results.filter(r => !r.error).length}/${profileUrls.length} profiles\n`);

    return results;
  }

  async scrapeProfileInTab(page, profileUrl) {
    try {
      console.log(`Navigating to: ${profileUrl}`);
      await page.goto(profileUrl, {
        waitUntil: 'load',
        timeout: 60000,
      });

      await delay(3000);
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 300;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= scrollHeight || totalHeight >= 3000) {
              clearInterval(timer);
              resolve();
            }
          }, 200);
        });
      });
      await delay(2000);

      // Extract using Gemini
      if (this.geminiApiKey) {
        return await this.extractionManager.extractProfileDataWithGemini(page);
      } else {
        throw new Error('Gemini API key required');
      }
    } catch (error) {
      console.error(`Failed to scrape profile ${profileUrl}: ${error.message}`);
      return getDefaultProfileData(profileUrl, error.message);
    }
  }

  async close() {
    await this.browserManager.close();
  }
}

module.exports = LinkedInScraper;
