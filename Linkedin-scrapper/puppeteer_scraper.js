/**
 * LinkedIn Scraper using Puppeteer with reCAPTCHA v2 Solver
 * This module can be called from Python via command line or stdin/stdout
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');
const { generateCaptchaTokensWithVisual } = require('recaptcha-v2-solver');
const EventEmitter = require('events');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Configure reCAPTCHA solver plugin (fallback to 2Captcha if Gemini not available)
const recaptchaConfig = {
  visualFeedback: true
};

// Add 2Captcha provider if API key is available (fallback)
if (process.env.TWOCAPTCHA_API_KEY) {
  recaptchaConfig.provider = {
    id: '2captcha',
    token: process.env.TWOCAPTCHA_API_KEY
  };
}

puppeteer.use(RecaptchaPlugin(recaptchaConfig));

// Helper function to replace deprecated waitForTimeout
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class LinkedInScraper {
  constructor(options = {}) {
    this.headless = options.headless !== false;
    this.email = options.email || process.env.LINKEDIN_EMAIL || '';
    this.password = options.password || process.env.LINKEDIN_PASSWORD || '';
    this.browser = null;
    this.page = null;
    this.geminiApiKey = options.geminiApiKey || process.env.GEMINI_API_KEY || '';
    this.eventEmitter = new EventEmitter();
    this.recaptchaToken = null;
    this.activeTimeouts = []; // Track all active timeouts for cleanup
    
    // Cookie persistence
    this.cookiesPath = path.join(process.cwd(), '.linkedin_cookies.json');
    this.loginAttempted = false; // Track if login was attempted to avoid multiple attempts

    // Set up event listener for token generation
    this.eventEmitter.on('tokenGenerated', async ({ token }) => {
      console.log('Got reCAPTCHA token from Gemini:', token);
      this.recaptchaToken = token;
      
      // Inject the token into the page
      if (this.page) {
        try {
          await this.page.evaluate((token) => {
            // Find the g-recaptcha-response textarea and set the token
            const textarea = document.querySelector('textarea[name="g-recaptcha-response"]');
            if (textarea) {
              textarea.value = token;
              textarea.innerHTML = token;
              
              // Trigger input event to notify reCAPTCHA
              const event = new Event('input', { bubbles: true });
              textarea.dispatchEvent(event);
              
              // Also try to call the callback if it exists
              if (window.grecaptcha && window.grecaptcha.getResponse) {
                const widgetId = window.grecaptcha.getResponse ? 0 : null;
                if (widgetId !== null && window.grecaptcha.execute) {
                  window.grecaptcha.execute(widgetId);
                }
              }
              
              // Set the token in window object for any callbacks
              window.grecaptchaResponse = token;
            }
            
            // Also try to find and fill any hidden input fields
            const hiddenInputs = document.querySelectorAll('input[type="hidden"][name*="recaptcha"]');
            hiddenInputs.forEach(input => {
              input.value = token;
            });
          }, token);
          
          console.log('Token injected into page successfully');
        } catch (error) {
          console.warn(`Failed to inject token: ${error.message}`);
        }
      }
    });
  }

  async init() {
    try {
      // Try to find system Chrome/Chromium to avoid downloading Chromium
      const findChromePath = () => {
        const platform = process.platform;
        const paths = {
          darwin: [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
          ],
          linux: [
            '/usr/bin/google-chrome',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
          ],
          win32: [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          ],
        };

        const fs = require('fs');
        const platformPaths = paths[platform] || [];
        
        for (const path of platformPaths) {
          try {
            if (fs.existsSync(path)) {
              return path;
            }
          } catch (e) {
            continue;
          }
        }
        
        // Fallback to Puppeteer's bundled Chromium if system Chrome not found
        return null;
      };

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

      // Use system Chrome if available (faster, no download needed)
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

        // Override plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        // Override languages
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
    // Load saved cookies from file
    try {
      if (fs.existsSync(this.cookiesPath)) {
        const cookiesData = fs.readFileSync(this.cookiesPath, 'utf8');
        const cookies = JSON.parse(cookiesData);
        
        // Check if cookies are still valid (not expired)
        const now = Date.now();
        const validCookies = cookies.filter(cookie => {
          if (cookie.expires && cookie.expires * 1000 < now) {
            return false; // Cookie expired
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
    // Save current cookies to file
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
    // Set cookies on the current page
    try {
      if (this.page && cookies && cookies.length > 0) {
        // Navigate to LinkedIn domain first to set cookies
        await this.page.goto('https://www.linkedin.com', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        
        // Set cookies one by one (Puppeteer requires domain to match)
        for (const cookie of cookies) {
          try {
            await this.page.setCookie(cookie);
          } catch (cookieError) {
            // Skip invalid cookies
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
    // Verify if cookies are still valid by checking login status
    try {
      if (!this.page) return false;
      
      // Navigate to feed to check if we're logged in
      await this.page.goto('https://www.linkedin.com/feed', {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
      
      await delay(2000);
      
      const currentUrl = this.page.url();
      
      // Check if we're logged in
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

  async login() {
    if (!this.email || !this.password) {
      console.warn('No LinkedIn credentials provided. Skipping login.');
      return false;
    }

    try {
      console.log('Navigating to LinkedIn login page...');
      await this.page.goto('https://www.linkedin.com/login', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Wait for login form
      await this.page.waitForSelector('input#username', { timeout: 10000 });
      await this.page.waitForSelector('input#password', { timeout: 10000 });

      // Fill in credentials
      await this.page.type('input#username', this.email, { delay: 100 });
      await this.page.type('input#password', this.password, { delay: 100 });

      // Check for reCAPTCHA before submitting
      const recaptchaPresent = await this.page.evaluate(() => {
        const iframe = document.querySelector('iframe[src*="recaptcha"]');
        return iframe !== null;
      });

      if (recaptchaPresent) {
        console.log('=== reCAPTCHA DETECTED ===');
        if (!this.headless) {
          console.log('Browser is visible - you can solve reCAPTCHA manually');
          console.log('The scraper will automatically detect when you solve it and continue...');
          console.log('Waiting up to 120 seconds for manual solving...');
        } else {
          console.log('NOTE: reCAPTCHA solving works best with --no-headless flag');
          console.log('If running headless, attempting automatic solving...');
        }
        
        // For non-headless mode, prioritize manual solving with timeout
        // For headless mode, try automatic solving with Gemini/2Captcha
        if (!this.headless) {
          // Non-headless: Wait for manual solving (up to 120 seconds)
          console.log('Waiting for manual reCAPTCHA solving...');
          this.recaptchaToken = null;
          
          let manualToken = null;
          const maxWaitTime = 120000; // 120 seconds
          const startTime = Date.now();
          
          while (!manualToken && (Date.now() - startTime) < maxWaitTime) {
            await delay(2000);
            manualToken = await this.page.evaluate(() => {
              const responseInput = document.querySelector('textarea#g-recaptcha-response, textarea[name="g-recaptcha-response"]');
              if (responseInput && responseInput.value && responseInput.value.length > 20) {
                return responseInput.value;
              }
              if (window.grecaptcha && typeof window.grecaptcha.getResponse === 'function') {
                try {
                  return window.grecaptcha.getResponse();
                } catch (e) {
                  return null;
                }
              }
              return null;
            });
            
            if (manualToken) {
              console.log('✓ reCAPTCHA solved manually!');
              this.recaptchaToken = manualToken;
              break;
            }
            
            // Show progress every 10 seconds
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            if (elapsed % 10 === 0 && elapsed > 0) {
              console.log(`Still waiting for manual solving... (${elapsed}s elapsed)`);
            }
          }
          
          if (!manualToken) {
            console.warn('Manual solving timeout - attempting automatic solving as fallback...');
            // Fall through to automatic solving
          }
        }
        
        // Try to solve reCAPTCHA using Gemini API first (if available and not already solved)
        if (!this.recaptchaToken && this.geminiApiKey) {
          try {
            console.log('Attempting automatic reCAPTCHA solving using Gemini API...');
            this.recaptchaToken = null;
            
            // First check if already solved manually (for headless mode or after timeout)
            const manualToken = await this.page.evaluate(() => {
              const responseInput = document.querySelector('textarea#g-recaptcha-response, textarea[name="g-recaptcha-response"]');
              if (responseInput && responseInput.value && responseInput.value.length > 20) {
                return responseInput.value;
              }
              if (window.grecaptcha && typeof window.grecaptcha.getResponse === 'function') {
                try {
                  return window.grecaptcha.getResponse();
                } catch (e) {
                  return null;
                }
              }
              return null;
            });
            
            if (manualToken) {
              console.log('✓ reCAPTCHA already solved! Using existing token.');
              this.recaptchaToken = manualToken;
            } else {
              // Wait for token generation, but also poll for manual solving
              const tokenPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                  // Before rejecting, check one last time if manual solving happened
                  this.page.evaluate(() => {
                    const responseInput = document.querySelector('textarea#g-recaptcha-response, textarea[name="g-recaptcha-response"]');
                    if (responseInput && responseInput.value && responseInput.value.length > 20) {
                      return responseInput.value;
                    }
                    if (window.grecaptcha && typeof window.grecaptcha.getResponse === 'function') {
                      try {
                        return window.grecaptcha.getResponse();
                      } catch (e) {
                        return null;
                      }
                    }
                    return null;
                  }).then(manualToken => {
                    if (manualToken) {
                      console.log('✓ Found manually solved reCAPTCHA token just before timeout!');
                      resolve(manualToken);
                    } else {
                      reject(new Error('Token generation timeout - try solving manually or check Gemini API key'));
                    }
                  }).catch(() => {
                    reject(new Error('Token generation timeout - try solving manually or check Gemini API key'));
                  });
                }, 90000); // 90 second timeout for automatic solving

                // Track timeout for cleanup
                this.activeTimeouts.push(timeout);

                // Poll for manual solving while waiting for Gemini token
                const pollInterval = setInterval(async () => {
                  try {
                    const manualToken = await this.page.evaluate(() => {
                      const responseInput = document.querySelector('textarea#g-recaptcha-response, textarea[name="g-recaptcha-response"]');
                      if (responseInput && responseInput.value && responseInput.value.length > 20) {
                        return responseInput.value;
                      }
                      if (window.grecaptcha && typeof window.grecaptcha.getResponse === 'function') {
                        try {
                          return window.grecaptcha.getResponse();
                        } catch (e) {
                          return null;
                        }
                      }
                      return null;
                    });

                    if (manualToken) {
                      clearTimeout(timeout);
                      clearInterval(pollInterval);
                      // Remove from active timeouts
                      const idx = this.activeTimeouts.indexOf(timeout);
                      if (idx > -1) this.activeTimeouts.splice(idx, 1);
                      console.log('✓ Detected manually solved reCAPTCHA!');
                      resolve(manualToken);
                    }
                  } catch (e) {
                    // Ignore polling errors
                  }
                }, 2000); // Poll every 2 seconds

                this.eventEmitter.once('tokenGenerated', ({ token }) => {
                  clearTimeout(timeout);
                  clearInterval(pollInterval);
                  // Remove from active timeouts
                  const idx = this.activeTimeouts.indexOf(timeout);
                  if (idx > -1) this.activeTimeouts.splice(idx, 1);
                  resolve(token);
                });
              });
              
              // Start token generation
              try {
                await generateCaptchaTokensWithVisual({
                  eventEmitter: this.eventEmitter,
                  captchaUrl: this.page.url(),
                  gemini: {
                    apiKey: this.geminiApiKey
                  }
                });
              } catch (geminiError) {
                console.warn(`Gemini API error (may still work if solving manually): ${geminiError.message}`);
                // Continue to wait for manual solving even if Gemini API fails
              }
              
              // Wait for token (either from Gemini or manual)
              const token = await tokenPromise;
              this.recaptchaToken = token;
              await delay(2000); // Wait for token to be processed
              
              console.log('reCAPTCHA solved successfully (Gemini or manual)');
            }
          } catch (error) {
            console.warn(`Gemini reCAPTCHA solving failed: ${error.message}`);
            console.warn('Falling back to 2Captcha or manual solving...');
            
            // Fallback to puppeteer-extra-plugin-recaptcha
            try {
              await this.page.solveRecaptchas();
              console.log('reCAPTCHA solved using fallback method');
            } catch (fallbackError) {
              console.warn(`Fallback reCAPTCHA solving failed: ${fallbackError.message}`);
              console.warn('You may need to solve it manually');
            }
          }
        } else {
          // Try to solve reCAPTCHA using the plugin (2Captcha or manual)
          try {
            await this.page.solveRecaptchas();
            console.log('reCAPTCHA solved successfully');
          } catch (error) {
            console.warn(`reCAPTCHA solving failed: ${error.message}`);
            console.warn('You may need to solve it manually or provide Gemini/2Captcha API key');
          }
        }
      }

      // Click submit button
      console.log('Submitting login form...');
      await this.page.click('button[type="submit"]');
      
      // Wait for navigation - monitor URL change
      console.log('Waiting for login response...');
      const startUrl = this.page.url();
      
      // Wait for URL to change (max 30 seconds)
      let urlChanged = false;
      for (let i = 0; i < 60; i++) {
        await delay(500);
        const currentUrl = this.page.url();
        if (currentUrl !== startUrl && !currentUrl.includes('login')) {
          urlChanged = true;
          break;
        }
      }
      
      // Also try waiting for login success indicators
      if (!urlChanged) {
        try {
          await this.page.waitForSelector('[data-test-id="nav-settings"], [data-test-id="nav-item-feed"], .feed-container', { timeout: 5000 }).catch(() => {});
        } catch (e) {
          // Ignore
        }
      }

      await delay(2000); // Additional wait for page to settle

      // Check if login was successful or redirected to checkpoint
      const currentUrl = this.page.url();
      console.log(`Current URL after login attempt: ${currentUrl}`);
      
      // Verify login by checking for logged-in indicators
      const isLoggedIn = await this.page.evaluate(() => {
        return document.querySelector('[data-test-id="nav-settings"]') !== null ||
               document.querySelector('[data-test-id="nav-item-feed"]') !== null ||
               document.querySelector('.feed-container') !== null ||
               document.body.textContent.includes('Sign out') ||
               window.location.href.includes('/feed') ||
               window.location.href.includes('/mynetwork');
      });

      if (currentUrl.includes('feed') || currentUrl.includes('mynetwork')) {
        console.log('Login successful! Redirected to feed/mynetwork');
        // Double-check we're actually logged in
        if (isLoggedIn) {
          // Save cookies after successful login
          await this.saveCookies();
          return true;
        } else {
          console.warn('URL indicates success but page content suggests not logged in');
        }
      } else if (isLoggedIn) {
        // Logged in but on different page (might be profile page)
        console.log('Login verified by page content - user is logged in');
        // Save cookies after successful login
        await this.saveCookies();
        return true;
      } else if (currentUrl.includes('checkpoint') || currentUrl.includes('challenge')) {
        console.log('=== CHECKPOINT/CHALLENGE PAGE DETECTED AFTER LOGIN ===');
        console.log('This is a security challenge. Attempting to solve reCAPTCHA automatically...');
        
        // Solve checkpoint challenge - this MUST be done automatically
        const solved = await this.solveCheckpointChallenge();
        
        if (solved) {
          console.log('✓ Checkpoint challenge solved! Waiting for redirect...');
          // Wait for redirect after solving - give more time
          await delay(5000);
          
          // Wait for navigation away from checkpoint - more lenient
          try {
            await this.page.waitForFunction(
              () => !window.location.href.includes('checkpoint') && 
                    !window.location.href.includes('challenge'),
              { timeout: 30000 }
            );
            console.log('✓ Navigated away from checkpoint page');
          } catch (e) {
            console.warn('Navigation timeout, checking current state...');
          }
          
          // Additional wait and check
          await delay(3000);
          const newUrl = this.page.url();
          console.log(`URL after checkpoint solve: ${newUrl}`);
          
          // Check multiple times if we're logged in
          let isLoggedIn = await this.page.evaluate(() => {
            return document.querySelector('[data-test-id="nav-settings"]') !== null ||
                   document.querySelector('[data-test-id="nav-item-feed"]') !== null ||
                   document.body.textContent.includes('Sign out') ||
                   window.location.href.includes('/feed') ||
                   window.location.href.includes('/mynetwork');
          });
          
          // If not logged in yet, wait a bit more and check again
          if (!isLoggedIn && (newUrl.includes('checkpoint') || newUrl.includes('challenge'))) {
            console.log('Still on checkpoint, waiting a bit more for redirect...');
            await delay(5000);
            const checkUrl = this.page.url();
            isLoggedIn = await this.page.evaluate(() => {
              return document.querySelector('[data-test-id="nav-settings"]') !== null ||
                     document.body.textContent.includes('Sign out') ||
                     window.location.href.includes('/feed') ||
                     window.location.href.includes('/mynetwork');
            });
            
            if (!checkUrl.includes('checkpoint') && !checkUrl.includes('challenge')) {
              console.log('✓ Successfully navigated away from checkpoint');
              return true;
            }
          }
          
          if (newUrl.includes('feed') || newUrl.includes('mynetwork') || isLoggedIn) {
            console.log('✓ Checkpoint solved successfully! Login verified.');
            // Save cookies after successful checkpoint resolution
            await this.saveCookies();
            return true;
          } else if (!newUrl.includes('checkpoint') && !newUrl.includes('challenge') && !newUrl.includes('login')) {
            console.log('✓ Navigated away from checkpoint page. Login verified.');
            // Save cookies after successful checkpoint resolution
            await this.saveCookies();
            return true;
          } else {
            console.warn('Still on checkpoint page after solving attempt, but continuing...');
            // Don't fail here - sometimes LinkedIn takes time to redirect
          }
        } else {
          console.warn('Checkpoint challenge solving returned false, but checking if we can proceed...');
        }
        
        // Final verification - be more lenient after checkpoint solving attempt
        await delay(3000);
        const finalCheck = await this.page.evaluate(() => {
          return document.querySelector('[data-test-id="nav-settings"]') !== null ||
                 document.querySelector('[data-test-id="nav-item-feed"]') !== null ||
                 document.body.textContent.includes('Sign out') ||
                 window.location.href.includes('/feed') ||
                 window.location.href.includes('/mynetwork') ||
                 (!window.location.href.includes('checkpoint') && 
                  !window.location.href.includes('challenge') &&
                  !window.location.href.includes('login'));
        });
        
        const finalUrl = this.page.url();
        console.log(`Final URL check: ${finalUrl}`);
        
        if (finalCheck || (!finalUrl.includes('checkpoint') && !finalUrl.includes('challenge') && !finalUrl.includes('login'))) {
          console.log('✓ Checkpoint appears to be resolved. Proceeding with login...');
          console.log(`Current URL: ${finalUrl}`);
          // Save cookies after successful checkpoint resolution
          await this.saveCookies();
          return true;
        }
        
        // Last chance - if we're not on login/checkpoint, assume success
        if (!finalUrl.includes('login') && !finalUrl.includes('checkpoint') && !finalUrl.includes('challenge')) {
          console.log('✓ Not on login/checkpoint page - assuming login success');
          // Save cookies after successful login
          await this.saveCookies();
          return true;
        }
        
        console.error('Checkpoint challenge not fully resolved. Login may have failed.');
        console.error('NOTE: If running with --no-headless, you can manually solve the captcha in the browser.');
        return false;
      } else if (currentUrl.includes('login')) {
        // Still on login page - check for error messages
        const errorMsg = await this.page.evaluate(() => {
          const error = document.querySelector('.alert-content, .error-message, [data-test="login-error"]');
          return error ? error.textContent.trim() : null;
        });
        
        if (errorMsg) {
          console.error(`Login error: ${errorMsg}`);
        } else {
          console.warn('Still on login page, login may have failed');
        }
        return false;
      } else {
        // Unexpected URL - might be authwall or something else
        console.warn(`Unexpected URL after login: ${currentUrl}`);
        // Try to verify if we're logged in by checking for profile elements
        const isLoggedIn = await this.page.evaluate(() => {
          return document.querySelector('[data-test-id="nav-settings"]') !== null ||
                 document.body.textContent.includes('Sign out') ||
                 window.location.href.includes('/in/');
        });
        
        if (isLoggedIn) {
          console.log('Login verified by page content check');
          return true;
        }
        return false;
      }
    } catch (error) {
      console.error(`Login failed: ${error.message}`);
      return false;
    }
  }

  async solveCheckpointChallenge() {
    // Solve reCAPTCHA on LinkedIn checkpoint/challenge pages AUTOMATICALLY
    try {
      console.log('=== CHECKPOINT CHALLENGE DETECTED ===');
      console.log('Automatically solving reCAPTCHA on checkpoint page...');
      
      // Wait for page to fully load and for reCAPTCHA iframe to appear
      await delay(4000);
      
      // Check for reCAPTCHA - wait for it to appear with more attempts
      let recaptchaPresent = false;
      let attempts = 0;
      const maxAttempts = 15; // Increase attempts
      
      console.log('Scanning for reCAPTCHA on checkpoint page...');
      while (attempts < maxAttempts && !recaptchaPresent) {
        recaptchaPresent = await this.page.evaluate(() => {
          // Check multiple ways reCAPTCHA can appear
          const iframe = document.querySelector('iframe[src*="recaptcha"]');
          const recaptcha = document.querySelector('.g-recaptcha');
          const challenge = document.querySelector('[data-callback]');
          const recaptchaDiv = document.querySelector('div[data-sitekey]');
          const textarea = document.querySelector('textarea#g-recaptcha-response, textarea[name="g-recaptcha-response"]');
          
          return iframe !== null || recaptcha !== null || challenge !== null || recaptchaDiv !== null || textarea !== null;
        });
        
        if (!recaptchaPresent) {
          if (attempts % 3 === 0) {
            console.log(`Waiting for reCAPTCHA to appear (attempt ${attempts + 1}/${maxAttempts})...`);
          }
          await delay(1500);
          attempts++;
        } else {
          console.log('✓ reCAPTCHA detected!');
        }
      }

      if (recaptchaPresent) {
        console.log('✓ reCAPTCHA detected on checkpoint page. Automatically solving...');
        
        // Try to solve using Gemini API first (if available)
        // But also check if user manually solved it
        if (this.geminiApiKey) {
          try {
            console.log('Solving checkpoint reCAPTCHA using Gemini API...');
            console.log('NOTE: If running with --no-headless, you can also solve it manually.');
            console.log('The scraper will detect manual solving and continue automatically.');
            
            this.recaptchaToken = null;
            
            // First, check if reCAPTCHA has already been solved manually
            const manualToken = await this.page.evaluate(() => {
              const responseInput = document.querySelector('textarea#g-recaptcha-response, textarea[name="g-recaptcha-response"]');
              if (responseInput && responseInput.value && responseInput.value.length > 20) {
                return responseInput.value;
              }
              
              // Check if grecaptcha has a response
              if (window.grecaptcha && typeof window.grecaptcha.getResponse === 'function') {
                try {
                  const response = window.grecaptcha.getResponse();
                  if (response && response.length > 20) {
                    return response;
                  }
                } catch (e) {
                  // Ignore
                }
              }
              
              return null;
            });
            
            if (manualToken) {
              console.log('✓ reCAPTCHA already solved manually! Using existing token.');
              this.recaptchaToken = manualToken;
            } else {
              // Wait for token generation with longer timeout, but also poll for manual solving
              const tokenPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                  // Before rejecting, check one last time if manual solving happened
                  this.page.evaluate(() => {
                    const responseInput = document.querySelector('textarea#g-recaptcha-response, textarea[name="g-recaptcha-response"]');
                    if (responseInput && responseInput.value && responseInput.value.length > 20) {
                      return responseInput.value;
                    }
                    if (window.grecaptcha && typeof window.grecaptcha.getResponse === 'function') {
                      try {
                        return window.grecaptcha.getResponse();
                      } catch (e) {
                        return null;
                      }
                    }
                    return null;
                  }).then(manualToken => {
                    if (manualToken) {
                      console.log('✓ Found manually solved reCAPTCHA token just before timeout!');
                      resolve(manualToken);
                    } else {
                      reject(new Error('Token generation timeout (90s) - try solving manually or check Gemini API key'));
                    }
                  }).catch(() => {
                    reject(new Error('Token generation timeout (90s) - try solving manually or check Gemini API key'));
                  });
                }, 90000); // 90 second timeout

                // Track timeout for cleanup
                this.activeTimeouts.push(timeout);

                // Poll for manual solving while waiting for Gemini token
                const pollInterval = setInterval(async () => {
                  try {
                    const manualToken = await this.page.evaluate(() => {
                      const responseInput = document.querySelector('textarea#g-recaptcha-response, textarea[name="g-recaptcha-response"]');
                      if (responseInput && responseInput.value && responseInput.value.length > 20) {
                        return responseInput.value;
                      }
                      if (window.grecaptcha && typeof window.grecaptcha.getResponse === 'function') {
                        try {
                          return window.grecaptcha.getResponse();
                        } catch (e) {
                          return null;
                        }
                      }
                      return null;
                    });

                    if (manualToken) {
                      clearTimeout(timeout);
                      clearInterval(pollInterval);
                      // Remove from active timeouts
                      const idx = this.activeTimeouts.indexOf(timeout);
                      if (idx > -1) this.activeTimeouts.splice(idx, 1);
                      console.log('✓ Detected manually solved reCAPTCHA!');
                      resolve(manualToken);
                    }
                  } catch (e) {
                    // Ignore polling errors
                  }
                }, 2000); // Poll every 2 seconds

                this.eventEmitter.once('tokenGenerated', ({ token }) => {
                  clearTimeout(timeout);
                  clearInterval(pollInterval);
                  // Remove from active timeouts
                  const idx = this.activeTimeouts.indexOf(timeout);
                  if (idx > -1) this.activeTimeouts.splice(idx, 1);
                  console.log('✓ reCAPTCHA token generated by Gemini');
                  resolve(token);
                });
              });
              
              // Start token generation
              console.log('Starting Gemini API token generation...');
              try {
                await generateCaptchaTokensWithVisual({
                  eventEmitter: this.eventEmitter,
                  captchaUrl: this.page.url(),
                  gemini: {
                    apiKey: this.geminiApiKey
                  }
                });
              } catch (geminiError) {
                console.warn(`Gemini API error (may still work if solving manually): ${geminiError.message}`);
                // Continue to wait for manual solving even if Gemini API fails
              }
              
              // Wait for token (either from Gemini or manual)
              console.log('Waiting for reCAPTCHA token (will detect manual solving)...');
              const token = await tokenPromise;
              this.recaptchaToken = token;
              console.log(`✓ Token received: ${token.substring(0, 20)}...`);
            }
            
            // Inject token into page
            if (token) {
              console.log('Injecting token into page...');
              await this.page.evaluate((token) => {
                // Try to find and fill reCAPTCHA response field
                const responseInput = document.querySelector('textarea#g-recaptcha-response, textarea[name="g-recaptcha-response"]');
                if (responseInput) {
                  responseInput.value = token;
                  responseInput.dispatchEvent(new Event('change', { bubbles: true }));
                  responseInput.dispatchEvent(new Event('input', { bubbles: true }));
                  console.log('Token injected into textarea');
                }
                
                // Try multiple ways to set the token
                if (window.grecaptcha) {
                  try {
                    // Try getResponse callback
                    if (window.grecaptcha.getResponse) {
                      window.grecaptcha.getResponse = () => token;
                    }
                    
                    // Try execute callback if available
                    if (window.grecaptcha.execute) {
                      const sitekey = document.querySelector('[data-sitekey]')?.getAttribute('data-sitekey');
                      if (sitekey) {
                        window.grecaptcha.execute(sitekey, { action: 'submit' });
                      }
                    }
                  } catch (e) {
                    console.log('Could not trigger grecaptcha callback:', e.message);
                  }
                }
                
                // Try to find callback function and execute it
                const callbackElements = document.querySelectorAll('[data-callback]');
                callbackElements.forEach(el => {
                  const callbackName = el.getAttribute('data-callback');
                  if (callbackName && window[callbackName]) {
                    try {
                      window[callbackName](token);
                      console.log(`Callback ${callbackName} executed`);
                    } catch (e) {
                      console.log(`Could not execute callback ${callbackName}:`, e.message);
                    }
                  }
                });
              }, token);
            }
            
            await delay(4000); // Wait longer for token to be processed
            
            console.log('✓ Checkpoint reCAPTCHA token injected. Submitting form...');
            
            // Try to submit/continue after solving
            const submitted = await this.submitCheckpointForm();
            
            if (submitted) {
              console.log('✓ Checkpoint form submitted after Gemini solve');
              return true;
            } else {
              console.warn('Token injected but form submission may have failed - will retry');
              // Retry submission after delay
              await delay(2000);
              const retrySubmitted = await this.submitCheckpointForm();
              if (retrySubmitted) {
                return true;
              }
            }
          } catch (error) {
            console.warn(`Gemini checkpoint reCAPTCHA solving failed: ${error.message}`);
            console.warn('Falling back to 2Captcha or plugin method...');
          }
        }
        
        // Fallback to puppeteer-extra-plugin-recaptcha (2Captcha)
        try {
          console.log('Attempting to solve checkpoint reCAPTCHA using fallback method (2Captcha/plugin)...');
          await this.page.solveRecaptchas();
          await delay(5000); // Wait longer for 2Captcha
          
          console.log('Fallback reCAPTCHA solve completed. Submitting form...');
          
          // Try to submit/continue
          const submitted = await this.submitCheckpointForm();
          
          if (submitted) {
            console.log('✓ Checkpoint reCAPTCHA solved using fallback method');
            return true;
          } else {
            console.warn('reCAPTCHA solved but form submission may have failed - retrying...');
            await delay(2000);
            const retrySubmitted = await this.submitCheckpointForm();
            if (retrySubmitted) {
              return true;
            }
          }
        } catch (fallbackError) {
          console.warn(`Fallback checkpoint reCAPTCHA solving failed: ${fallbackError.message}`);
          console.warn('If running with --no-headless, you may need to solve it manually.');
        }
      } else {
        console.log('No reCAPTCHA found on checkpoint page. May be a different challenge type.');
        console.log('Attempting to find and click continue/submit button...');
        
        // Try to find and click continue/submit button
        const submitted = await this.submitCheckpointForm();
        
        if (submitted) {
          return true;
        }
      }
      
      // Final check - see if we're still on checkpoint page
      await delay(3000);
      const currentUrl = this.page.url();
      if (currentUrl.includes('checkpoint') || currentUrl.includes('challenge')) {
        console.warn('Still on checkpoint page after solving attempt');
        // But don't fail completely - sometimes it takes time
        return false;
      } else {
        console.log('✓ Successfully navigated away from checkpoint page');
        return true;
      }
    } catch (error) {
      console.error(`Error solving checkpoint challenge: ${error.message}`);
      console.error(`Stack: ${error.stack}`);
      return false;
    }
  }

  async submitCheckpointForm() {
    // Try to submit checkpoint form after solving reCAPTCHA - multiple attempts
    try {
      // Wait for form to be ready
      await delay(3000);
      
      console.log('Looking for submit/continue button on checkpoint page...');
      
      // Try multiple times with different strategies
      for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`Submit attempt ${attempt}/3...`);
        
        // Try to find and click continue/submit button with multiple strategies
        const buttonClicked = await this.page.evaluate((attempt) => {
          // Try multiple button selectors
          const buttonSelectors = [
            'button[type="submit"]',
            'button.challenge__button',
            'button.challenge-submit',
            'input[type="submit"]',
            'button[aria-label*="Continue"]',
            'button[aria-label*="Submit"]',
            'button[aria-label*="Verify"]',
            'button[aria-label*="verify"]',
            '.challenge-dialog button',
            'button.btn-primary',
            'button[class*="challenge"]',
            'button[class*="submit"]',
            'button[class*="continue"]',
            'button[class*="verify"]',
            'button.artdeco-button',
            'button.artdeco-button--primary',
            // LinkedIn specific selectors
            'button[data-control-name="challenge_continue"]',
            'button[data-control-name="challenge_submit"]',
          ];
          
          // First try: find by selector
          for (const selector of buttonSelectors) {
            try {
              const btn = document.querySelector(selector);
              if (btn) {
                // Check if button is visible and enabled
                const style = window.getComputedStyle(btn);
                const isVisible = btn.offsetParent !== null && 
                                 style.display !== 'none' && 
                                 style.visibility !== 'hidden';
                
                if (isVisible && !btn.disabled) {
                  console.log(`Found button with selector: ${selector}`);
                  btn.click();
                  return { success: true, method: `selector: ${selector}`, attempt };
                }
              }
            } catch (e) {
              continue;
            }
          }
          
          // Second try: find by text content
          const allButtons = document.querySelectorAll('button');
          for (const btn of allButtons) {
            const text = btn.textContent.toLowerCase().trim();
            if ((text.includes('continue') || text.includes('verify') || text.includes('submit') || 
                 text.includes('next') || text.includes('proceed')) &&
                btn.offsetParent !== null && !btn.disabled) {
              console.log(`Found button by text: ${text}`);
              btn.click();
              return { success: true, method: `text: ${text}`, attempt };
            }
          }
          
          // Third try: find by form submission
          const forms = document.querySelectorAll('form');
          for (const form of forms) {
            if (form.offsetParent !== null) {
              console.log('Submitting form directly');
              form.submit();
              return { success: true, method: 'form.submit()', attempt };
            }
          }
          
          return { success: false, method: 'none', attempt };
        }, attempt);
        
        if (buttonClicked.success) {
          console.log(`✓ Checkpoint form submitted using: ${buttonClicked.method}`);
          
          // Wait for navigation - longer wait
          await delay(5000);
          
          // Verify we navigated away
          const currentUrl = this.page.url();
          console.log(`URL after submission: ${currentUrl}`);
          
          if (!currentUrl.includes('checkpoint') && !currentUrl.includes('challenge')) {
            console.log('✓ Successfully navigated away from checkpoint page');
            return true;
          } else if (currentUrl.includes('feed') || currentUrl.includes('mynetwork')) {
            console.log('✓ Successfully navigated to feed/mynetwork');
            return true;
          } else {
            console.warn(`Still on checkpoint page after attempt ${attempt}, trying again...`);
            await delay(2000);
          }
        } else {
          console.warn(`Could not find submit button on attempt ${attempt}`);
          
          // Try Puppeteer's click method as fallback
          try {
            const selectors = ['button[type="submit"]', 'button.challenge__button', 'button[aria-label*="Continue"]'];
            for (const selector of selectors) {
              try {
                const submitButton = await this.page.$(selector);
                if (submitButton) {
                  const isVisible = await this.page.evaluate((btn) => {
                    const style = window.getComputedStyle(btn);
                    return btn.offsetParent !== null && 
                           style.display !== 'none' && 
                           style.visibility !== 'hidden' &&
                           !btn.disabled;
                  }, submitButton);
                  
                  if (isVisible) {
                    await submitButton.click();
                    await delay(5000);
                    console.log(`✓ Clicked submit button using Puppeteer (selector: ${selector})`);
                    
                    const currentUrl = this.page.url();
                    if (!currentUrl.includes('checkpoint') && !currentUrl.includes('challenge')) {
                      return true;
                    }
                  }
                }
              } catch (e) {
                continue;
              }
            }
          } catch (e) {
            console.warn(`Puppeteer click also failed on attempt ${attempt}: ${e.message}`);
          }
          
          if (attempt < 3) {
            await delay(3000); // Wait before next attempt
          }
        }
      }
      
      // Final check after all attempts
      await delay(3000);
      const finalUrl = this.page.url();
      console.log(`Final URL after all attempts: ${finalUrl}`);
      
      if (!finalUrl.includes('checkpoint') && !finalUrl.includes('challenge')) {
        console.log('✓ Finally navigated away from checkpoint page');
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn(`Error submitting checkpoint form: ${error.message}`);
      return false;
    }
  }

  async handleAuthwall(originalUrl) {
    // Handle LinkedIn authwall page by logging in
    // Note: This should not be called if login was already done
    // It's a fallback in case we hit authwall despite being logged in
    try {
      console.log('Handling authwall page - performing fresh login...');
      
      // Extract sessionRedirect URL from current page if available
      const sessionRedirect = await this.page.evaluate(() => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('sessionRedirect');
      });
      
      const targetUrl = sessionRedirect ? decodeURIComponent(sessionRedirect) : originalUrl;
      console.log(`Target URL after login: ${targetUrl}`);
      
      // Navigate directly to login page to start fresh
      console.log('Navigating to login page...');
      await this.page.goto('https://www.linkedin.com/login', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });
      
      await delay(1000);
      
      // Now login using existing login method
      console.log('Attempting login from authwall handler...');
      const loginSuccess = await this.login();
      
      if (loginSuccess) {
        console.log('Login successful after authwall. Will redirect to target URL...');
        return targetUrl;
      } else {
        console.error('Login failed on authwall page - cannot proceed');
        throw new Error('Login failed - credentials may be incorrect or account requires verification');
      }
    } catch (error) {
      console.error(`Error handling authwall: ${error.message}`);
      throw error;
    }
  }

  async scrapeProfile(profileUrl) {
    if (!this.page) {
      throw new Error('Browser not initialized. Call init() first.');
    }

    try {
      console.log(`Scraping profile: ${profileUrl}`);
      
      // Navigate to profile - don't wait for network idle since LinkedIn has continuous activity
      // Just wait for page to start loading
      console.log('Navigating to profile page...');
      try {
        await this.page.goto(profileUrl, {
          waitUntil: 'load', // Wait for page load event, not network idle
          timeout: 60000,
        });
        console.log('✓ Page load event fired');
      } catch (timeoutError) {
        // Even if timeout, page might be loaded - LinkedIn pages often have continuous network activity
        console.warn(`Navigation timeout, but page is likely loaded (LinkedIn has continuous network activity)`);
      }

      // Wait for actual profile content to appear (not just page load)
      console.log('Waiting for profile content to appear...');
      try {
        // Wait for profile name or main content container
        await Promise.race([
          this.page.waitForSelector('h1', { timeout: 20000 }),
          this.page.waitForSelector('[data-anonymize="person-name"]', { timeout: 20000 }),
          this.page.waitForSelector('.pv-text-details__left-panel', { timeout: 20000 }),
          this.page.waitForSelector('.ph5.pb5', { timeout: 20000 }),
          this.page.waitForFunction(() => {
            return document.querySelector('h1') !== null || 
                   document.querySelector('.pv-text-details__left-panel') !== null;
          }, { timeout: 20000 })
        ]);
        console.log('✓ Profile content detected');
      } catch (e) {
        console.warn('Waiting for profile content timed out, but continuing anyway...');
        console.warn('Page may still be loading - we will attempt to extract what we can');
      }

      // Additional wait for dynamic content to fully render
      await delay(3000);

      // Check for authwall page first (requires login)
      const currentUrl = this.page.url();
      if (currentUrl.includes('authwall')) {
        console.error('Authwall detected - login should have happened before scraping!');
        console.error('This indicates initial login failed. Attempting emergency login...');
        
        const redirectUrl = await this.handleAuthwall(profileUrl);
        if (!redirectUrl) {
          throw new Error('Failed to handle authwall page - login required but failed');
        }
        
        // Navigate to the original profile URL after login
        try {
          await this.page.goto(redirectUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
          });
        } catch (timeoutError) {
          console.warn(`Navigation timeout, but continuing...`);
        }
        await delay(3000);
        
        // Verify we're not on authwall anymore
        const urlAfterLogin = this.page.url();
        if (urlAfterLogin.includes('authwall')) {
          throw new Error('Still on authwall after login attempt - login may have failed');
        }
      }

      // Check for checkpoint/challenge page
      const urlAfterAuth = this.page.url();
      if (urlAfterAuth.includes('checkpoint') || urlAfterAuth.includes('challenge')) {
        console.log('Checkpoint/challenge page detected. Attempting to solve reCAPTCHA...');
        await this.solveCheckpointChallenge();
        // Wait for page to redirect after challenge
        await delay(3000);
      }

      // Check for reCAPTCHA on profile page - if it appears, cookies are likely invalid
      const recaptchaPresent = await this.page.evaluate(() => {
        const iframe = document.querySelector('iframe[src*="recaptcha"]');
        return iframe !== null;
      });

      if (recaptchaPresent) {
        console.error('⚠ reCAPTCHA detected on profile page - this indicates cookies may be invalid');
        console.error('Please login again (cookies will be saved automatically)');
        console.error('If this persists, your LinkedIn account may be rate-limited');
        
        // Don't try to solve reCAPTCHA during scraping - cookies should handle authentication
        // If reCAPTCHA appears, it means we need to login again
      }

      // Verify we have profile content before proceeding
      console.log('Verifying profile content is loaded...');
      const contentCheck = await this.page.evaluate(() => {
        const h1 = document.querySelector('h1');
        const nameText = h1 ? h1.textContent.trim() : null;
        const bodyLength = document.body.textContent.length;
        
        return {
          hasH1: h1 !== null,
          nameText: nameText,
          bodyLength: bodyLength,
          hasProfileContent: document.querySelector('.pv-text-details__left-panel') !== null ||
                             document.querySelector('.ph5.pb5') !== null ||
                             document.querySelector('section[data-section="experience"]') !== null
        };
      });
      
      console.log(`Content check:`, contentCheck);
      
      if (contentCheck.hasH1 || contentCheck.hasProfileContent || contentCheck.bodyLength > 1000) {
        console.log('✓ Profile content verified - ready to extract data');
        if (contentCheck.nameText) {
          console.log(`Found name: ${contentCheck.nameText}`);
        }
      } else {
        console.warn('⚠ Warning: Profile content may not be fully loaded');
        console.warn('Waiting a bit longer before extracting...');
        await delay(5000); // Wait longer if content not detected
      }
      
      // Additional wait to ensure dynamic content loads
      await delay(3000);

      // Scroll down to trigger lazy loading of content
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

      // Scroll to bottom to ensure all sections are visible
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      await delay(1500);

      // Extract profile data using Gemini AI (preferred) or fallback to manual extraction
      let profileData;
      
      if (this.geminiApiKey) {
        try {
          console.log('Extracting profile data using Gemini AI...');
          profileData = await this.extractProfileDataWithGemini();
          console.log('✓ Profile data extracted using Gemini AI');
        } catch (error) {
          console.warn(`Gemini extraction failed: ${error.message}`);
          console.warn('Falling back to manual extraction...');
          profileData = await this.extractProfileDataManually();
        }
      } else {
        console.log('Extracting profile data manually (no Gemini API key provided)...');
        profileData = await this.extractProfileDataManually();
      }

      // Log extracted data summary
      console.log(`✓ Extraction completed: name=${profileData.name !== 'N/A' ? profileData.name : 'N/A'}, headline=${profileData.headline !== 'N/A' ? profileData.headline.substring(0, 50) : 'N/A'}, experience=${profileData.all_experience.length} items`);
      
      return profileData;
    } catch (error) {
      console.error(`Failed to scrape profile ${profileUrl}: ${error.message}`);
      console.error(`Error stack: ${error.stack}`);
      
      // Return partial data instead of throwing, so we can still process other profiles
      // and browser doesn't close immediately
      return {
        profile_url: profileUrl,
        error: error.message,
        scraped_at: new Date().toISOString(),
        name: 'N/A',
        headline: 'N/A',
        location: 'N/A',
        about: 'N/A',
        current_company: 'N/A',
        current_position: 'N/A',
        all_experience: [],
        education: 'N/A',
        all_education: [],
        top_skills: 'N/A',
        all_skills: 'N/A',
        skills_count: 0
      };
    }
  }

  async extractProfileDataWithGeminiFromPage(page) {
    // Extract clean, structured content from a specific page
    const pageText = await page.evaluate(() => {
      // Helper to clean text
      const cleanText = (text) => {
        if (!text) return '';
        return text
          .replace(/\s+/g, ' ') // Normalize whitespace
          .replace(/\n+/g, '\n') // Normalize newlines
          .trim();
      };

      // Extract structured sections directly
      const sections = {};

      // Name - try multiple selectors
      const nameSelectors = [
        'h1.text-heading-xlarge',
        'h1.inline.t-24.v-align-middle.break-words',
        'h1[data-anonymize="person-name"]',
        '.pv-text-details__left-panel h1',
        'h1'
      ];
      for (const selector of nameSelectors) {
        const elem = document.querySelector(selector);
        if (elem && elem.textContent.trim()) {
          sections.Name = cleanText(elem.textContent);
          break;
        }
      }

      // Headline
      const headlineSelectors = [
        'div.text-body-medium.break-words[data-generated-suggestion-target]',
        'div.text-body-medium.break-words',
        '.pv-text-details__left-panel .text-body-medium'
      ];
      for (const selector of headlineSelectors) {
        const elem = document.querySelector(selector);
        if (elem && elem.textContent.trim()) {
          sections.Headline = cleanText(elem.textContent);
          break;
        }
      }

      // Location
      const locationSelectors = [
        'span.text-body-small.inline.t-black--light.break-words',
        '.pv-text-details__left-panel .text-body-small',
        'span[data-anonymize="location"]'
      ];
      for (const selector of locationSelectors) {
        const elem = document.querySelector(selector);
        if (elem && elem.textContent.trim()) {
          sections.Location = cleanText(elem.textContent);
          break;
        }
      }

      // About/Summary - try multiple approaches
      const aboutSelectors = [
        'div.inline-show-more-text span[aria-hidden="true"]',
        'div.inline-show-more-text',
        'section[data-section="summary"] span[aria-hidden="true"]',
        'section[data-section="summary"] .pv-about__summary-text',
        'section[data-section="summary"]',
        '#about',
        '.pv-about-section'
      ];
      for (const selector of aboutSelectors) {
        const elem = document.querySelector(selector);
        if (elem && elem.textContent.trim() && elem.textContent.trim().length > 10) {
          // Remove "About" heading and other noise
          let aboutText = cleanText(elem.textContent);
          aboutText = aboutText.replace(/^About\s*/i, '').trim();
          if (aboutText.length > 10) {
            sections.About = aboutText;
            break;
          }
        }
      }

      // Experience - extract clean structured data with multiple fallbacks
      let expSection = document.querySelector('section[data-section="experience"]');
      if (!expSection) {
        // Fallback selectors for experience section
        expSection = document.querySelector('section#experience-section') ||
                     document.querySelector('section.pv-profile-section[data-section="experience"]') ||
                     document.querySelector('div#experience') ||
                     Array.from(document.querySelectorAll('section')).find(s =>
                       s.querySelector('div') &&
                       s.textContent.toLowerCase().includes('experience') &&
                       s.querySelectorAll('li').length > 0
                     );
      }

      if (expSection) {
        // Try to extract items first
        const items = expSection.querySelectorAll('li.artdeco-list__item, ul li, li.pvs-list__paged-list-item');

        if (items.length > 0) {
          const expItems = [];
          items.forEach((item, idx) => {
            if (idx > 20) return; // Limit to 20 items
            const text = cleanText(item.textContent);
            if (text && text.length > 10 && text.length < 1000) {
              expItems.push(text);
            }
          });

          if (expItems.length > 0) {
            sections.Experience = expItems.join('\n---\n');
          }
        }

        // If no items found, just take all text from the section
        if (!sections.Experience) {
          const sectionText = cleanText(expSection.textContent);
          if (sectionText.length > 50) {
            sections.Experience = sectionText.substring(0, 5000); // Limit per section
          }
        }
      }

      // Education - extract clean structured data with multiple fallbacks
      let eduSection = document.querySelector('section[data-section="education"]');
      if (!eduSection) {
        // Fallback selectors for education section
        eduSection = document.querySelector('section#education-section') ||
                     document.querySelector('section.pv-profile-section[data-section="education"]') ||
                     document.querySelector('div#education') ||
                     Array.from(document.querySelectorAll('section')).find(s =>
                       s.querySelector('div') &&
                       s.textContent.toLowerCase().includes('education') &&
                       s.querySelectorAll('li').length > 0
                     );
      }

      if (eduSection) {
        // Try to extract items first
        const items = eduSection.querySelectorAll('li.artdeco-list__item, ul li, li.pvs-list__paged-list-item');

        if (items.length > 0) {
          const eduItems = [];
          items.forEach((item, idx) => {
            if (idx > 10) return; // Limit to 10 items
            const text = cleanText(item.textContent);
            if (text && text.length > 10 && text.length < 500) {
              eduItems.push(text);
            }
          });

          if (eduItems.length > 0) {
            sections.Education = eduItems.join('\n---\n');
          }
        }

        // If no items found, just take all text from the section
        if (!sections.Education) {
          const sectionText = cleanText(eduSection.textContent);
          if (sectionText.length > 50) {
            sections.Education = sectionText.substring(0, 3000); // Limit per section
          }
        }
      }

      // Skills - extract only skill names with multiple fallbacks
      let skillsSection = document.querySelector('section[data-section="skills"]');
      if (!skillsSection) {
        // Fallback selectors for skills section
        skillsSection = document.querySelector('section#skills-section') ||
                        document.querySelector('section.pv-profile-section[data-section="skills"]') ||
                        document.querySelector('div#skills') ||
                        Array.from(document.querySelectorAll('section')).find(s =>
                          s.querySelector('div') &&
                          s.textContent.toLowerCase().includes('skill') &&
                          s.querySelectorAll('span, li').length > 3
                        );
      }

      if (skillsSection) {
        // Try to extract individual skills first
        const skillElems = skillsSection.querySelectorAll('span[aria-hidden="true"], li span, div[data-field="skill_card_skill_topic"] span, li a span');

        if (skillElems.length > 0) {
          const skillSet = new Set();
          skillElems.forEach(elem => {
            const skill = cleanText(elem.textContent);
            // Less aggressive filtering
            if (skill &&
                skill.length > 1 &&
                skill.length < 50 &&
                !skill.match(/^\d+$/) &&
                !skill.match(/endorsement/i)) {
              skillSet.add(skill);
            }
          });

          if (skillSet.size > 0) {
            sections.Skills = Array.from(skillSet).slice(0, 50).join(', ');
          }
        }

        // If no skills found, just take all text from the section
        if (!sections.Skills || sections.Skills.length < 10) {
          const sectionText = cleanText(skillsSection.textContent);
          if (sectionText.length > 20) {
            sections.Skills = sectionText.substring(0, 2000); // Limit per section
          }
        }
      }

      // Build clean structured output
      let output = `=== PROFILE URL ===\n${window.location.href}\n\n`;
      output += `=== SCRAPED AT ===\n${new Date().toISOString()}\n\n`;

      const sectionOrder = ['Name', 'Headline', 'Location', 'About', 'Experience', 'Education', 'Skills'];

      for (const label of sectionOrder) {
        if (sections[label]) {
          output += `=== ${label} ===\n${sections[label]}\n\n`;
        }
      }

      // FALLBACK: If we have very little content, extract ALL text from main content area
      if (output.length < 500) {
        console.log('Very little sectioned content found, extracting all main content as fallback...');
        const mainContent = document.querySelector('main') ||
                           document.querySelector('.scaffold-layout__main') ||
                           document.querySelector('#profile-content') ||
                           document.body;

        if (mainContent) {
          // Clone and clean
          const clone = mainContent.cloneNode(true);
          // Remove nav, header, footer, modals
          const unwanted = clone.querySelectorAll('script, style, nav, header, footer, .artdeco-modal, [role="navigation"], [role="banner"]');
          unwanted.forEach(el => el.remove());

          const allText = cleanText(clone.textContent);
          if (allText.length > 100) {
            output += `=== ALL PAGE CONTENT ===\n${allText}\n\n`;
          }
        }
      }

      return output.substring(0, 15000); // Limit to 15k chars for better Gemini performance
    });

    // Debug: Log the extracted content length
    console.log(`Extracted content length: ${pageText.length} chars`);
    if (pageText.length < 200) {
      console.warn('WARNING: Very little content extracted from page!');
      console.log('Content preview:', pageText.substring(0, 500));
    }

    // Optional: Save extracted content to file for debugging
    if (process.env.DEBUG_SAVE_CONTENT === 'true') {
      const fs = require('fs');
      const debugFileName = `debug_content_${Date.now()}.txt`;
      fs.writeFileSync(debugFileName, pageText);
      console.log(`Debug: Saved extracted content to ${debugFileName}`);
    }

    // Send to Gemini for extraction
    const genAI = new GoogleGenerativeAI(this.geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are an expert at extracting structured data from LinkedIn profiles. Extract ALL available information from the following LinkedIn profile text.

LINKEDIN PROFILE TEXT:
${pageText}

INSTRUCTIONS:
1. Extract the profile_url from the "PROFILE URL" section
2. Extract the scraped_at timestamp from the "SCRAPED AT" section
3. Parse ALL sections carefully (Name, Headline, Location, About, Experience, Education, Skills)
4. For Experience: Extract EVERY job listed with position, company, and duration
5. For Education: Extract EVERY school listed with school name and degree
6. For Skills: Extract ALL skills mentioned, comma-separated
7. Infer current_company and current_position from the first/latest experience entry OR from the headline
8. Count the total number of skills for skills_count

RETURN FORMAT:
Return ONLY valid JSON (no markdown, no code blocks, no explanations). Use this exact structure:

{
  "profile_url": "extract from PROFILE URL section",
  "scraped_at": "extract from SCRAPED AT section",
  "name": "extract from Name section",
  "headline": "extract from Headline section",
  "location": "extract from Location section",
  "about": "extract from About section (full text)",
  "current_company": "infer from headline or first experience entry",
  "current_position": "infer from headline or first experience entry",
  "all_experience": [
    {
      "position": "job title",
      "company": "company name",
      "duration": "dates or time period"
    }
  ],
  "education": "name of primary/first school",
  "all_education": [
    {
      "school": "school/university name",
      "degree": "degree name or type"
    }
  ],
  "top_skills": "first 10 skills, comma-separated",
  "all_skills": "all skills, comma-separated",
  "skills_count": <total number of skills>,
  "email": "email if found, else N/A",
  "phone": "phone if found, else N/A",
  "website": "website if found, else N/A",
  "profile_image_url": "N/A",
  "connections": "connection count if found, else N/A",
  "pronouns": "pronouns if found, else N/A"
}

IMPORTANT RULES:
- Use "N/A" for any field not found in the text
- Extract ALL entries from arrays (all_experience, all_education)
- Parse the Experience section carefully - each "---" separator indicates a new entry
- Parse the Education section carefully - each "---" separator indicates a new entry
- Skills are comma-separated in the Skills section
- Return ONLY the JSON object, nothing else`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      let text = response.text();

      console.log(`Gemini response length: ${text.length} chars`);

      // Clean up the response (remove markdown code blocks if present)
      text = text.trim();
      if (text.startsWith('```json')) {
        text = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      } else if (text.startsWith('```')) {
        text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      text = text.trim();

      // Parse JSON
      let profileData;
      try {
        profileData = JSON.parse(text);
        console.log(`✓ Gemini successfully parsed JSON with ${Object.keys(profileData).length} fields`);
      } catch (parseError) {
        console.error('Failed to parse Gemini response as JSON');
        console.error('Gemini response preview:', text.substring(0, 500));
        throw new Error(`JSON parsing failed: ${parseError.message}`);
      }

      // Ensure required fields have defaults and use actual URL/timestamp
      const finalResult = {
        profile_url: page.url(),
        scraped_at: new Date().toISOString(),
        name: profileData.name || 'N/A',
        headline: profileData.headline || 'N/A',
        location: profileData.location || 'N/A',
        about: profileData.about || 'N/A',
        current_company: profileData.current_company || 'N/A',
        current_position: profileData.current_position || 'N/A',
        all_experience: Array.isArray(profileData.all_experience) ? profileData.all_experience : [],
        education: profileData.education || 'N/A',
        all_education: Array.isArray(profileData.all_education) ? profileData.all_education : [],
        top_skills: profileData.top_skills || 'N/A',
        all_skills: profileData.all_skills || 'N/A',
        skills_count: typeof profileData.skills_count === 'number' ? profileData.skills_count : 0,
        email: profileData.email || 'N/A',
        phone: profileData.phone || 'N/A',
        website: profileData.website || 'N/A',
        profile_image_url: profileData.profile_image_url || 'N/A',
        connections: profileData.connections || 'N/A',
        pronouns: profileData.pronouns || 'N/A'
      };

      // Log extraction summary
      console.log(`Extracted: ${finalResult.name}, Experience: ${finalResult.all_experience.length}, Education: ${finalResult.all_education.length}, Skills: ${finalResult.skills_count}`);

      return finalResult;
    } catch (error) {
      console.error(`Gemini extraction error: ${error.message}`);
      throw error;
    }
  }

  async extractProfileDataWithGemini() {
    // Wrapper that uses this.page
    return await this.extractProfileDataWithGeminiFromPage(this.page);
  }

  async extractProfileDataManuallyFromPage(page) {
    // Fallback to manual extraction from a specific page
    return await page.evaluate(() => {
        const data = {
          profile_url: window.location.href,
          scraped_at: new Date().toISOString(),
        };

        // Helper function to safely get text
        const getText = (selector, defaultValue = 'N/A') => {
          try {
            const element = document.querySelector(selector);
            return element ? element.textContent.trim() : defaultValue;
          } catch (e) {
            return defaultValue;
          }
        };

        // Helper function to get text from multiple selectors (fallback)
        const getTextFromSelectors = (selectors, defaultValue = 'N/A') => {
          for (const selector of selectors) {
            try {
              const element = document.querySelector(selector);
              if (element && element.textContent.trim()) {
                return element.textContent.trim();
              }
            } catch (e) {
              continue;
            }
          }
          return defaultValue;
        };

        // Extract name - updated for new LinkedIn structure
        // New structure: name in aria-label of anchor containing h1, or directly in h1
        // First try: get from aria-label (more reliable)
        try {
          const nameAnchor = document.querySelector('a[aria-label]');
          if (nameAnchor) {
            const h1InAnchor = nameAnchor.querySelector('h1');
            if (h1InAnchor) {
              const ariaLabel = nameAnchor.getAttribute('aria-label');
              if (ariaLabel && ariaLabel.trim().length > 1) {
                data.name = ariaLabel.trim();
              }
            }
          }
        } catch (e) {
          // Ignore
        }
        
        // Fallback: try getting from h1 text directly
        if (data.name === 'N/A' || !data.name || data.name.length < 2) {
          data.name = getTextFromSelectors([
            'h1.inline.t-24.v-align-middle.break-words',
            'h1.break-words',
            'h1.inline.t-24',
            'h1.text-heading-xlarge',
            'h1.top-card-layout__title',
            'h1[data-anonymize="person-name"]',
            '.pv-text-details__left-panel h1',
            '.ph5.pb5 h1',
            'h1',
          ]);
        }

        // Extract headline - updated for new structure
        // New: div.text-body-medium.break-words with data-generated-suggestion-target
        data.headline = getTextFromSelectors([
          'div.text-body-medium.break-words[data-generated-suggestion-target]',
          'div.text-body-medium.break-words',
          'div.text-body-medium',
          '.ph5.pb5 .mt1',
          '.text-body-medium.inline.t-black--light.break-words',
          '.top-card-layout__headline',
          '.pv-text-details__left-panel .text-body-medium',
          'div.mt1 .text-body-medium',
          '.text-body-medium',
        ]);

        // Extract location - updated selectors
        data.location = getTextFromSelectors([
          'span.text-body-small.inline.t-black--light.break-words',
          '.text-body-small.inline.t-black--light.break-words',
          '.text-body-small.inline.t-black--light',
          '.pv-text-details__left-panel span.text-body-small',
          'div.ph5.pb5 span.text-body-small',
          '.top-card-layout__first-subline',
          'span[data-anonymize="location"]',
          '.pv-text-details__left-panel .text-body-small',
          '.text-body-small',
        ]);

        // Extract about/bio - updated for new LinkedIn structure
        // New structure: div.inline-show-more-text with span[aria-hidden="true"]
        data.about = getTextFromSelectors([
          'div.inline-show-more-text span[aria-hidden="true"]',
          'div.inline-show-more-text--is-collapsed span[aria-hidden="true"]',
          'div.display-flex.full-width span[aria-hidden="true"]',
          'div.text-body-medium.break-words[data-generated-suggestion-target] span[aria-hidden="true"]',
          'div.display-flex.ph5.pv3 span[aria-hidden="true"]',
          '.pv-about-section .pv-about__summary-text',
          'section[data-section="summary"] .pv-about__summary-text',
          'section[data-section="summary"] span[aria-hidden="true"]',
          'section#summary .pv-about-section',
          'div.ph5.pb5 section[data-section="summary"]',
          '.pv-profile-section[data-section="summary"]',
          '.pv-about__summary-text',
        ]);
        
        // Try getting full about text including hidden parts
        if (data.about === 'N/A') {
          try {
            // Look for inline-show-more-text div
            const aboutDiv = document.querySelector('div.inline-show-more-text span[aria-hidden="true"]');
            if (aboutDiv && aboutDiv.textContent.trim()) {
              data.about = aboutDiv.textContent.trim();
            } else {
              // Fallback: try section with summary
              const aboutSection = document.querySelector('section[data-section="summary"]');
              if (aboutSection) {
                const aboutText = aboutSection.textContent.trim();
                if (aboutText && aboutText.length > 10) {
                  data.about = aboutText;
                }
              }
            }
          } catch (e) {
            // Ignore
          }
        }

        // Extract experience - updated for new LinkedIn structure
        // Structure: Top-level li.artdeco-list__item contains company, nested ul li contains positions
        const experienceSection = document.querySelector('section[data-section="experience"]') ||
                                  document.querySelector('section#experience-section') ||
                                  document.querySelector('section.pv-profile-section[data-section="experience"]');
        
        data.current_company = 'N/A';
        data.current_position = 'N/A';
        data.all_experience = [];

        if (experienceSection) {
          // Find all top-level experience items (companies)
          // Structure: li.artdeco-list__item -> company name -> nested ul li -> positions
          let companyItems = experienceSection.querySelectorAll('li.artdeco-list__item');
          
          if (companyItems.length === 0) {
            // Fallback: try any li
            companyItems = experienceSection.querySelectorAll('ul li');
          }
          
          companyItems.forEach((companyItem, companyIdx) => {
            // Get company name - look for span[aria-hidden="true"] at top level of this item
            // Company name is usually in: div.display-flex.flex-column span[aria-hidden="true"]
            let companyName = null;
            
            // Try multiple ways to find company name
            const companySelectors = [
              'div.display-flex.flex-column span[aria-hidden="true"]',
              'div[data-field="experience_company_logo"] + div span[aria-hidden="true"]',
              'span[aria-hidden="true"]'
            ];
            
            for (const selector of companySelectors) {
              const elem = companyItem.querySelector(selector);
              if (elem && elem.textContent.trim() && 
                  !elem.textContent.match(/\d+\s*(year|month|yr|mo|yrs|mos)/i) &&
                  elem.textContent.length < 100 &&
                  elem.textContent.length > 1) {
                companyName = elem.textContent.trim();
                break;
              }
            }
            
            // Now find all positions nested under this company
            // Positions are in nested ul li -> div.mr1.hoverable-link-text.t-bold span[aria-hidden="true"]
            const positionItems = companyItem.querySelectorAll('ul li, div[data-view-name="profile-component-entity"]');
            
            if (positionItems.length > 0) {
              // Has nested positions
              let positionCount = 0;
              positionItems.forEach((positionItem) => {
                // Position is in: div.mr1.hoverable-link-text.t-bold span[aria-hidden="true"]
                const positionElem = positionItem.querySelector('div.mr1.hoverable-link-text.t-bold span[aria-hidden="true"]') ||
                                   positionItem.querySelector('.t-bold span[aria-hidden="true"]') ||
                                   positionItem.querySelector('span[aria-hidden="true"]');
                
                if (positionElem && positionElem.textContent.trim() && 
                    positionElem.textContent.length < 100 &&
                    !positionElem.textContent.match(/\d+\s*(year|month|yr|mo)/i)) {
                  const position = positionElem.textContent.trim();
                  const company = companyName || 'N/A';
                  
                  data.all_experience.push({
                    position: position,
                    company: company,
                    duration: ''
                  });
                  
                  // Set current from first position of first company
                  if (companyIdx === 0 && positionCount === 0) {
                    data.current_position = position;
                    data.current_company = company;
                  }
                  positionCount++;
                }
              });
            } else if (companyName) {
              // No nested positions, but we found a company name
              // This might be a single-company entry
              data.all_experience.push({
                position: 'N/A',
                company: companyName,
                duration: ''
              });
              
              if (companyIdx === 0 && data.current_company === 'N/A') {
                data.current_company = companyName;
              }
            }
          });
        }

        // Extract from headline if experience not found
        if (data.current_company === 'N/A' && data.headline !== 'N/A') {
          const headlineMatch = data.headline.match(/(.+?)\s+(?:at|@|\|)\s+(.+)$/i);
          if (headlineMatch) {
            data.current_position = headlineMatch[1].trim();
            data.current_company = headlineMatch[2].trim();
          }
        }

        // Extract education - updated for new LinkedIn structure
        // New structure: Similar to experience - li.artdeco-list__item with nested spans
        const educationSection = document.querySelector('section[data-section="education"]') ||
                                document.querySelector('section#education-section') ||
                                document.querySelector('section.pv-profile-section[data-section="education"]');
        
        data.education = 'N/A';
        data.all_education = [];

        if (educationSection) {
          // New structure: Look for education items
          let educationItems = educationSection.querySelectorAll('li.artdeco-list__item');
          
          if (educationItems.length === 0) {
            educationItems = educationSection.querySelectorAll('ul li');
          }
          
          educationItems.forEach((item, idx) => {
            // School name is in span[aria-hidden="true"] at top level
            let schoolElem = null;
            const schoolSelectors = [
              'div.display-flex.flex-column span[aria-hidden="true"]',
              'div.mr1.hoverable-link-text.t-bold span[aria-hidden="true"]',
              'span[aria-hidden="true"]',
            ];
            
            for (const selector of schoolSelectors) {
              const elem = item.querySelector(selector);
              if (elem && elem.textContent.trim() && 
                  elem.textContent.length < 150 &&
                  !elem.textContent.match(/MBA|MS|BS|BA|PhD/i)) {
                schoolElem = elem;
                break;
              }
            }
            
            // Degree is in span.t-14.t-normal span[aria-hidden="true"]
            let degreeElem = null;
            const degreeSelectors = [
              'span.t-14.t-normal span[aria-hidden="true"]',
              'span.t-14.t-normal',
              '.t-14.t-normal span',
            ];
            
            for (const selector of degreeSelectors) {
              const elem = item.querySelector(selector);
              if (elem && elem.textContent.trim() && 
                  (elem.textContent.match(/MBA|MS|BS|BA|PhD|Bachelor|Master|Doctorate/i) ||
                   elem.textContent.length < 100)) {
                degreeElem = elem;
                break;
              }
            }

            if (schoolElem) {
              const school = schoolElem.textContent.trim();
              const degree = degreeElem ? degreeElem.textContent.trim() : '';

              data.all_education.push({
                school: school,
                degree: degree
              });

              if (idx === 0) {
                data.education = school;
              }
            }
          });
        }

        // Extract skills - more comprehensive
        const skillsSection = document.querySelector('section[data-section="skills"]') ||
                             document.querySelector('section#skills-section') ||
                             document.querySelector('section.pv-profile-section[data-section="skills"]');
        
        data.top_skills = 'N/A';
        data.all_skills = 'N/A';
        data.skills_count = 0;
        const skillsList = [];

        if (skillsSection) {
          // Try multiple selectors for skills
          const skillSelectors = [
            'span.pvs-entity__text span[aria-hidden="true"]',
            'a span[aria-hidden="true"]',
            '.pvs-list__paged-list-item span[aria-hidden="true"]',
            'li span[aria-hidden="true"]',
            'span.t-bold span',
            'a.pvs-list__item',
          ];
          
          skillSelectors.forEach(selector => {
            const skillElements = skillsSection.querySelectorAll(selector);
            skillElements.forEach(elem => {
              const skill = elem.textContent.trim();
              if (skill && skill.length < 50 && skill.length > 1 && 
                  !skillsList.includes(skill) && 
                  !skill.match(/^\d+$/) && // Not just numbers
                  !skill.includes('Show') && // Not "Show more" buttons
                  !skill.includes('View')) { // Not "View" buttons
                skillsList.push(skill);
              }
            });
          });

          if (skillsList.length > 0) {
            data.top_skills = skillsList.slice(0, 10).join(', ');
            data.all_skills = skillsList.join(', ');
            data.skills_count = skillsList.length;
          }
        }

        // Extract connections
        data.connections = getText('span.t-black--light span', 'N/A');

        // Extract contact info
        data.email = 'N/A';
        data.phone = 'N/A';
        data.website = 'N/A';

        const emailLink = document.querySelector('a[href^="mailto:"]');
        if (emailLink) {
          data.email = emailLink.href.replace('mailto:', '');
        }

        const phoneLink = document.querySelector('a[href^="tel:"]');
        if (phoneLink) {
          data.phone = phoneLink.href.replace('tel:', '');
        }

        const websiteLink = document.querySelector('section[data-section="contact-info"] a[href^="http"]');
        if (websiteLink) {
          data.website = websiteLink.href;
        }

        // Extract profile image
        const profileImg = document.querySelector('img.profile-photo-edit__preview') ||
                          document.querySelector('img.pv-top-card-profile-picture__image');
        data.profile_image_url = profileImg ? profileImg.src : 'N/A';

        // Extract pronouns
        const pronounElem = document.querySelector('span[data-anonymize="pronouns"]');
        data.pronouns = pronounElem ? pronounElem.textContent.trim() : 'N/A';

        return data;
      });
  }

  async extractProfileDataManually() {
    // Wrapper that uses this.page
    return await this.extractProfileDataManuallyFromPage(this.page);
  }

  async scrapeProfiles(profileUrls) {
    const results = [];

        for (const url of profileUrls) {
      try {
        // Add delay between requests
        await delay(Math.random() * 3000 + 2000);

        const profileData = await this.scrapeProfile(url);
        results.push(profileData);

        console.log(`Successfully scraped: ${profileData.name || url}`);
      } catch (error) {
        console.error(`Error scraping ${url}: ${error.message}`);
        results.push({
          profile_url: url,
          error: error.message,
          scraped_at: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  async scrapeProfilesInTabs(profileUrls, maxConcurrent = 3) {
    console.log(`\n=== MULTI-TAB SCRAPING MODE ===`);
    console.log(`Scraping ${profileUrls.length} profiles with max ${maxConcurrent} concurrent tabs\n`);

    const results = [];
    const chunks = [];

    // Split URLs into chunks based on maxConcurrent
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
          // Set user agent for the new tab
          await tabPage.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          );

          // Apply anti-detection measures
          await tabPage.evaluateOnNewDocument(() => {
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

          console.log(`[Tab ${index + 1}] Starting scrape: ${url}`);

          // Scrape the profile using the new tab
          const profileData = await this.scrapeProfileInTab(tabPage, url);

          console.log(`[Tab ${index + 1}] ✓ Completed: ${profileData.name || 'N/A'}`);

          return profileData;
        } catch (error) {
          console.error(`[Tab ${index + 1}] ✗ Error scraping ${url}: ${error.message}`);
          return {
            profile_url: url,
            error: error.message,
            scraped_at: new Date().toISOString(),
            name: 'N/A',
            headline: 'N/A',
            location: 'N/A',
            about: 'N/A',
            current_company: 'N/A',
            current_position: 'N/A',
            all_experience: [],
            education: 'N/A',
            all_education: [],
            top_skills: 'N/A',
            all_skills: 'N/A',
            skills_count: 0
          };
        } finally {
          // Close the tab after scraping
          await tabPage.close();
        }
      });

      // Wait for all tabs in this chunk to complete
      const chunkResults = await Promise.all(pagePromises);
      results.push(...chunkResults);

      // Add delay between chunks to avoid rate limiting
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
    // Similar to scrapeProfile but uses a specific page instance
    try {
      console.log(`Navigating to: ${profileUrl}`);

      // Navigate to profile
      try {
        await page.goto(profileUrl, {
          waitUntil: 'load',
          timeout: 60000,
        });
      } catch (timeoutError) {
        console.warn(`Navigation timeout for ${profileUrl}, but continuing...`);
      }

      // Wait for profile content
      try {
        await Promise.race([
          page.waitForSelector('h1', { timeout: 20000 }),
          page.waitForSelector('[data-anonymize="person-name"]', { timeout: 20000 }),
          page.waitForSelector('.pv-text-details__left-panel', { timeout: 20000 }),
        ]);
      } catch (e) {
        console.warn('Waiting for profile content timed out, continuing anyway...');
      }

      await delay(3000);

      // Check for authwall
      const currentUrl = page.url();
      if (currentUrl.includes('authwall')) {
        throw new Error('Authwall detected - login session not shared to this tab');
      }

      // Check for checkpoint/challenge
      if (currentUrl.includes('checkpoint') || currentUrl.includes('challenge')) {
        console.log('Checkpoint detected in tab - may need to solve CAPTCHA');
        // Note: We'll handle this with the shared login session
      }

      // Scroll to load content
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

      // Scroll to bottom to ensure all sections are visible
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      await delay(1500);

      // Extract profile data
      let profileData;
      if (this.geminiApiKey) {
        try {
          profileData = await this.extractProfileDataWithGeminiFromPage(page);
        } catch (error) {
          console.warn(`Gemini extraction failed: ${error.message}, using manual extraction`);
          profileData = await this.extractProfileDataManuallyFromPage(page);
        }
      } else {
        profileData = await this.extractProfileDataManuallyFromPage(page);
      }

      return profileData;
    } catch (error) {
      console.error(`Failed to scrape profile ${profileUrl}: ${error.message}`);
      return {
        profile_url: profileUrl,
        error: error.message,
        scraped_at: new Date().toISOString(),
        name: 'N/A',
        headline: 'N/A',
        location: 'N/A',
        about: 'N/A',
        current_company: 'N/A',
        current_position: 'N/A',
        all_experience: [],
        education: 'N/A',
        all_education: [],
        top_skills: 'N/A',
        all_skills: 'N/A',
        skills_count: 0
      };
    }
  }

  async close() {
    // Clear all active timeouts to prevent errors
    if (this.activeTimeouts && this.activeTimeouts.length > 0) {
      this.activeTimeouts.forEach(timeout => clearTimeout(timeout));
      this.activeTimeouts = [];
    }

    // Remove all event listeners
    if (this.eventEmitter) {
      this.eventEmitter.removeAllListeners();
    }

    // Close browser
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  (async () => {
    // Determine headless mode
    // If --headless is explicitly passed, use headless
    // If HEADLESS env is 'false', use non-headless
    // Otherwise, default to headless unless --no-headless is passed
    let isHeadless = true;
    if (args.includes('--no-headless')) {
      isHeadless = false;
    } else if (args.includes('--headless')) {
      isHeadless = true;
    } else if (process.env.HEADLESS === 'false') {
      isHeadless = false;
    } else {
      isHeadless = process.env.HEADLESS !== 'false' && process.env.HEADLESS !== undefined;
    }

    const scraper = new LinkedInScraper({
      headless: isHeadless,
      email: process.env.LINKEDIN_EMAIL,
      password: process.env.LINKEDIN_PASSWORD,
      geminiApiKey: process.env.GEMINI_API_KEY || '',
    });

    try {
      await scraper.init();
      
      // Skip login handling for 'login-only' and 'scrape' commands (they handle it separately)
      if (command !== 'login-only' && command !== 'scrape') {
        // COOKIE-FIRST APPROACH: Load saved cookies before attempting login
        let isLoggedIn = false;
        const savedCookies = await scraper.loadCookies();
        
        if (savedCookies && savedCookies.length > 0) {
          console.log('=== CHECKING SAVED COOKIES ===');
          console.log('Attempting to use saved cookies from previous session...');
          
          // Set cookies and verify
          await scraper.setCookies(savedCookies);
          const cookiesValid = await scraper.verifyCookies();
          
          if (cookiesValid) {
            console.log('✓ Using saved cookies - already logged in!');
            isLoggedIn = true;
          } else {
            console.log('✗ Saved cookies are invalid or expired - need to login again');
            // Delete invalid cookies file
            if (fs.existsSync(scraper.cookiesPath)) {
              fs.unlinkSync(scraper.cookiesPath);
              console.log('Deleted invalid cookies file');
            }
          }
        }
        
        // Only login if cookies don't exist or are invalid
        if (!isLoggedIn && scraper.email && scraper.password) {
          console.log('=== LOGGING IN TO LINKEDIN ===');
          console.log('Note: reCAPTCHA may appear. If running with --no-headless, you can solve it manually.');
          console.log('After successful login, cookies will be saved automatically.');
          
          const loginSuccess = await scraper.login();
          if (!loginSuccess) {
            // Before giving up, do a final check - sometimes login succeeded but verification failed
            console.log('Login returned false, but doing final verification...');
            await delay(3000);
            
            const finalUrl = scraper.page.url();
            console.log(`Final URL after login attempt: ${finalUrl}`);
            
            // If we're on a checkpoint page, try solving it one more time
              if (finalUrl.includes('checkpoint') || finalUrl.includes('challenge')) {
                console.log('Still on checkpoint page. Attempting automatic reCAPTCHA solving again...');
                const checkpointSolved = await scraper.solveCheckpointChallenge();
                
                if (checkpointSolved) {
                  console.log('✓ Checkpoint solved! Verifying login...');
                  await delay(5000);
                  
                  // Re-check URL and login status
                  const newUrl = scraper.page.url();
                  const finalLoginCheck = await scraper.page.evaluate(() => {
                    return document.querySelector('[data-test-id="nav-settings"]') !== null ||
                           document.querySelector('[data-test-id="nav-item-feed"]') !== null ||
                           document.body.textContent.includes('Sign out') ||
                           window.location.href.includes('/feed') ||
                           window.location.href.includes('/mynetwork');
                  });
                  
                  if (finalLoginCheck || (!newUrl.includes('checkpoint') && !newUrl.includes('challenge') && !newUrl.includes('login'))) {
                    console.log('✓ Login successful after checkpoint solve!');
                    console.log(`Current URL: ${newUrl}`);
                    // Save cookies after successful login
                    await scraper.saveCookies();
                    // Continue with scraping - login is successful
                  } else {
                    console.error('=== LOGIN FAILED AFTER CHECKPOINT SOLVE ===');
                    console.error(`Current URL: ${newUrl}`);
                    throw new Error('Login failed - checkpoint challenge not resolved');
                  }
                } else {
                  // Even if checkpoint solving failed, check if we're logged in
                  await delay(3000);
                  const finalLoginCheck = await scraper.page.evaluate(() => {
                    return document.querySelector('[data-test-id="nav-settings"]') !== null ||
                           document.body.textContent.includes('Sign out') ||
                           window.location.href.includes('/feed') ||
                           window.location.href.includes('/mynetwork') ||
                           (!window.location.href.includes('checkpoint') && 
                            !window.location.href.includes('challenge') &&
                            !window.location.href.includes('login'));
                  });
                  
                  const checkUrl = scraper.page.url();
                  if (finalLoginCheck || (!checkUrl.includes('login') && !checkUrl.includes('checkpoint'))) {
                    console.log('✓ Login actually succeeded despite checkpoint solve returning false!');
                    console.log(`Current URL: ${checkUrl}`);
                    // Save cookies after successful login
                    await scraper.saveCookies();
                    // Continue with scraping - login is actually successful
                  } else {
                    console.error('=== LOGIN FAILED ===');
                    console.error('Cannot proceed with scraping without successful login.');
                    console.error('Possible reasons:');
                    console.error('1. Invalid credentials');
                    console.error('2. Account requires verification');
                    console.error('3. LinkedIn security challenge (reCAPTCHA)');
                    console.error('4. Network issues');
                    console.error('');
                    console.error('Please check your credentials in .env file and try again.');
                    console.error('You can also run with --no-headless to see what\'s happening.');
                    console.error(`Final URL: ${checkUrl}`);
                    throw new Error('Login failed - cannot proceed with scraping');
                  }
                }
              } else {
                // Not on checkpoint - check if we're actually logged in
                const finalLoginCheck = await scraper.page.evaluate(() => {
                  return document.querySelector('[data-test-id="nav-settings"]') !== null ||
                         document.body.textContent.includes('Sign out') ||
                         window.location.href.includes('/feed') ||
                         window.location.href.includes('/mynetwork');
                });
                
                if (finalLoginCheck || (!finalUrl.includes('login') && !finalUrl.includes('checkpoint'))) {
                  console.log('✓ Login actually succeeded! Verification was too strict.');
                  console.log(`Current URL: ${finalUrl}`);
                  // Save cookies after successful login
                  await scraper.saveCookies();
                  // Continue with scraping - login is actually successful
                } else {
                  console.error('=== LOGIN FAILED ===');
                  console.error('Cannot proceed with scraping without successful login.');
                  console.error('Possible reasons:');
                  console.error('1. Invalid credentials');
                  console.error('2. Account requires verification');
                  console.error('3. LinkedIn security challenge');
                  console.error('4. Network issues');
                  console.error('');
                  console.error('Please check your credentials in .env file and try again.');
                  console.error('You can also run with --no-headless to see what\'s happening.');
                  console.error(`Final URL: ${finalUrl}`);
                  throw new Error('Login failed - cannot proceed with scraping');
                }
              }
            }
          } else {
          console.log('=== LOGIN SUCCESSFUL ===');
          
          // Save cookies immediately after successful login
          await scraper.saveCookies();
          
          // Verify login by navigating to feed to establish session
          console.log('Verifying login by accessing feed...');
          try {
            await scraper.page.goto('https://www.linkedin.com/feed', {
              waitUntil: 'networkidle2',
              timeout: 30000,
            });
            await delay(2000);
            
            const feedUrl = scraper.page.url();
            
            // Check if we hit a checkpoint/challenge page during feed verification
            if (feedUrl.includes('checkpoint') || feedUrl.includes('challenge')) {
              console.log('=== CHECKPOINT CHALLENGE DETECTED DURING FEED VERIFICATION ===');
              console.log('Attempting to solve reCAPTCHA...');
              const solved = await scraper.solveCheckpointChallenge();
              if (solved) {
                await delay(3000);
                // Try accessing feed again after solving
                await scraper.page.goto('https://www.linkedin.com/feed', {
                  waitUntil: 'networkidle2',
                  timeout: 30000,
                });
                await delay(2000);
                const newFeedUrl = scraper.page.url();
                if (newFeedUrl.includes('feed') || newFeedUrl.includes('mynetwork')) {
                  console.log('✓ Feed access successful after solving checkpoint!');
                  console.log('Login verified! Session established.');
                  // Save cookies again after checkpoint resolution
                  await scraper.saveCookies();
                  console.log('Proceeding with profile scraping...');
                } else {
                  console.warn('Still having issues accessing feed after solving checkpoint');
                }
              } else {
                console.error('Failed to solve checkpoint challenge during feed verification');
              }
            } else if (feedUrl.includes('feed') || feedUrl.includes('mynetwork')) {
              console.log('✓ Login verified! Session established.');
              console.log('Proceeding with profile scraping...');
            } else {
              console.warn('Feed access may have failed, but continuing...');
              console.warn(`Current URL: ${feedUrl}`);
            }
          } catch (error) {
            console.warn(`Feed verification failed: ${error.message}`);
            console.warn('Continuing with scraping anyway...');
          }
        }
      } else {
        console.warn('No credentials provided. Profiles may require login.');
        console.warn('Some profiles will not be accessible without login.');
      }

      if (command === 'login-only') {
        // Login-only mode: Forces non-headless, logs in, saves cookies, then closes
        console.log('=== LOGIN-ONLY MODE ===');
        console.log('Running in non-headless mode for login...');
        
        // Force non-headless mode for login
        scraper.headless = false;
        // Need to reinitialize with non-headless
        await scraper.close();
        await scraper.init();
        
        // Load and check cookies first
        const savedCookies = await scraper.loadCookies();
        if (savedCookies && savedCookies.length > 0) {
          await scraper.setCookies(savedCookies);
          const cookiesValid = await scraper.verifyCookies();
          
          if (cookiesValid) {
            console.log('✓ Cookies are already valid - login not needed');
            console.log(JSON.stringify({ success: true, message: 'Cookies are valid' }));
            await scraper.close();
            process.exit(0);
          }
        }
        
        // Login required
        if (!scraper.email || !scraper.password) {
          console.error(JSON.stringify({ error: 'Credentials required for login' }));
          await scraper.close();
          process.exit(1);
        }
        
        const loginSuccess = await scraper.login();
        
        if (loginSuccess) {
          console.log('✓ Login successful! Cookies saved.');
          console.log(JSON.stringify({ success: true, message: 'Login successful, cookies saved' }));
        } else {
          console.error(JSON.stringify({ error: 'Login failed' }));
          await scraper.close();
          process.exit(1);
        }
        
        // Close browser after login
        await scraper.close();
        process.exit(0);
      } else if (command === 'scrape') {
        // Scrape command always runs in headless mode (login already done separately)
        console.log('=== SCRAPING MODE ===');
        console.log('Running in headless mode for fast scraping...');
        
        // Ensure headless mode for scraping
        if (!isHeadless) {
          console.log('Switching to headless mode for scraping (login already completed)...');
          await scraper.close();
          scraper.headless = true;
          await scraper.init();
        }
        
        // Load cookies before scraping
        const savedCookies = await scraper.loadCookies();
        if (savedCookies && savedCookies.length > 0) {
          console.log('Loading saved cookies for scraping...');
          await scraper.setCookies(savedCookies);
          // Verify cookies are still valid
          const cookiesValid = await scraper.verifyCookies();
          if (!cookiesValid) {
            console.error('Cookies are invalid. Please run login first.');
            console.error(JSON.stringify({ error: 'Invalid cookies - login required' }));
            await scraper.close();
            process.exit(1);
          }
          console.log('✓ Cookies loaded and verified');
        } else {
          console.error('No cookies found. Please login first.');
          console.error(JSON.stringify({ error: 'No cookies - login required' }));
          await scraper.close();
          process.exit(1);
        }
        
        // Get URLs from command line arguments or from file
        const urls = args.slice(1).filter(arg => arg.startsWith('http') && !arg.startsWith('--'));

        // Check for --multi-tab or --sequential flag
        const useMultiTab = args.includes('--multi-tab') || urls.length > 1; // Default to multi-tab for multiple URLs
        const useSequential = args.includes('--sequential');

        // Get max concurrent tabs from args (default 3)
        const maxConcurrentMatch = args.find(arg => arg.startsWith('--max-tabs='));
        const maxConcurrent = maxConcurrentMatch ? parseInt(maxConcurrentMatch.split('=')[1]) : 3;

        if (urls.length > 0) {
          console.log(`\n=== STARTING PROFILE SCRAPING ===`);
          console.log(`Found ${urls.length} profile URL(s) to scrape\n`);

          let results;

          // Scrape single profile
          if (urls.length === 1) {
            const profileData = await scraper.scrapeProfile(urls[0]);
            results = [profileData];
          } else {
            // Scrape multiple profiles - use multi-tab by default unless --sequential is specified
            if (useSequential) {
              console.log('Using sequential scraping mode');
              results = await scraper.scrapeProfiles(urls);
            } else {
              console.log(`Using multi-tab scraping mode (max ${maxConcurrent} concurrent tabs)`);
              results = await scraper.scrapeProfilesInTabs(urls, maxConcurrent);
            }
          }

          // Output JSON results
          console.log(JSON.stringify(results));
          console.log('\n=== SCRAPING COMPLETED ===');
        } else {
          // Read from stdin
          const readline = require('readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });

          const urlsFromStdin = [];
          for await (const line of rl) {
            const url = line.trim();
            if (url && url.startsWith('http')) {
              urlsFromStdin.push(url);
            }
          }

          if (urlsFromStdin.length > 0) {
            let results;
            if (useSequential || urlsFromStdin.length === 1) {
              results = await scraper.scrapeProfiles(urlsFromStdin);
            } else {
              console.log(`Using multi-tab scraping mode (max ${maxConcurrent} concurrent tabs)`);
              results = await scraper.scrapeProfilesInTabs(urlsFromStdin, maxConcurrent);
            }
            console.log(JSON.stringify(results));
          } else {
            console.error(JSON.stringify({ error: 'No profile URLs provided' }));
            process.exit(1);
          }
        }
      } else {
        console.error(JSON.stringify({ error: `Unknown command: ${command}` }));
        process.exit(1);
      }
    } catch (error) {
      console.error(`Fatal error: ${error.message}`);
      console.error('This error occurred:', error.stack);
      
      // Only close browser if it's a critical error
      // If it's just a login error, we might want to keep it open for debugging
      if (error.message.includes('Login failed')) {
        console.error('\nBrowser will remain open for 10 seconds for debugging...');
        console.error('If running with --no-headless, you can inspect the page.');
        await delay(10000);
      }
      
      console.error(JSON.stringify({ error: error.message }));
      process.exit(1);
    } finally {
      // Only close browser after all scraping is done
      console.log('Closing browser...');
      await scraper.close();
    }
  })();
}

module.exports = LinkedInScraper;

