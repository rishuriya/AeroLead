# frozen_string_literal: true

class LinkedinScrapingJob < ApplicationJob
  queue_as :default

  retry_on StandardError, wait: 5.minutes, attempts: 3

  def perform(linkedin_profile_id)
    profile = LinkedinProfile.find(linkedin_profile_id)

    # Mark as scraping
    profile.mark_as_scraping!

    # Initialize scraper service
    scraper = LinkedinScraperService.new

    # Check if scraper is available
    unless scraper.available?
      profile.mark_as_failed!('LinkedIn scraper not available')
      Rails.logger.error 'LinkedIn scraper not found'
      return
    end

    # Scrape the profile
    scraped_data = scraper.scrape_profile(profile.profile_url)

    # Update profile with scraped data
    profile.mark_as_completed!(scraped_data)

    Rails.logger.info "Successfully scraped profile: #{profile.profile_url}"
  rescue StandardError => e
    Rails.logger.error "Failed to scrape profile #{linkedin_profile_id}: #{e.message}"

    # Mark as failed
    profile = LinkedinProfile.find_by(id: linkedin_profile_id)
    profile&.mark_as_failed!(e.message)

    # Re-raise the error so retry logic can kick in
    raise e
  end
end
