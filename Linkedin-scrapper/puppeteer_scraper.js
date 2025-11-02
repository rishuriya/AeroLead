/**
 * LinkedIn Scraper using Puppeteer with reCAPTCHA v2 Solver
 * This module can be called from Python via command line or stdin/stdout
 * 
 * This file is now a compatibility wrapper - the actual implementation
 * is modularized into separate files:
 * - scraper.js: Main LinkedInScraper class
 * - browser.js: Browser initialization and cookie management
 * - login.js: Login and authentication
 * - extraction.js: Data extraction (Gemini and HTML to markdown)
 * - cli.js: Command line interface
 * - utils.js: Utility functions
 */

// Export the main scraper class for backwards compatibility
module.exports = require('./scraper');

// Run CLI if this is the main module
if (require.main === module) {
  const CLI = require('./cli');
  const cli = new CLI();
  cli.run().catch(error => {
    console.error(`Fatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  });
}
