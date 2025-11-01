# frozen_string_literal: true

class AICommandParser
  def initialize(model: nil)
    @model = model || ENV.fetch('DEFAULT_AI_MODEL', 'gemini')
  end

  # Parse a natural language command
  def parse(command)
    return { error: 'Command cannot be blank' } if command.blank?

    result = ai_service.process_command(command)

    # Validate and normalize the result
    normalize_result(result)
  rescue StandardError => e
    Rails.logger.error "AI Command Parser Error: #{e.message}"
    { error: e.message, success: false }
  end

  # Execute the parsed command
  def execute(command)
    parsed = parse(command)

    return parsed if parsed[:error].present?

    case parsed[:action]
    when 'make_call'
      execute_make_call(parsed)
    when 'bulk_call'
      execute_bulk_call(parsed)
    when 'generate_blog'
      execute_generate_blog(parsed)
    when 'bulk_generate_blog'
      execute_bulk_generate_blog(parsed)
    when 'scrape_linkedin'
      execute_scrape_linkedin(parsed)
    when 'bulk_scrape_linkedin'
      execute_bulk_scrape_linkedin(parsed)
    when 'check_status'
      execute_check_status(parsed)
    else
      { error: "Unknown action: #{parsed[:action]}", success: false }
    end
  rescue StandardError => e
    Rails.logger.error "Command Execution Error: #{e.message}"
    { error: e.message, success: false }
  end

  private

  def ai_service
    @ai_service ||= case @model.to_s.downcase
                    when 'gemini'
                      GeminiService.new
                    when 'openai'
                      OpenaiService.new
                    when 'anthropic'
                      # Would implement AnthropicService if needed
                      GeminiService.new
                    else
                      GeminiService.new
                    end
  end

  def normalize_result(result)
    {
      action: result['action'] || result[:action],
      phone_numbers: Array(result['phone_numbers'] || result[:phone_numbers]),
      message: result['message'] || result[:message],
      blog_topics: Array(result['blog_topics'] || result[:blog_topics]),
      linkedin_urls: Array(result['linkedin_urls'] || result[:linkedin_urls]),
      parameters: result['parameters'] || result[:parameters] || {},
      success: true
    }
  end

  def execute_make_call(parsed)
    phone_number = parsed[:phone_numbers].first
    message = parsed[:message] || 'This is an automated call.'

    return { error: 'No phone number provided', success: false } if phone_number.blank?

    phone_call = PhoneCall.create!(
      phone_number: phone_number,
      message: message,
      status: 'queued'
    )

    {
      success: true,
      action: 'make_call',
      message: "Call queued to #{phone_number}",
      phone_call_id: phone_call.id
    }
  end

  def execute_bulk_call(parsed)
    phone_numbers = parsed[:phone_numbers]
    message = parsed[:message] || 'This is an automated call.'

    return { error: 'No phone numbers provided', success: false } if phone_numbers.empty?

    phone_calls = phone_numbers.map do |number|
      PhoneCall.create!(
        phone_number: number,
        message: message,
        status: 'queued'
      )
    end

    {
      success: true,
      action: 'bulk_call',
      message: "#{phone_calls.count} calls queued",
      phone_call_ids: phone_calls.map(&:id)
    }
  end

  def execute_generate_blog(parsed)
    topic = parsed[:blog_topics].first

    return { error: 'No blog topic provided', success: false } if topic.blank?

    # Always use Gemini for AI generation
    BlogGenerationJob.perform_later(topic, 'gemini')

    {
      success: true,
      action: 'generate_blog',
      message: "Blog generation started for: #{topic}"
    }
  end

  def execute_bulk_generate_blog(parsed)
    topics = parsed[:blog_topics]

    return { error: 'No blog topics provided', success: false } if topics.empty?

    # Always use Gemini for AI generation
    topics.each do |topic|
      BlogGenerationJob.perform_later(topic, 'gemini')
    end

    {
      success: true,
      action: 'bulk_generate_blog',
      message: "#{topics.count} blog posts queued for generation"
    }
  end

  def execute_check_status(parsed)
    {
      success: true,
      action: 'check_status',
      phone_calls: PhoneCall.analytics,
      blog_posts: BlogPost.statistics,
      linkedin_profiles: LinkedinProfile.statistics
    }
  end

  def execute_scrape_linkedin(parsed)
    url = parsed[:linkedin_urls].first

    return { error: 'No LinkedIn URL provided', success: false } if url.blank?

    profile = LinkedinProfile.create!(profile_url: url)

    # Use batch scraping job for efficiency
    BatchLinkedinScrapingJob.perform_later([profile.id])

    {
      success: true,
      action: 'scrape_linkedin',
      message: "LinkedIn profile scraping queued: #{url}",
      linkedin_profile_id: profile.id
    }
  end

  def execute_bulk_scrape_linkedin(parsed)
    urls = parsed[:linkedin_urls]

    return { error: 'No LinkedIn URLs provided', success: false } if urls.empty?

    created_ids = []
    profiles = urls.map do |url|
      profile = LinkedinProfile.create!(profile_url: url)
      created_ids << profile.id
      profile
    end

    # Use batch scraping job - scrape all profiles in one call
    BatchLinkedinScrapingJob.perform_later(created_ids)

    {
      success: true,
      action: 'bulk_scrape_linkedin',
      message: "#{profiles.count} LinkedIn profiles queued for batch scraping",
      linkedin_profile_ids: profiles.map(&:id)
    }
  end
end
