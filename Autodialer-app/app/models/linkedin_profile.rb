# frozen_string_literal: true

class LinkedinProfile < ApplicationRecord
  # Turbo Streams for real-time updates
  after_create_commit { broadcast_prepend_to "linkedin_profiles", partial: "linkedin_profiles/linkedin_profile", locals: { linkedin_profile: self }, target: "linkedin_profiles" }
  after_update_commit { broadcast_replace_to "linkedin_profiles", partial: "linkedin_profiles/linkedin_profile", locals: { linkedin_profile: self } }
  after_destroy_commit { broadcast_remove_to "linkedin_profiles" }

  # Serialization for TEXT columns that store JSON
  # Note: Only uncomment these if you've run the migration to change columns to TEXT
  # serialize :all_experience, JSON
  # serialize :all_education, JSON

  # Validations
  validates :profile_url, presence: true, uniqueness: true
  validates :status, presence: true, inclusion: {
    in: %w[pending scraping completed failed],
    message: "%{value} is not a valid status"
  }
  validate :valid_linkedin_url

  # Scopes
  scope :pending, -> { where(status: 'pending') }
  scope :scraping, -> { where(status: 'scraping') }
  scope :completed, -> { where(status: 'completed') }
  scope :failed, -> { where(status: 'failed') }
  scope :recent, -> { order(created_at: :desc) }
  scope :with_data, -> { where.not(name: nil) }

  # Callbacks
  before_validation :normalize_url
  # Note: We don't auto-queue scraping jobs anymore
  # Instead, use batch scraping via BatchLinkedinScrapingJob or controller methods

  # Class methods
  def self.statistics
    {
      total: count,
      pending: pending.count,
      scraping: scraping.count,
      completed: completed.count,
      failed: failed.count,
      success_rate: success_rate
    }
  end

  def self.success_rate
    total = count
    return 0 if total.zero?

    (completed.count.to_f / total * 100).round(2)
  end

  # Instance methods
  def completed?
    status == 'completed'
  end

  def failed?
    status == 'failed'
  end

  def pending?
    status == 'pending'
  end

  def scraping?
    status == 'scraping'
  end

  def mark_as_scraping!
    update(status: 'scraping')
  end

  def mark_as_completed!(scraped_data)
    # Parse JSON strings if needed
    experience = parse_json_field(scraped_data['all_experience'])
    education = parse_json_field(scraped_data['all_education'])

    update(
      status: 'completed',
      scraped_at: Time.current,
      name: scraped_data['name'],
      headline: scraped_data['headline'],
      location: scraped_data['location'],
      about: scraped_data['about'],
      current_company: scraped_data['current_company'],
      current_position: scraped_data['current_position'],
      all_experience: experience,
      education: scraped_data['education'],
      all_education: education,
      top_skills: scraped_data['top_skills'],
      all_skills: scraped_data['all_skills'],
      skills_count: scraped_data['skills_count'] || 0,
      email: scraped_data['email'],
      phone: scraped_data['phone'],
      website: scraped_data['website'],
      profile_image_url: scraped_data['profile_image_url'],
      connections: scraped_data['connections'],
      pronouns: scraped_data['pronouns']
    )
  end

  # Helper method to get experience as array
  def experience_list
    parse_json_field(all_experience)
  end

  # Helper method to get education as array
  def education_list
    parse_json_field(all_education)
  end

  # Helper method to get skills as array
  def skills_array
    return [] if all_skills.blank?

    if all_skills.is_a?(String)
      all_skills.split(',').map(&:strip)
    elsif all_skills.is_a?(Array)
      all_skills
    else
      []
    end
  end

  def mark_as_failed!(error)
    update(
      status: 'failed',
      error_message: error,
      scraped_at: Time.current
    )
  end

  private

  def normalize_url
    return unless profile_url.present?

    # Remove trailing slashes and normalize URL
    self.profile_url = profile_url.strip.gsub(%r{/$}, '')

    # Ensure it's a full URL
    unless profile_url.start_with?('http')
      self.profile_url = "https://www.linkedin.com/in/#{profile_url}"
    end
  end

  def valid_linkedin_url
    return unless profile_url.present?

    unless profile_url.include?('linkedin.com')
      errors.add(:profile_url, 'must be a valid LinkedIn profile URL')
    end
  end

  def enqueue_scraping_job
    # Enqueue individual scraping job (less efficient)
    # For batch scraping, use BatchLinkedinScrapingJob instead
    if status == 'pending'
      LinkedinScrapingJob.perform_later(id)
    end
  end

  # Class method to batch scrape pending profiles
  def self.batch_scrape_pending(limit: 10)
    pending_ids = pending.limit(limit).pluck(:id)

    return 0 if pending_ids.empty?

    BatchLinkedinScrapingJob.perform_later(pending_ids)
    pending_ids.count
  end

  def parse_json_field(field)
    return [] if field.blank?
    return field if field.is_a?(Array)
    return field if field.is_a?(Hash)

    if field.is_a?(String)
      begin
        parsed = JSON.parse(field)
        parsed.is_a?(Array) ? parsed : []
      rescue JSON::ParserError
        []
      end
    else
      []
    end
  end
end
