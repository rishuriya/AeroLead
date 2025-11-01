# frozen_string_literal: true

class LinkedinScraperService
  def initialize
    @scraper_path = ENV.fetch('LINKEDIN_SCRAPER_PATH', '../Linkedin-scrapper')
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

    # Build command with URLs
    urls_arg = profile_urls.join(' ')
    command = "cd #{scraper_path} && #{@node_command} puppeteer_scraper.js scrape #{urls_arg}"

    Rails.logger.info "Executing: #{command}"

    # Execute the scraper
    output = `#{command} 2>&1`
    exit_status = $?.exitstatus

    Rails.logger.info "Scraper output: #{output}"
    Rails.logger.info "Exit status: #{exit_status}"

    # Parse the output
    parse_scraper_output(output, exit_status)
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
