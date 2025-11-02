/**
 * LinkedIn profile data extraction utilities
 * Handles HTML to markdown conversion and Gemini AI parsing
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

class ExtractionManager {
  constructor(geminiApiKey) {
    this.geminiApiKey = geminiApiKey;
  }

  /**
   * Extract profile image URL from page (not cover image)
   */
  async extractProfileImage(page) {
    return await page.evaluate(() => {
      // First, try specific selectors for profile images (not cover images)
      const profileImageSelectors = [
        'img.pv-top-card-profile-picture__image',
        'img.pv-top-card-profile-picture img',
        'button.pv-top-card-profile-picture img',
        'img.profile-photo-edit__preview',
        '.pv-top-card__photo img',
        '.pv-top-card--photo img',
        'img.presence-entity__image',
        '.profile-photo img',
        'div.pv-top-card__photo img',
        // New LinkedIn structure
        'img[data-anonymize="profile-photo"]',
        '[data-test-id="profile-photo"] img',
        // Try to find circular images in the top card area
        '.pv-top-card img[src*="profile"]',
        '.pv-top-card img[src*="dms/image"]',
      ];

      // Try each selector
      for (const selector of profileImageSelectors) {
        try {
          const img = document.querySelector(selector);
          if (img && img.src && 
              img.src.startsWith('http') && 
              !img.src.includes('data:') && 
              !img.src.includes('ghost') &&
              !img.src.includes('cover') &&
              !img.src.includes('background') &&
              !img.src.includes('banner')) {
            // Additional check: make sure it's not a cover image
            // Cover images are usually much larger (rectangular) and in different containers
            const parent = img.closest('.pv-top-card, .pv-top-card__photo, .profile-photo, [data-test-id="profile-photo"]');
            const isCover = img.closest('.pv-top-card__background-image, .profile-background-image, [class*="background"], [class*="cover"]');
            
            if (parent && !isCover) {
              // Verify it's likely a profile image by checking dimensions or context
              // Profile images are usually square/circular, cover images are wide rectangles
              const width = img.naturalWidth || img.width || 0;
              const height = img.naturalHeight || img.height || 0;
              
              // Profile images are typically more square (width and height similar)
              // Cover images are much wider than tall
              const aspectRatio = width > 0 && height > 0 ? width / height : 1;
              
              // Profile images: aspect ratio between 0.8 and 1.2 (roughly square)
              // Cover images: aspect ratio > 2 (much wider)
              if (aspectRatio >= 0.8 && aspectRatio <= 1.5) {
                return img.src;
              } else if (aspectRatio > 2) {
                // Likely a cover image, skip
                continue;
              }
              
              // If we can't determine from dimensions, use it anyway if it's in the right container
              return img.src;
            }
          }
        } catch (e) {
          // Continue to next selector
          continue;
        }
      }

      // Fallback: search all images but exclude cover/background images
      const allImages = document.querySelectorAll('img');
      for (const img of allImages) {
        if (img.src && 
            img.src.startsWith('http') && 
            !img.src.includes('data:') && 
            !img.src.includes('ghost') &&
            !img.src.includes('cover') &&
            !img.src.includes('background') &&
            !img.src.includes('banner')) {
          
          // Check if it's in a profile photo container (not cover)
          const parent = img.parentElement;
          if (parent) {
            const parentClasses = parent.className || '';
            const parentId = parent.id || '';
            const isProfilePhotoContainer = 
              parentClasses.includes('profile-photo') ||
              parentClasses.includes('pv-top-card-profile-picture') ||
              parentClasses.includes('pv-top-card__photo') ||
              parentId.includes('profile-photo');
            
            const isCoverContainer = 
              parentClasses.includes('background') ||
              parentClasses.includes('cover') ||
              parentClasses.includes('banner') ||
              parentId.includes('cover') ||
              parentId.includes('background');
            
            if (isProfilePhotoContainer && !isCoverContainer) {
              return img.src;
            }
          }
          
          // Additional URL-based check
          if ((img.src.includes('profile') || img.src.includes('dms/image')) &&
              !img.src.includes('cover') &&
              !img.src.includes('background')) {
            // Make sure it's not in a cover/background element
            const isInCover = img.closest('[class*="cover"], [class*="background"], [class*="banner"]');
            if (!isInCover) {
              // Check aspect ratio as final filter
              const width = img.naturalWidth || img.width || 0;
              const height = img.naturalHeight || img.height || 0;
              const aspectRatio = width > 0 && height > 0 ? width / height : 1;
              
              // Prefer square-ish images (profile photos) over wide images (cover photos)
              if (aspectRatio >= 0.8 && aspectRatio <= 1.5) {
                return img.src;
              }
            }
          }
        }
      }

      return 'N/A';
    });
  }

  /**
   * Convert HTML to clean markdown (removes sidebars, suggestions, etc.)
   */
  async convertHtmlToMarkdown(page) {
    return await page.evaluate(() => {
      // Helper to convert HTML to markdown
      const htmlToMarkdown = (element) => {
        if (!element) return '';
        
        let markdown = '';
        const tagName = element.tagName?.toLowerCase();
        
        // Headers
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
          const level = parseInt(tagName.substring(1));
          let text = '';
          for (const child of element.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
              text += child.textContent;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
              text += htmlToMarkdown(child);
            }
          }
          text = text.trim();
          if (text) markdown += '\n' + '#'.repeat(level) + ' ' + text + '\n';
        }
        // Lists
        else if (tagName === 'ul' || tagName === 'ol') {
          const items = element.querySelectorAll(':scope > li');
          for (const item of items) {
            const itemText = htmlToMarkdown(item);
            if (itemText.trim()) {
              markdown += '- ' + itemText.trim() + '\n';
            }
          }
        }
        // List items
        else if (tagName === 'li') {
          for (const child of element.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
              const text = child.textContent.trim();
              if (text) markdown += text + ' ';
            } else if (child.nodeType === Node.ELEMENT_NODE) {
              markdown += htmlToMarkdown(child);
            }
          }
        }
        // Paragraphs
        else if (tagName === 'p') {
          let text = '';
          for (const child of element.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
              text += child.textContent;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
              text += htmlToMarkdown(child);
            }
          }
          text = text.trim();
          if (text) markdown += text + '\n\n';
        }
        // Bold
        else if (tagName === 'strong' || tagName === 'b') {
          const text = element.textContent.trim();
          if (text) markdown += '**' + text + '**';
        }
        // Italic
        else if (tagName === 'em' || tagName === 'i') {
          const text = element.textContent.trim();
          if (text) markdown += '*' + text + '*';
        }
        // Links
        else if (tagName === 'a') {
          const text = element.textContent.trim();
          const href = element.href;
          if (text && href && !href.includes('javascript:')) {
            markdown += '[' + text + '](' + href + ')';
          } else if (text) {
            markdown += text;
          }
        }
        // Line breaks
        else if (tagName === 'br') {
          markdown += '\n';
        }
        // Sections/divs
        else if (tagName === 'section' || tagName === 'div' || tagName === 'article') {
          for (const child of element.children) {
            markdown += htmlToMarkdown(child);
          }
        }
        // Other elements
        else {
          if (!element.children || element.children.length === 0) {
            const text = element.textContent.trim();
            if (text && text.length < 1000) {
              markdown += text + ' ';
            }
          } else {
            for (const child of element.children) {
              markdown += htmlToMarkdown(child);
            }
          }
        }
        
        return markdown;
      };

      // Find main content area
      const mainContent = document.querySelector('main') ||
                         document.querySelector('.scaffold-layout__main') ||
                         document.querySelector('#profile-content');
      
      if (!mainContent) {
        return 'ERROR: Could not find main content area';
      }

      const clone = mainContent.cloneNode(true);

      // Remove unwanted elements (sidebars, suggestions, navigation, etc.)
      const unwantedSelectors = [
        'nav', 'header', 'footer',
        '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
        'aside', '[class*="sidebar"]', '[class*="suggestion"]',
        '[class*="recommendation"]', '[class*="people-also-viewed"]',
        '.scaffold-layout__aside', '.scaffold-layout__sidebar',
        '[data-test-id="people-also-viewed"]', '[class*="entity-result"]',
        '.artdeco-modal', '.msg-overlay-list-bubble', '[role="dialog"]',
        '.search-global-typeahead', '.global-nav', '.app-aware-link',
        'script', 'style', 'noscript', 'iframe', 'button', 'svg',
        '[class*="ad"]', '[class*="sponsored"]', '[class*="promoted"]',
        '[data-test-id="nav"]', '[class*="navigation"]',
        '.messaging-global-nav', '.notification-global-nav'
      ];

      unwantedSelectors.forEach(selector => {
        try {
          const elements = clone.querySelectorAll(selector);
          elements.forEach(el => el.remove());
        } catch (e) {
          // Ignore selector errors
        }
      });

      // Also remove elements with suggestion/sidebar in class/id
      const allElements = clone.querySelectorAll('*');
      allElements.forEach(el => {
        const className = el.className || '';
        const id = el.id || '';
        const combined = (className + ' ' + id).toLowerCase();
        
        if (combined.includes('suggestion') || 
            combined.includes('sidebar') || 
            combined.includes('recommendation') ||
            combined.includes('people-also-viewed')) {
          el.remove();
        }
      });

      // Convert to markdown
      let markdown = htmlToMarkdown(clone);
      
      // Clean up markdown
      markdown = markdown
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .trim();

      // Add metadata
      const output = `=== PROFILE URL ===\n${window.location.href}\n\n` +
                    `=== SCRAPED AT ===\n${new Date().toISOString()}\n\n` +
                    `=== PROFILE CONTENT ===\n${markdown}\n`;

      return output.substring(0, 50000); // Limit to 50k chars
    });
  }

  /**
   * Parse markdown text with Gemini AI
   */
  async parseProfileWithGemini(page, markdownText) {
    if (!this.geminiApiKey) {
      throw new Error('Gemini API key not provided');
    }

    const genAI = new GoogleGenerativeAI(this.geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are a LinkedIn profile data extraction expert. You will receive MARKDOWN text from a LinkedIn profile page.

YOUR TASK:
Extract structured data and return it as JSON. Be intelligent, adaptive, and context-aware, but NEVER fabricate information.

LINKEDIN PROFILE MARKDOWN:
${markdownText}

CORE PRINCIPLES:
1. Extract ONLY information explicitly present in the text
2. Adapt to various markdown structures and formatting inconsistencies
3. Use context clues to understand information hierarchy
4. Handle variations in section names, formatting, and structure
5. Be resilient to OCR errors, typos, and formatting issues
6. If information is unclear or missing, use "N/A" instead of guessing

MARKDOWN STRUCTURE INTERPRETATION:
- Headers (#, ##, ###) indicate section boundaries - be flexible with naming variations
- Common section names: "Experience", "Work Experience", "Employment History", "Professional Experience"
- Common education names: "Education", "Academic Background", "Qualifications"
- Common skills names: "Skills", "Skills & Endorsements", "Core Competencies", "Expertise"
- Bullet points (-, *, •) and bold text (**text**) highlight key information
- Links [text](url) may contain additional context
- Date formats vary: "Jan 2020 - Present", "2020-Present", "January 2020 - Current", etc.

TEXT CLEANING & NORMALIZATION:
- Remove duplicate words/characters (e.g., "SDESDE" → "SDE" or "Software Development Engineer")
- Expand common abbreviations contextually:
  * SDE → Software Development Engineer (or Software Development Engineer depending on context)
  * PM → Product Manager / Project Manager
  * VP → Vice President
  * CEO, CTO, CFO → Chief Executive/Technology/Financial Officer
  * Sr. → Senior, Jr. → Junior
- Fix obvious OCR errors and typos
- Normalize whitespace (single spaces, no leading/trailing spaces)
- Preserve original meaning while making text readable
- For ambiguous abbreviations, prefer the most common professional interpretation

EXPERIENCE EXTRACTION:
- Identify current position by: "Present", "Current", "Now", or recent dates without end date
- Extract ALL job entries from experience section
- Handle various formats:
  * "Position at Company (Date - Date)"
  * "**Position** | Company | Date - Date"
  * "Position\nCompany\nDate - Date"
- If current position unclear, use the most recent/first entry
- Capture full date ranges as written

EDUCATION EXTRACTION:
- Extract ALL educational institutions and degrees
- Handle variations: "Bachelor of Science", "BS", "B.S.", "BSc"
- Include: universities, colleges, bootcamps, certifications
- If degree not specified, still include the institution

SKILLS EXTRACTION:
- Extract ALL skills regardless of section formatting
- Handle: bullet lists, comma-separated, tagged format
- Include endorsement counts if visible (optional)
- Maintain original skill names (case-sensitive)

CONTACT INFORMATION:
- Look for email patterns (text@domain.com)
- Phone numbers in various formats
- Website/portfolio links
- Social media handles

ADAPTIVE PARSING:
- If standard sections aren't found, scan entire text intelligently
- Recognize job titles even without explicit "Experience" header
- Identify schools even without "Education" header
- Be flexible with date formats and ranges
- Handle international formats (DD/MM/YYYY, Month YYYY, etc.)

OUTPUT FORMAT (return ONLY valid JSON, no markdown blocks):
{
  "profile_url": "from metadata or N/A",
  "scraped_at": "from metadata or N/A",
  "name": "full name or N/A",
  "headline": "professional headline or N/A",
  "location": "city, country or N/A",
  "about": "complete about section or N/A",
  "current_company": "most recent company or N/A",
  "current_position": "most recent position or N/A",
  "all_experience": [
    {
      "position": "cleaned and normalized position title",
      "company": "company name as written",
      "duration": "date range as written",
      "description": "job description if available or N/A"
    }
  ],
  "education": "first/primary school name or N/A",
  "all_education": [
    {
      "school": "institution name as written",
      "degree": "degree/program name or N/A",
      "duration": "date range if available or N/A",
      "field": "field of study if available or N/A"
    }
  ],
  "top_skills": "first 10 skills comma-separated or N/A",
  "all_skills": "all skills comma-separated or N/A",
  "skills_count": 0,
  "email": "email or N/A",
  "phone": "phone or N/A",
  "website": "website/portfolio or N/A",
  "profile_image_url": "N/A",
  "connections": "connection count or N/A",
  "followers": "follower count if available or N/A",
  "pronouns": "pronouns if specified or N/A",
  "languages": "languages if listed or N/A",
  "certifications": "certifications if listed or N/A",
  "volunteer_experience": "volunteer work if listed or N/A"
}

CRITICAL REMINDERS:
- Return ONLY the JSON object, no explanatory text
- No markdown code blocks (``), just pure JSON
- Every array field must be an array, even if empty: []
- Every string field must be a string, use "N/A" for missing data
- Ensure all JSON is properly escaped and valid
- Be comprehensive: extract ALL jobs, schools, and skills found
- Prioritize accuracy over assumptions`

    try {
      console.log('Sending markdown to Gemini for parsing...');
      const result = await model.generateContent(prompt);
      const response = result.response;
      let text = response.text();

      // Clean up response
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
        console.log(`✓ Gemini successfully parsed profile`);
      } catch (parseError) {
        console.error('Failed to parse Gemini response as JSON');
        console.error('Response preview:', text.substring(0, 500));
        throw new Error(`JSON parsing failed: ${parseError.message}`);
      }

      // Build final result with defaults
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

      console.log(`✓ Parsed: ${finalResult.name}, Experience: ${finalResult.all_experience.length}, Education: ${finalResult.all_education.length}`);

      return finalResult;
    } catch (error) {
      console.error(`Gemini parsing error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract profile data using Gemini AI (main method)
   */
  async extractProfileDataWithGemini(page) {
    // Extract profile image
    const profileImageUrl = await this.extractProfileImage(page);

    // Convert HTML to markdown
    const markdownText = await this.convertHtmlToMarkdown(page);
    
    console.log(`Extracted ${markdownText.length} characters of clean markdown from page`);

    // Save debug output if needed
    if (process.env.DEBUG_SAVE_CONTENT === 'true') {
      const debugPath = `debug_extracted_markdown_${Date.now()}.txt`;
      fs.writeFileSync(debugPath, markdownText);
      console.log(`📄 DEBUG: Saved extracted markdown to ${debugPath}`);
    }

    // Validate markdown
    if (markdownText.length < 500 || markdownText.includes('ERROR:')) {
      throw new Error('Markdown extraction failed - content too short or error occurred');
    }

    // Parse with Gemini
    const profileData = await this.parseProfileWithGemini(page, markdownText);

    // Add profile image URL
    if (profileImageUrl && profileImageUrl !== 'N/A') {
      profileData.profile_image_url = profileImageUrl;
    }

    return profileData;
  }

  /**
   * Extract contact info by clicking Contact Info button
   */
  async extractContactInfo(page) {
    const { delay } = require('./utils');
    
    try {
      console.log('Looking for Contact Info button...');

      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await delay(1000);

      // Try to find and click Contact Info button
      const contactButtonSelectors = [
        'a[href*="overlay/contact-info"]',
        'a#top-card-text-details-contact-info',
        'a[data-control-name="contact_see_more"]',
        'button[aria-label*="Contact"]',
      ];

      let contactButtonClicked = false;

      for (const selector of contactButtonSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            const isVisible = await page.evaluate((btn) => {
              const rect = btn.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0 &&
                     window.getComputedStyle(btn).display !== 'none' &&
                     window.getComputedStyle(btn).visibility !== 'hidden';
            }, button);

            if (isVisible) {
              console.log(`Found Contact Info button with selector: ${selector}`);
              await button.click();
              contactButtonClicked = true;
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }

      if (!contactButtonClicked) {
        console.warn('Could not find Contact Info button');
        return { email: 'N/A', phone: 'N/A', website: 'N/A' };
      }

      console.log('✓ Contact Info button clicked, waiting for modal...');
      await delay(2000);

      // Extract contact data from modal
      const contactData = await page.evaluate(() => {
        const data = { email: 'N/A', phone: 'N/A', website: 'N/A' };

        const modal = document.querySelector('.artdeco-modal__content') ||
                     document.querySelector('[role="dialog"]') ||
                     document.body;

        const links = modal.querySelectorAll('a');

        links.forEach(link => {
          const href = link.href;

          if (href && href.startsWith('mailto:') && data.email === 'N/A') {
            data.email = href.replace('mailto:', '').trim();
          }

          if (href && href.startsWith('tel:') && data.phone === 'N/A') {
            data.phone = href.replace('tel:', '').trim();
          }

          if (href &&
              href.startsWith('http') &&
              !href.includes('linkedin.com') &&
              data.website === 'N/A') {
            data.website = href.trim();
          }
        });

        // Try regex if not found in links
        if (data.phone === 'N/A') {
          const modalText = modal.textContent;
          const phoneMatch = modalText.match(/(\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
          if (phoneMatch) {
            data.phone = phoneMatch[0].trim();
          }
        }

        if (data.email === 'N/A') {
          const modalText = modal.textContent;
          const emailMatch = modalText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (emailMatch) {
            data.email = emailMatch[0].trim();
          }
        }

        return data;
      });

      console.log(`Extracted from modal: email=${contactData.email}, phone=${contactData.phone}, website=${contactData.website}`);

      // Close modal
      try {
        await page.keyboard.press('Escape');
        await delay(500);
      } catch (e) {
        // Ignore
      }

      return contactData;
    } catch (error) {
      console.warn(`Error extracting contact info: ${error.message}`);
      console.warn(`Error stack: ${error.stack}`);
      return { email: 'N/A', phone: 'N/A', website: 'N/A' };
    }
  }

  /**
   * Extract profile data with error handling
   */
  async extractProfileDataWithGeminiSafe(page) {
    try {
      return await this.extractProfileDataWithGemini(page);
    } catch (error) {
      console.error(`Gemini extraction error: ${error.message}`);
      console.error(`Error stack: ${error.stack}`);
      throw error; // Re-throw so caller can handle
    }
  }
}

module.exports = ExtractionManager;
