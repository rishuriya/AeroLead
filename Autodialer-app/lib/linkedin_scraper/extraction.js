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

    const prompt = `You are a LinkedIn profile data extraction expert. You will receive clean MARKDOWN text from a LinkedIn profile page (HTML converted to markdown with sidebars removed).

YOUR TASK:
Extract structured data and return it as JSON. Be intelligent about understanding context, but NEVER make up information that isn't in the text.

LINKEDIN PROFILE MARKDOWN:
${markdownText}

EXTRACTION RULES:
1. Extract ONLY information explicitly present in the markdown text
2. Markdown format: # headers, - bullet lists, **bold**, [links](url)
3. Use markdown structure to understand hierarchy:
   - # Header indicates major section (Experience, Education, Skills)
   - ## Header indicates subsection
   - - bullet points indicate list items (jobs, schools, skills)
   - **bold** text often indicates important info (job titles, company names)
4. Identify current position by looking for "Present", "Current", or date ranges ending with "Present"
5. For experience: Look for section with "Experience" header, then extract EVERY job entry
6. For education: Extract ALL schools you find in Education section
7. For skills: Extract ALL skills listed in Skills section
8. If you cannot find a field, use "N/A"
9. DO NOT invent or assume information
10. CRITICAL: The "all_experience" array must contain ALL jobs, each as a separate object
11. CRITICAL: The "all_education" array must contain ALL schools, each as a separate object

TEXT NORMALIZATION & CLEANING:
12. For position titles: Normalize and clean text intelligently:
    - If you see text like "SDESDE", "ENGINEERENGINEER", or repeated words, use the expanded/normal form (e.g., "SDESDE" → "Software Development Engineer" or "SDE" based on context)
    - Expand common abbreviations (SDE = Software Development Engineer, PM = Product Manager, etc.) if context suggests it
    - Remove duplicate words, extra spaces, or obvious OCR errors
    - Use common sense: "SDESDE" likely means "Software Development Engineer" or "SDE", not the literal "SDESDE"
    - If ambiguous, prefer the more common/standard form
13. Clean all text fields:
    - Remove leading/trailing whitespace
    - Fix obvious typos or duplicated characters
    - Normalize spacing (single spaces only)
    - If text seems garbled or doesn't make sense, try to infer the correct form from context
14. Validation: Position titles should be:
    - Realistic and practical (not random letters or gibberish)
    - Professional job titles (Software Engineer, Product Manager, etc.)
    - If text is clearly corrupted, use your best judgment to correct it based on context

OUTPUT FORMAT (return ONLY this JSON, no markdown):
{
  "profile_url": "from === PROFILE URL === section",
  "scraped_at": "from === SCRAPED AT === section",
  "name": "extract name",
  "headline": "extract headline/job title",
  "location": "extract location",
  "about": "extract full about/bio text",
  "current_company": "company from FIRST experience entry with 'Present' in dates, or first entry if none have Present",
  "current_position": "position from FIRST experience entry with 'Present' in dates, or first entry if none have Present",
  "all_experience": [
    {"position": "normalized position title (expand abbreviations, fix duplicates, make practical)", "company": "exact company name", "duration": "exact dates"}
  ],
  "education": "name of first school only",
  "all_education": [
    {"school": "exact school name", "degree": "exact degree or N/A"}
  ],
  "top_skills": "first 10 skills comma-separated",
  "all_skills": "all skills comma-separated",
  "skills_count": <number of skills>,
  "email": "if found else N/A",
  "phone": "if found else N/A",
  "website": "if found else N/A",
  "profile_image_url": "N/A",
  "connections": "if found else N/A",
  "pronouns": "if found else N/A"
}

Return ONLY valid JSON, no explanation, no markdown code blocks`;

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
