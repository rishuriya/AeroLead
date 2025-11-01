# frozen_string_literal: true

class LinkedinScraperService
  def initialize
    @scraper_path = ENV.fetch('LINKEDIN_SCRAPER_PATH', 'lib/linkedin_scraper')
    @node_command = ENV.fetch('NODE_COMMAND', 'node')
  end

  # Scrape a single LinkedIn profile
  def scrape_profile(profile_url)
    Rails.logger.info "Scraping LinkedIn profile: #{profile_url}"

    result = execute_scraper([profile_url])

    if result[:success] && result[:data].present?
      result[:data].first
    else
      raise StandardError, result[:error] || 'Failed to scrape profile'
    end
  rescue StandardError => e
    Rails.logger.error "LinkedIn scraping error: #{e.message}"
    raise e
  end

  # Scrape multiple LinkedIn profiles
  def scrape_profiles(profile_urls)
    Rails.logger.info "Scraping #{profile_urls.count} LinkedIn profiles"

    result = execute_scraper(profile_urls)

    if result[:success]
      result[:data] || []
    else
      raise StandardError, result[:error] || 'Failed to scrape profiles'
    end
  rescue StandardError => e
    Rails.logger.error "LinkedIn scraping error: #{e.message}"
    raise e
  end

  # Check if the scraper is available
  def available?
    scraper_file = File.join(scraper_path, 'puppeteer_scraper.js')
    File.exist?(scraper_file)
  end

  # Get scraper status
  def status
    {
      available: available?,
      scraper_path: scraper_path,
      node_command: @node_command
    }
  end

  private

  def scraper_path
    # Support both relative and absolute paths
    if @scraper_path.start_with?('/')
      @scraper_path
    else
      File.expand_path(@scraper_path, Rails.root)
    end
  end

  def execute_scraper(profile_urls)
    scraper_file = File.join(scraper_path, 'puppeteer_scraper.js')

    unless File.exist?(scraper_file)
      return {
        success: false,
        error: "Scraper not found at #{scraper_file}"
      }
    end

    # Check if cookies exist - if not, we need to login first
    cookies_file = File.join(scraper_path, '.linkedin_cookies.json')
    unless File.exist?(cookies_file)
      Rails.logger.warn 'No cookies found. Attempting login first...'
      login_result = execute_login
      unless login_result[:success]
        return {
          success: false,
          error: "Login required before scraping: #{login_result[:error]}"
        }
      end
    end

    # Build command with URLs
    urls_arg = profile_urls.join(' ')
    command = "cd #{scraper_path} && #{@node_command} puppeteer_scraper.js scrape #{urls_arg}"

    Rails.logger.info "Executing: #{command}"

    # Execute the scraper
    output = `#{command} 2>&1`
    exit_status = $?.exitstatus

    Rails.logger.info "Scraper output: #{output}"
    Rails.logger.info "Exit status: #{exit_status}"

    # If scraping failed due to invalid cookies, try login and retry once
    if exit_status != 0 && (output.include?('Invalid cookies') || output.include?('No cookies'))
      Rails.logger.warn 'Cookies invalid. Attempting to re-login and retry...'
      login_result = execute_login
      if login_result[:success]
        # Retry scraping after successful login
        Rails.logger.info 'Retrying scrape after login...'
        output = `#{command} 2>&1`
        exit_status = $?.exitstatus
        Rails.logger.info "Retry output: #{output}"
        Rails.logger.info "Retry exit status: #{exit_status}"
      end
    end

    # Parse the output
    parse_scraper_output(output, exit_status)
  end

  def execute_login
    scraper_file = File.join(scraper_path, 'puppeteer_scraper.js')
    
    # Check if LinkedIn credentials are available
    unless ENV['LINKEDIN_EMAIL'] && ENV['LINKEDIN_PASSWORD']
      return {
        success: false,
        error: 'LINKEDIN_EMAIL and LINKEDIN_PASSWORD environment variables required for login'
      }
    end

    # In production/headless environments, use headless mode
    # In development, use non-headless for manual CAPTCHA solving if needed
    headless_flag = Rails.env.production? ? '--headless' : '--no-headless'
    
    # Run login-only command
    command = "cd #{scraper_path} && #{@node_command} puppeteer_scraper.js login-only #{headless_flag}"
    
    Rails.logger.info "Executing login: #{command}"
    output = `#{command} 2>&1`
    exit_status = $?.exitstatus

    if exit_status.zero?
      {
        success: true,
        message: 'Login completed successfully'
      }
    else
      {
        success: false,
        error: "Login failed: #{output}"
      }
    end
  end

  def parse_scraper_output(output, exit_status)
    # Try to find JSON in the output
    json_match = output.match(/\[{.*}\]/m)

    if json_match
      begin
        data = JSON.parse(json_match[0])
        return {
          success: true,
          data: data
        }
      rescue JSON::ParserError => e
        Rails.logger.error "Failed to parse scraper JSON: #{e.message}"
      end
    end

    # If no JSON found or parsing failed, check exit status
    if exit_status.zero?
      {
        success: true,
        data: [],
        message: 'Scraper completed but returned no data'
      }
    else
      {
        success: false,
        error: output.presence || 'Scraper failed with no output',
        exit_status: exit_status
      }
    end
  end
end
