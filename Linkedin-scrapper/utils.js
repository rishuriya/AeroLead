/**
 * Utility functions for LinkedIn scraper
 */

// Helper function to replace deprecated waitForTimeout
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to find system Chrome/Chromium path
const findChromePath = () => {
  const platform = process.platform;
  const fs = require('fs');
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
  
  return null;
};

// Default profile data structure (for errors)
const getDefaultProfileData = (profileUrl, error = null) => ({
  profile_url: profileUrl,
  error: error || null,
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
  skills_count: 0,
  email: 'N/A',
  phone: 'N/A',
  website: 'N/A',
  profile_image_url: 'N/A',
  connections: 'N/A',
  pronouns: 'N/A'
});

module.exports = {
  delay,
  findChromePath,
  getDefaultProfileData
};

