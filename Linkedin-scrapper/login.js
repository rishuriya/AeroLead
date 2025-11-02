/**
 * LinkedIn login and authentication utilities
 */

const { delay } = require('./utils');

class LoginManager {
  constructor(page, email, password, saveCookies) {
    this.page = page;
    this.email = email;
    this.password = password;
    this.saveCookies = saveCookies;
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

      await this.page.waitForSelector('input#username', { timeout: 10000 });
      await this.page.waitForSelector('input#password', { timeout: 10000 });

      await this.page.type('input#username', this.email, { delay: 100 });
      await this.page.type('input#password', this.password, { delay: 100 });

      // Check for CAPTCHA
      const captchaPresent = await this.page.evaluate(() => {
        const iframe = document.querySelector('iframe[src*="recaptcha"]') ||
                      document.querySelector('iframe[src*="captcha"]');
        return iframe !== null;
      });

      if (captchaPresent) {
        await this.waitForCaptchaSolve();
      }

      // Submit login
      console.log('Submitting login form...');
      await this.page.click('button[type="submit"]');
      
      // Wait for navigation
      await this.waitForLoginResponse();

      // Check login status
      const currentUrl = this.page.url();
      const isLoggedIn = await this.verifyLoginStatus();

      if (currentUrl.includes('feed') || currentUrl.includes('mynetwork') || isLoggedIn) {
        console.log('✓ Login successful!');
        await this.saveCookies();
        return true;
      } else if (currentUrl.includes('checkpoint') || currentUrl.includes('challenge')) {
        console.log('=== CHECKPOINT/CHALLENGE PAGE DETECTED ===');
        const solved = await this.solveCheckpointChallenge();
        if (solved) {
          await this.saveCookies();
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error(`Login failed: ${error.message}`);
      return false;
    }
  }

  async waitForCaptchaSolve() {
    console.log('\n==========================================');
    console.log('⚠️  CAPTCHA DETECTED - MANUAL ACTION REQUIRED');
    console.log('Please solve the CAPTCHA in the browser window.');
    console.log('The scraper will wait up to 3 minutes.');
    console.log('==========================================\n');

    const maxWaitTime = 180000; // 3 minutes
    const startTime = Date.now();
    let solved = false;

    while (!solved && (Date.now() - startTime) < maxWaitTime) {
      await delay(3000);

      solved = await this.page.evaluate(() => {
        const responseInput = document.querySelector('textarea#g-recaptcha-response, textarea[name="g-recaptcha-response"]');
        if (responseInput && responseInput.value && responseInput.value.length > 20) {
          return true;
        }
        if (window.grecaptcha && typeof window.grecaptcha.getResponse === 'function') {
          try {
            const response = window.grecaptcha.getResponse();
            return response && response.length > 20;
          } catch (e) {
            return false;
          }
        }
        return false;
      });

      if (solved) {
        console.log('✓ CAPTCHA solved! Continuing login...');
        await delay(2000);
        break;
      }

      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      if (elapsed % 15 === 0 && elapsed > 0) {
        console.log(`⏳ Still waiting for CAPTCHA... (${elapsed}s elapsed)`);
      }
    }

    if (!solved) {
      throw new Error('CAPTCHA solving timeout - user did not solve CAPTCHA in time');
    }
  }

  async waitForLoginResponse() {
    console.log('Waiting for login response...');
    const startUrl = this.page.url();
    
    // Wait for URL to change (max 30 seconds)
    for (let i = 0; i < 60; i++) {
      await delay(500);
      const currentUrl = this.page.url();
      if (currentUrl !== startUrl && !currentUrl.includes('login')) {
        break;
      }
    }
    
    await delay(2000);
  }

  async verifyLoginStatus() {
    return await this.page.evaluate(() => {
      return document.querySelector('[data-test-id="nav-settings"]') !== null ||
             document.querySelector('[data-test-id="nav-item-feed"]') !== null ||
             document.querySelector('.feed-container') !== null ||
             document.body.textContent.includes('Sign out') ||
             window.location.href.includes('/feed') ||
             window.location.href.includes('/mynetwork');
    });
  }

  async solveCheckpointChallenge() {
    console.log('\n==========================================');
    console.log('⚠️  SECURITY CHECKPOINT DETECTED');
    console.log('Please solve any CAPTCHA or challenge in the browser.');
    console.log('The scraper will wait up to 3 minutes.');
    console.log('==========================================\n');

    await delay(3000);

    const hasCaptcha = await this.page.evaluate(() => {
      const iframe = document.querySelector('iframe[src*="recaptcha"]') ||
                    document.querySelector('iframe[src*="captcha"]');
      return iframe !== null;
    });

    if (hasCaptcha) {
      await this.waitForCaptchaSolve();
    }

    await delay(2000);
    const submitted = await this.submitCheckpointForm();

    if (submitted) {
      await delay(5000);
      const newUrl = this.page.url();
      if (!newUrl.includes('checkpoint') && !newUrl.includes('challenge')) {
        return true;
      }
    }

    return false;
  }

  async submitCheckpointForm() {
    try {
      await delay(3000);
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        const buttonClicked = await this.page.evaluate((attempt) => {
          const buttonSelectors = [
            'button[type="submit"]',
            'button.challenge__button',
            'button[aria-label*="Continue"]',
            'button[aria-label*="Verify"]',
            'button.artdeco-button--primary',
          ];
          
          for (const selector of buttonSelectors) {
            try {
              const btn = document.querySelector(selector);
              if (btn && btn.offsetParent !== null && !btn.disabled) {
                btn.click();
                return true;
              }
            } catch (e) {
              continue;
            }
          }
          
          // Try by text
          const allButtons = document.querySelectorAll('button');
          for (const btn of allButtons) {
            const text = btn.textContent.toLowerCase().trim();
            if ((text.includes('continue') || text.includes('verify') || text.includes('submit')) &&
                btn.offsetParent !== null && !btn.disabled) {
              btn.click();
              return true;
            }
          }
          
          return false;
        }, attempt);
        
        if (buttonClicked) {
          await delay(5000);
          const currentUrl = this.page.url();
          if (!currentUrl.includes('checkpoint') && !currentUrl.includes('challenge')) {
            return true;
          }
        }
        
        if (attempt < 3) {
          await delay(3000);
        }
      }
      
      return false;
    } catch (error) {
      console.warn(`Error submitting checkpoint form: ${error.message}`);
      return false;
    }
  }

  async handleAuthwall(originalUrl) {
    console.log('Handling authwall page - performing fresh login...');
    
    await this.page.goto('https://www.linkedin.com/login', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    
    await delay(1000);
    
    const loginSuccess = await this.login();
    
    if (loginSuccess) {
      return originalUrl;
    } else {
      throw new Error('Login failed - credentials may be incorrect or account requires verification');
    }
  }
}

module.exports = LoginManager;
