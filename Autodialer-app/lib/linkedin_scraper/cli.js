/**
 * Command line interface for LinkedIn scraper
 */

const LinkedInScraper = require('./scraper');
const { delay } = require('./utils');
const readline = require('readline');

class CLI {
  constructor() {
    this.args = process.argv.slice(2);
    this.command = this.args[0];
  }

  async run() {
    // Determine headless mode
    let isHeadless = true;
    if (this.args.includes('--no-headless')) {
      isHeadless = false;
    } else if (this.args.includes('--headless')) {
      isHeadless = true;
    } else if (process.env.HEADLESS === 'false') {
      isHeadless = false;
    }

    const scraper = new LinkedInScraper({
      headless: isHeadless,
      email: process.env.LINKEDIN_EMAIL,
      password: process.env.LINKEDIN_PASSWORD,
      geminiApiKey: process.env.GEMINI_API_KEY || '',
    });

    try {
      await scraper.init();

      if (this.command === 'login-only') {
        await this.handleLoginOnly(scraper);
      } else if (this.command === 'scrape') {
        await this.handleScrape(scraper, isHeadless);
      } else {
        console.error(JSON.stringify({ error: `Unknown command: ${this.command}` }));
        process.exit(1);
      }
    } catch (error) {
      // Ensure errors are logged to stderr before exiting
      console.error(`Fatal error: ${error.message}`);
      console.error('This error occurred:', error.stack);
      
      if (error.message.includes('Login failed')) {
        console.error('\nBrowser will remain open for 10 seconds for debugging...');
        await delay(10000);
      }
      
      // Output error as JSON for parsing
      console.error(JSON.stringify({ error: error.message }));
      
      try {
        await scraper.close();
      } catch (closeError) {
        // Ignore close errors
      }
      
      process.exit(1);
    } finally {
      try {
        await scraper.close();
      } catch (closeError) {
        // Ignore close errors in finally
      }
    }
  }

  async handleLoginOnly(scraper) {
    console.log('=== LOGIN-ONLY MODE ===');
    
    // Force non-headless for login
    if (scraper.browserManager.headless) {
      await scraper.close();
      scraper.browserManager.headless = false;
      await scraper.init();
    }

    // Check if cookies are already valid
    const savedCookies = await scraper.browserManager.loadCookies();
    if (savedCookies && savedCookies.length > 0) {
      await scraper.browserManager.setCookies(savedCookies);
      const cookiesValid = await scraper.browserManager.verifyCookies();
      
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

    const loginSuccess = await scraper.ensureLoggedIn();

    if (loginSuccess) {
      console.log('✓ Login successful! Cookies saved.');
      console.log(JSON.stringify({ success: true, message: 'Login successful, cookies saved' }));
    } else {
      console.error(JSON.stringify({ error: 'Login failed' }));
      await scraper.close();
      process.exit(1);
    }

    await scraper.close();
    process.exit(0);
  }

  async handleScrape(scraper, isHeadless) {
    // Log to stderr to avoid interfering with JSON output on stdout
    console.error('=== SCRAPING MODE ===');
    
    // Ensure headless mode for scraping
    if (!isHeadless && scraper.browserManager.headless === false) {
      console.error('Switching to headless mode for scraping...');
      await scraper.close();
      scraper.browserManager.headless = true;
      await scraper.init();
    }

    // Load and verify cookies
    const savedCookies = await scraper.browserManager.loadCookies();
    if (savedCookies && savedCookies.length > 0) {
      console.error('Loading saved cookies for scraping...');
      await scraper.browserManager.setCookies(savedCookies);
      const cookiesValid = await scraper.browserManager.verifyCookies();
      
      if (!cookiesValid) {
        const errorObj = { error: 'Invalid cookies - login required' };
        console.error('Cookies are invalid. Please run login first.');
        console.log(JSON.stringify(errorObj)); // Output JSON to stdout
        await scraper.close();
        process.exit(1);
      }
      console.error('✓ Cookies loaded and verified');
    } else {
      const errorObj = { error: 'No cookies - login required' };
      console.error('No cookies found. Please login first.');
      console.log(JSON.stringify(errorObj)); // Output JSON to stdout
      await scraper.close();
      process.exit(1);
    }

    // Get URLs from command line or stdin
    const urls = this.args.filter(arg => arg.startsWith('http') && !arg.startsWith('--'));

    // Check for flags
    const useMultiTab = this.args.includes('--multi-tab') || urls.length > 1;
    const useSequential = this.args.includes('--sequential');
    const maxConcurrentMatch = this.args.find(arg => arg.startsWith('--max-tabs='));
    const maxConcurrent = maxConcurrentMatch ? parseInt(maxConcurrentMatch.split('=')[1]) : 3;

    let profileUrls = [];

    if (urls.length > 0) {
      profileUrls = urls;
    } else {
      // Read from stdin
      profileUrls = await this.readUrlsFromStdin();
    }

    if (profileUrls.length === 0) {
      console.log(JSON.stringify({ error: 'No profile URLs provided' })); // stdout for JSON
      process.exit(1);
    }

    // Log to stderr to avoid interfering with JSON output on stdout
    console.error(`\n=== STARTING PROFILE SCRAPING ===`);
    console.error(`Found ${profileUrls.length} profile URL(s) to scrape\n`);

    let results;

    if (profileUrls.length === 1) {
      const profileData = await scraper.scrapeProfile(profileUrls[0]);
      results = [profileData];
    } else if (useSequential) {
      console.error('Using sequential scraping mode');
      results = await scraper.scrapeProfiles(profileUrls);
    } else {
      console.error(`Using multi-tab scraping mode (max ${maxConcurrent} concurrent tabs)`);
      results = await scraper.scrapeProfilesInTabs(profileUrls, maxConcurrent);
    }

    // Output JSON results (must be on stdout for Ruby to capture)
    const jsonOutput = JSON.stringify(results);
    console.log(jsonOutput);
    
    // Don't log completion message after JSON as it breaks parsing
    // console.log('\n=== SCRAPING COMPLETED ===');
  }

  async readUrlsFromStdin() {
    const urls = [];
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    for await (const line of rl) {
      const url = line.trim();
      if (url && url.startsWith('http')) {
        urls.push(url);
      }
    }

    return urls;
  }
}

module.exports = CLI;
