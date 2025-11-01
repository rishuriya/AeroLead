# frozen_string_literal: true

class BatchLinkedinScrapingJob < ApplicationJob
  queue_as :default

  retry_on StandardError, wait: 5.minutes, attempts: 3

  # Scrape multiple LinkedIn profiles in a single batch
  def perform(linkedin_profile_ids)
    profiles = LinkedinProfile.where(id: linkedin_profile_ids, status: 'pending')

    return if profiles.empty?

    Rails.logger.info "Batch scraping #{profiles.count} LinkedIn profiles"

    # Mark all as scraping
    profiles.update_all(status: 'scraping')

    # Initialize scraper service
    scraper = LinkedinScraperService.new

    # Check if scraper is available
    unless scraper.available?
      profiles.update_all(
        status: 'failed',
        error_message: 'LinkedIn scraper not available',
        scraped_at: Time.current
      )
      Rails.logger.error 'LinkedIn scraper not found'
      return
    end

    # Scrape all profiles in one call
    profile_urls = profiles.pluck(:profile_url)
    scraped_data_array = scraper.scrape_profiles(profile_urls)

    # Update each profile with its scraped data
    scraped_data_array.each do |scraped_data|
      profile_url = scraped_data['profile_url']
      profile = profiles.find_by(profile_url: profile_url)

      if profile
        profile.mark_as_completed!(scraped_data)
        Rails.logger.info "Successfully scraped profile: #{profile_url}"
      end
    end

    # Mark any profiles that weren't in the results as failed
    completed_urls = scraped_data_array.map { |data| data['profile_url'] }
    failed_profiles = profiles.where.not(profile_url: completed_urls)

    failed_profiles.each do |profile|
      profile.mark_as_failed!('No data returned from scraper')
    end

    Rails.logger.info "Batch scraping completed: #{scraped_data_array.count} succeeded, #{failed_profiles.count} failed"
  rescue StandardError => e
    Rails.logger.error "Batch scraping failed: #{e.message}"

    # Mark all profiles as failed
    profiles = LinkedinProfile.where(id: linkedin_profile_ids)
    profiles.update_all(
      status: 'failed',
      error_message: e.message,
      scraped_at: Time.current
    )

    # Re-raise the error so retry logic can kick in
    raise e
  end
end
