"""
LinkedIn Profile Scraper using Puppeteer with reCAPTCHA v2 Solver
Python wrapper around Node.js Puppeteer scraper
"""
import argparse
import asyncio
import json
import logging
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd

import config


class PuppeteerLinkedInScraper:
    """LinkedIn scraper using Puppeteer via Node.js bridge"""

    def __init__(self, verbose: bool = False, headless: bool = True):
        """
        Initialize the Puppeteer LinkedIn scraper

        Args:
            verbose: Enable verbose logging
            headless: Run browser in headless mode (used for scraping only)
        """
        self.verbose = verbose
        self.headless = headless
        self.profiles_data = []
        self.setup_logging()
        
        # Path to Node.js scraper script
        self.node_script = Path(__file__).parent / "puppeteer_scraper.js"
        self.node_executable = "node"
        
        # Cookie file path
        self.cookies_path = Path(__file__).parent / ".linkedin_cookies.json"
        
        # Verify Node.js is available
        if not self._check_node_available():
            raise RuntimeError(
                "Node.js is not available. Please install Node.js "
                "(https://nodejs.org/) to use Puppeteer scraper."
            )

    def _check_node_available(self) -> bool:
        """Check if Node.js is installed and available"""
        try:
            result = subprocess.run(
                [self.node_executable, "--version"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                self.logger.info(f"Node.js version: {result.stdout.strip()}")
                return True
        except Exception as e:
            self.logger.error(f"Node.js check failed: {str(e)}")
        return False

    def setup_logging(self):
        """Configure logging with both file and console handlers"""
        log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        log_level = logging.DEBUG if self.verbose else getattr(logging, config.LOG_LEVEL)

        # Create logger
        self.logger = logging.getLogger('PuppeteerLinkedInScraper')
        self.logger.setLevel(log_level)

        # Clear existing handlers
        self.logger.handlers.clear()

        # File handler
        file_handler = logging.FileHandler(config.LOG_FILE)
        file_handler.setLevel(log_level)
        file_handler.setFormatter(logging.Formatter(log_format))

        # Console handler
        console_handler = logging.StreamHandler()
        console_handler.setLevel(log_level)
        console_handler.setFormatter(logging.Formatter(log_format))

        # Add handlers
        self.logger.addHandler(file_handler)
        self.logger.addHandler(console_handler)

    def _run_node_script(self, *args) -> Optional[Dict]:
        """
        Run Node.js script and return parsed JSON output

        Args:
            *args: Command and arguments to pass to Node.js script

        Returns:
            dict: Parsed JSON output or None if failed
        """
        try:
            cmd = [self.node_executable, str(self.node_script)] + list(args)
            
            # Set environment variables
            env = {
                **os.environ.copy(),
                'LINKEDIN_EMAIL': config.LINKEDIN_EMAIL or '',
                'LINKEDIN_PASSWORD': config.LINKEDIN_PASSWORD or '',
                'HEADLESS': 'true' if self.headless else 'false',
            }
            
            # Add 2Captcha API key if available (for recaptcha solving - fallback)
            twocaptcha_key = os.getenv('TWOCAPTCHA_API_KEY', '')
            if twocaptcha_key:
                env['TWOCAPTCHA_API_KEY'] = twocaptcha_key
            
            # Add Gemini API key if available (preferred for recaptcha solving)
            gemini_key = os.getenv('GEMINI_API_KEY', '')
            if gemini_key:
                env['GEMINI_API_KEY'] = gemini_key

            self.logger.debug(f"Running command: {' '.join(cmd)}")
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout
                env=env
            )

            if result.returncode != 0:
                self.logger.error(f"Node.js script failed (code {result.returncode}): {result.stderr}")
                # Try to parse error JSON
                try:
                    error_json = json.loads(result.stderr.strip() if result.stderr.strip() else result.stdout.strip())
                    if 'error' in error_json:
                        self.logger.error(f"Error: {error_json['error']}")
                except:
                    pass
                return None

            # Try to parse JSON output
            # The Node.js script should output only JSON
            stdout_text = result.stdout.strip()
            if not stdout_text:
                self.logger.warning("No output from Node.js script")
                return None

            try:
                # Find JSON in output (might have console.log statements before)
                output_lines = stdout_text.split('\n')
                json_output = None
                
                # Try to find JSON in the last few lines
                for line in reversed(output_lines[-5:]):
                    line = line.strip()
                    if line and (line.startswith('{') or line.startswith('[')):
                        try:
                            json_output = json.loads(line)
                            break
                        except json.JSONDecodeError:
                            continue
                
                # If not found, try parsing entire stdout
                if json_output is None:
                    try:
                        json_output = json.loads(stdout_text)
                    except json.JSONDecodeError:
                        # Try to extract JSON from mixed output
                        import re
                        json_match = re.search(r'(\[.*\]|\{.*\})', stdout_text, re.DOTALL)
                        if json_match:
                            json_output = json.loads(json_match.group(1))
                
                return json_output
            except json.JSONDecodeError as e:
                self.logger.error(f"Failed to parse JSON output: {str(e)}")
                self.logger.debug(f"Raw output: {result.stdout[:500]}...")  # First 500 chars
                return None

        except subprocess.TimeoutExpired:
            self.logger.error("Node.js script timed out")
            return None
        except Exception as e:
            self.logger.error(f"Error running Node.js script: {str(e)}")
            import traceback
            if self.verbose:
                self.logger.debug(traceback.format_exc())
            return None

    def ensure_login(self) -> bool:
        """
        Ensure user is logged in by checking cookies or performing login
        Login runs in non-headless mode, then browser closes
        
        Returns:
            bool: True if login successful or cookies valid, False otherwise
        """
        # Check if cookies exist and are valid
        if self.cookies_path.exists():
            self.logger.info("Cookies file found, verifying...")
            # Cookie verification happens in login-only command
        
        # Check if credentials are available
        if not config.LINKEDIN_EMAIL or not config.LINKEDIN_PASSWORD:
            self.logger.warning("No credentials provided. Some profiles may require login.")
            return False
        
        self.logger.info("Ensuring login (will open browser in non-headless mode if needed)...")
        
        # Run login-only command (forces non-headless mode)
        result = self._run_node_script('login-only')
        
        if result:
            if isinstance(result, dict):
                if result.get('success'):
                    self.logger.info("✓ Login verified or completed successfully")
                    return True
                elif 'error' in result:
                    self.logger.error(f"Login error: {result['error']}")
                    return False
        
        self.logger.warning("Login verification returned unexpected result")
        return False

    def scrape_single_profile(self, profile_url: str) -> Optional[Dict]:
        """
        Scrape a single profile using Puppeteer

        Args:
            profile_url: LinkedIn profile URL

        Returns:
            dict: Extracted profile data or None if failed
        """
        self.logger.info(f"Scraping profile: {profile_url}")
        
        # Build command arguments - headless mode is controlled via env var, not CLI arg
        # The Node.js script reads HEADLESS env var
        node_args = ['scrape', profile_url]
        
        result = self._run_node_script(*node_args)
        
        if result:
            # If result is a list, get first item
            if isinstance(result, list) and len(result) > 0:
                profile_data = result[0]
            elif isinstance(result, dict):
                # Check if it's an error response
                if 'error' in result:
                    self.logger.error(f"Error from Node.js: {result['error']}")
                    return None
                profile_data = result
            else:
                return None
            
            # Ensure all expected fields are present
            profile_data = self._normalize_profile_data(profile_data)
            self.profiles_data.append(profile_data)
            return profile_data
        
        return None

    def scrape_profiles_multi_tab(self, profile_urls: List[str], max_concurrent: int = 3) -> List[Dict]:
        """
        Scrape multiple profiles using multi-tab mode (faster for multiple URLs)
        Opens multiple tabs in the same browser for concurrent scraping

        Args:
            profile_urls: List of profile URLs to scrape
            max_concurrent: Maximum number of concurrent tabs (default: 3)

        Returns:
            List[Dict]: List of extracted profile data
        """
        if not profile_urls:
            return []
        
        self.logger.info(f"Scraping {len(profile_urls)} profiles using multi-tab mode (max {max_concurrent} concurrent tabs)...")
        
        # Build command arguments for multi-tab scraping
        # Pass all URLs and the --multi-tab flag
        node_args = ['scrape', '--multi-tab', f'--max-tabs={max_concurrent}'] + profile_urls
        
        result = self._run_node_script(*node_args)
        
        if result:
            # Result should be a list of profile data
            if isinstance(result, list):
                for profile_data in result:
                    if isinstance(profile_data, dict) and 'error' not in profile_data:
                        # Normalize each profile
                        profile_data = self._normalize_profile_data(profile_data)
                        self.profiles_data.append(profile_data)
                    elif isinstance(profile_data, dict):
                        # Handle error cases
                        self.profiles_data.append(self._normalize_profile_data(profile_data))
            elif isinstance(result, dict):
                # Single result
                if 'error' in result:
                    self.logger.error(f"Error from Node.js: {result['error']}")
                else:
                    profile_data = self._normalize_profile_data(result)
                    self.profiles_data.append(profile_data)
        
        return self.profiles_data

    def scrape_profiles(self, profile_urls: List[str], max_profiles: Optional[int] = None) -> List[Dict]:
        """
        Scrape multiple LinkedIn profiles sequentially using Puppeteer
        First ensures login in non-headless mode, then scrapes in headless mode

        Args:
            profile_urls: List of profile URLs to scrape
            max_profiles: Maximum number of profiles to scrape (None for all)

        Returns:
            List[Dict]: List of extracted profile data
        """
        if max_profiles:
            profile_urls = profile_urls[:max_profiles]

        # PHASE 1: Ensure login (runs in non-headless mode, then closes)
        self.logger.info("=== PHASE 1: Ensuring Login ===")
        login_success = self.ensure_login()
        
        if not login_success:
            self.logger.error("Login failed or not verified. Cannot proceed with scraping.")
            return self.profiles_data

        # PHASE 2: Scrape profiles (runs in headless mode using saved cookies)
        self.logger.info(f"\n=== PHASE 2: Scraping {len(profile_urls)} Profiles (Headless Mode) ===")
        self.logger.info("Browser will run in headless mode for faster scraping...")

        # Automatically use multi-tab mode for multiple URLs (faster)
        if len(profile_urls) == 1:
            # Single profile: use sequential scraping
            self.logger.info("Single profile detected - using sequential scraping")
            try:
                profile_data = self.scrape_single_profile(profile_urls[0])
                if profile_data:
                    self.logger.info(f"Successfully scraped: {profile_data.get('name', 'Unknown')}")
                else:
                    self.logger.warning(f"Failed to scrape: {profile_urls[0]}")
            except Exception as e:
                self.logger.error(f"Error scraping {profile_urls[0]}: {str(e)}")
        else:
            # Multiple profiles: use multi-tab scraping (opens different tabs in same browser)
            self.logger.info(f"Multiple profiles detected ({len(profile_urls)}) - using multi-tab scraping")
            self.logger.info("Opening multiple tabs in the same browser for concurrent scraping...")
            
            # Use multi-tab mode (default: 3 concurrent tabs)
            max_concurrent = min(3, len(profile_urls))  # Don't exceed number of URLs
            self.scrape_profiles_multi_tab(profile_urls, max_concurrent=max_concurrent)

        successful = len([p for p in self.profiles_data if 'error' not in p])
        failed = len(self.profiles_data) - successful
        
        self.logger.info(f"\nScraping completed. Success: {successful}, Failed: {failed}")
        return self.profiles_data

    def _normalize_profile_data(self, profile_data: Dict) -> Dict:
        """
        Normalize profile data to ensure all expected fields are present

        Args:
            profile_data: Raw profile data from Puppeteer

        Returns:
            dict: Normalized profile data
        """
        # Ensure all expected columns are present
        all_fields = config.DATA_FIELDS + config.EXTENDED_DATA_FIELDS
        
        normalized = {
            "profile_url": profile_data.get("profile_url", "N/A"),
            "scraped_at": profile_data.get("scraped_at", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
        }
        
        # Add all expected fields with defaults
        for field in all_fields:
            if field in profile_data:
                normalized[field] = profile_data[field]
            else:
                # Set appropriate defaults
                if field in ["all_experience", "all_education"]:
                    normalized[field] = profile_data.get(field, [])
                elif field == "all_skills":
                    normalized[field] = profile_data.get("all_skills", "N/A")
                else:
                    normalized[field] = "N/A"
        
        # Convert lists to strings where needed for CSV compatibility
        if isinstance(normalized.get("all_experience"), list):
            normalized["all_experience"] = json.dumps(normalized["all_experience"])
        if isinstance(normalized.get("all_education"), list):
            normalized["all_education"] = json.dumps(normalized["all_education"])
        
        return normalized

    def export_to_csv(self, output_path: Optional[Path] = None) -> Path:
        """
        Export scraped data to CSV

        Args:
            output_path: Custom output path (uses config default if None)

        Returns:
            Path: Path to the exported CSV file
        """
        if not self.profiles_data:
            self.logger.warning("No profile data to export")
            return None

        output_path = output_path or config.OUTPUT_PATH

        try:
            df = pd.DataFrame(self.profiles_data)

            # Ensure all expected columns are present
            all_fields = config.DATA_FIELDS + config.EXTENDED_DATA_FIELDS
            for field in all_fields:
                if field not in df.columns:
                    df[field] = "N/A"

            # Reorder columns - put standard fields first
            standard_fields = [f for f in all_fields if f in df.columns]
            remaining_fields = [f for f in df.columns if f not in standard_fields]
            df = df[standard_fields + remaining_fields]

            # Export to CSV
            df.to_csv(output_path, index=False, encoding='utf-8')

            self.logger.info(f"Successfully exported {len(self.profiles_data)} profiles to {output_path}")
            return output_path

        except Exception as e:
            self.logger.error(f"Failed to export data: {str(e)}")
            raise


def load_profile_urls(file_path: str) -> List[str]:
    """
    Load profile URLs from a text file

    Args:
        file_path: Path to file containing URLs (one per line)

    Returns:
        List[str]: List of valid LinkedIn profile URLs
    """
    urls = []
    from urllib.parse import urlparse

    try:
        with open(file_path, 'r') as f:
            for line in f:
                url = line.strip()
                if url and not url.startswith('#'):  # Skip empty lines and comments
                    # Validate URL
                    parsed = urlparse(url)
                    if 'linkedin.com' in parsed.netloc:
                        urls.append(url)
                    else:
                        print(f"Warning: Skipping invalid URL: {url}")
    except FileNotFoundError:
        print(f"Error: File not found: {file_path}")
        return []

    return urls


def main():
    """Main entry point for the Puppeteer scraper"""
    import os
    
    parser = argparse.ArgumentParser(
        description='LinkedIn Profile Scraper (Puppeteer) - With reCAPTCHA v2 Solver'
    )
    parser.add_argument(
        'input_file',
        nargs='?',
        default='profile_urls.txt',
        help='Path to file containing LinkedIn profile URLs (default: profile_urls.txt)'
    )
    parser.add_argument(
        '-o', '--output',
        help='Output CSV file path (default: from config)'
    )
    parser.add_argument(
        '-n', '--profiles',
        type=int,
        help='Maximum number of profiles to scrape (default: all)'
    )
    parser.add_argument(
        '--headless',
        action='store_true',
        default=True,
        help='Run browser in headless mode (default: True)'
    )
    parser.add_argument(
        '--no-headless',
        action='store_true',
        help='Run browser with GUI (overrides --headless)'
    )
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    parser.add_argument(
        '--test',
        action='store_true',
        help='Test mode: scrape only first 5 profiles'
    )

    args = parser.parse_args()

    # Load profile URLs
    print(f"Loading profile URLs from: {args.input_file}")
    profile_urls = load_profile_urls(args.input_file)

    if not profile_urls:
        print("Error: No valid profile URLs found")
        return 1

    print(f"Found {len(profile_urls)} profile URLs")

    # Determine max profiles
    max_profiles = args.profiles
    if args.test:
        max_profiles = 5
        print("Test mode: Scraping only 5 profiles")

    # Determine headless mode - --no-headless overrides --headless
    # args.no_headless has underscore (converted from --no-headless)
    if args.no_headless:
        headless = False  # --no-headless explicitly disables headless
    else:
        headless = args.headless  # Use --headless flag value (defaults to True)
    
    print(f"Running in {'headless' if headless else 'non-headless'} mode")
    if not headless:
        print("Browser will be visible. You can watch the scraping process.")
        print("Use this mode to debug login issues or solve captchas manually.")
    
    # Run scraper
    try:
        # Always use headless=True for scraper initialization
        # Login will handle non-headless mode separately
        scraper = PuppeteerLinkedInScraper(verbose=args.verbose, headless=True)
        
        print(f"\n{'='*60}")
        print(f"LinkedIn Profile Scraper - Production Ready")
        print(f"{'='*60}")
        print(f"\nWorkflow:")
        print(f"1. Login phase: Opens browser (non-headless) for login if needed")
        print(f"2. Scraping phase: Runs headless for fast scraping")
        if len(profile_urls) > 1:
            print(f"   - Multiple URLs detected: Will use multi-tab mode")
            print(f"   - Opens different tabs in the same browser for concurrent scraping")
        print(f"3. Export phase: Saves all data to CSV")
        print(f"{'='*60}\n")
        
        # Scrape profiles (includes login phase)
        scraper.scrape_profiles(profile_urls, max_profiles=max_profiles)

        # PHASE 3: Export results to CSV
        print(f"\n=== PHASE 3: Exporting to CSV ===")
        output_path = Path(args.output) if args.output else None
        csv_file = scraper.export_to_csv(output_path)

        if csv_file:
            print(f"\n{'='*60}")
            print(f"✓ Scraping completed successfully!")
            print(f"{'='*60}")
            print(f"Results saved to: {csv_file}")
            print(f"Total profiles scraped: {len(scraper.profiles_data)}")
            print(f"{'='*60}")
            
            return 0
        else:
            print("\n✗ No data was scraped")
            return 1

    except KeyboardInterrupt:
        print("\n\nScraping interrupted by user")
        return 1
    except Exception as e:
        print(f"\nFatal error: {str(e)}")
        import traceback
        if args.verbose:
            traceback.print_exc()
        return 1


if __name__ == "__main__":
    import os
    exit(main())

