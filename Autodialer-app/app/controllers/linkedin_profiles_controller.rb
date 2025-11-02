# frozen_string_literal: true

class LinkedinProfilesController < ApplicationController
  before_action :set_linkedin_profile, only: [:show, :destroy, :retry_scraping]

  # GET /linkedin_profiles
  def index
    @linkedin_profiles = LinkedinProfile.recent.page(params[:page]).per(20)
    @statistics = LinkedinProfile.statistics

    respond_to do |format|
      format.html
      format.json { render json: @linkedin_profiles }
      format.csv do
        # Export all completed profiles (not just current page)
        @all_profiles = LinkedinProfile.completed.order(scraped_at: :desc)
        send_data generate_csv(@all_profiles),
                  filename: "linkedin_profiles_#{Date.today}.csv",
                  type: 'text/csv',
                  disposition: 'attachment'
      end
    end
  end

  # GET /linkedin_profiles/new
  def new
    @linkedin_profile = LinkedinProfile.new
  end

  # GET /linkedin_profiles/:id
  def show
    respond_to do |format|
      format.html
      format.json { render json: @linkedin_profile }
    end
  end

  # POST /linkedin_profiles
  # Create a single profile from direct URL input
  def create
    @linkedin_profile = LinkedinProfile.new(linkedin_profile_params)

    if @linkedin_profile.save
      # Queue batch scraping job for this profile
      BatchLinkedinScrapingJob.perform_later([@linkedin_profile.id])

      flash[:success] = 'LinkedIn profile added to scraping queue successfully!'
      redirect_to linkedin_profiles_path
    else
      flash.now[:error] = @linkedin_profile.errors.full_messages.join(', ')
      render :new, status: :unprocessable_entity
    end
  rescue StandardError => e
    flash.now[:error] = "Error: #{e.message}"
    render :new, status: :unprocessable_entity
  end

  # POST /linkedin_profiles/upload_csv
  # Upload a CSV or text file with LinkedIn URLs
  def upload_csv
    unless params[:file].present?
      flash[:error] = 'Please select a file to upload'
      redirect_to linkedin_profiles_path and return
    end

    file = params[:file]
    urls = extract_urls_from_file(file)

    if urls.empty?
      flash[:error] = 'No valid LinkedIn URLs found in the file'
      redirect_to linkedin_profiles_path and return
    end

    # Create profiles for each URL
    created_count = 0
    skipped_count = 0
    errors = []
    created_ids = []

    urls.each do |url|
      profile = LinkedinProfile.new(profile_url: url)
      if profile.save
        created_count += 1
        created_ids << profile.id
      else
        skipped_count += 1
        errors << "#{url}: #{profile.errors.full_messages.join(', ')}"
      end
    end

    # Queue batch scraping job for all created profiles
    if created_ids.any?
      BatchLinkedinScrapingJob.perform_later(created_ids)
    end

    message = "Successfully added #{created_count} profiles to scraping queue."
    message += " #{skipped_count} profiles were skipped (duplicates or invalid)." if skipped_count > 0

    flash[:success] = message
    flash[:warning] = errors.join('<br>').html_safe if errors.any?

    redirect_to linkedin_profiles_path
  rescue StandardError => e
    flash[:error] = "Error uploading file: #{e.message}"
    redirect_to linkedin_profiles_path
  end

  # POST /linkedin_profiles/bulk_create
  # Create multiple profiles from a list of URLs (text area input)
  def bulk_create
    urls_text = params[:urls]

    if urls_text.blank?
      flash[:error] = 'Please enter at least one LinkedIn URL'
      redirect_to new_linkedin_profile_path and return
    end

    # Split by newlines and clean up
    urls = urls_text.split(/[\n,]/).map(&:strip).reject(&:blank?)

    if urls.empty?
      flash[:error] = 'No valid LinkedIn URLs found'
      redirect_to new_linkedin_profile_path and return
    end

    # Create profiles for each URL
    created_count = 0
    skipped_count = 0
    errors = []
    created_ids = []

    urls.each do |url|
      profile = LinkedinProfile.new(profile_url: url)
      if profile.save
        created_count += 1
        created_ids << profile.id
      else
        skipped_count += 1
        errors << "#{url}: #{profile.errors.full_messages.join(', ')}"
      end
    end

    # Queue batch scraping job for all created profiles
    if created_ids.any?
      BatchLinkedinScrapingJob.perform_later(created_ids)
    end

    message = "Successfully added #{created_count} profiles to scraping queue."
    message += " #{skipped_count} profiles were skipped (duplicates or invalid)." if skipped_count > 0

    flash[:success] = message
    flash[:warning] = errors.join('<br>').html_safe if errors.any?

    redirect_to linkedin_profiles_path
  rescue StandardError => e
    flash[:error] = "Error: #{e.message}"
    redirect_to new_linkedin_profile_path
  end

  # DELETE /linkedin_profiles/:id
  def destroy
    @linkedin_profile.destroy
    flash[:success] = 'LinkedIn profile deleted successfully'
    redirect_to linkedin_profiles_path
  end

  # POST /linkedin_profiles/:id/retry_scraping
  def retry_scraping
    @linkedin_profile.update(status: 'pending', error_message: nil)

    # Use batch scraping even for single retry
    BatchLinkedinScrapingJob.perform_later([@linkedin_profile.id])

    flash[:success] = 'Profile scraping retry queued'
    redirect_to linkedin_profiles_path
  rescue StandardError => e
    flash[:error] = "Error: #{e.message}"
    redirect_to linkedin_profiles_path
  end

  # GET /linkedin_profiles/analytics
  def analytics
    @statistics = LinkedinProfile.statistics
    @recent_profiles = LinkedinProfile.recent.limit(10)

    respond_to do |format|
      format.html
      format.json { render json: @statistics }
    end
  end

  private

  def set_linkedin_profile
    @linkedin_profile = LinkedinProfile.find(params[:id])
  end

  def linkedin_profile_params
    params.require(:linkedin_profile).permit(:profile_url)
  end

  def extract_urls_from_file(file)
    content = file.read

    # Try to parse as CSV
    if file.original_filename.end_with?('.csv')
      require 'csv'
      urls = []
      CSV.parse(content, headers: true) do |row|
        # Look for columns named 'url', 'profile_url', 'linkedin_url', etc.
        url = row['url'] || row['profile_url'] || row['linkedin_url'] || row['URL'] || row['Profile URL']
        urls << url if url.present?
      end
      return urls.map(&:strip).reject(&:blank?)
    end

    # Otherwise, treat as plain text (one URL per line)
    content.split(/[\n,]/).map(&:strip).reject(&:blank?)
  end

  def generate_csv(profiles)
    require 'csv'

    CSV.generate(headers: true) do |csv|
      # CSV Headers
      csv << [
        'Name',
        'Headline',
        'Location',
        'About',
        'Current Company',
        'Current Position',
        'Education',
        'Top Skills',
        'Profile URL',
        'Connections',
        'Scraped At',
        'All Skills',
        'Skills Count',
        'Email',
        'Phone',
        'Website',
        'Profile Image URL',
        'Pronouns',
        'All Experience',
        'All Education'
      ]

      # CSV Rows
      profiles.each do |profile|
        csv << [
          profile.name,
          profile.headline,
          profile.location,
          profile.about,
          profile.current_company,
          profile.current_position,
          profile.education,
          profile.top_skills,
          profile.profile_url,
          profile.connections,
          profile.scraped_at&.iso8601,
          profile.all_skills,
          profile.skills_count,
          profile.email,
          profile.phone,
          profile.website,
          profile.profile_image_url,
          profile.pronouns,
          format_json_for_csv(profile.all_experience),
          format_json_for_csv(profile.all_education)
        ]
      end
    end
  end

  def format_json_for_csv(json_field)
    # Convert JSON array to a readable string for CSV
    return '' if json_field.blank?

    data = if json_field.is_a?(String)
             begin
               JSON.parse(json_field)
             rescue JSON::ParserError
               []
             end
           else
             json_field
           end

    return '' unless data.is_a?(Array)

    # Convert to JSON string for CSV cell
    data.to_json
  end
end
