# frozen_string_literal: true

class GeminiService
  BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

  def initialize
    @api_key = ENV['GEMINI_API_KEY']
    raise 'GEMINI_API_KEY not configured' if @api_key.blank?
  end

  # Generate a blog article
  def generate_article(title, context: nil, word_count: 1000)
    prompt = build_article_prompt(title, context, word_count)
    response = make_request(prompt)

    {
      content: extract_text(response),
      title: title,
      model: 'gemini-2.5-flash',
      success: true
    }
  rescue StandardError => e
    Rails.logger.error "Gemini API Error: #{e.message}"
    {
      content: nil,
      error: e.message,
      success: false
    }
  end

  # Generate multiple articles
  def generate_bulk_articles(titles, context: nil, word_count: 1000)
    titles.map do |title|
      result = generate_article(title, context: context, word_count: word_count)
      result.merge(title: title)
    end
  end

  # Process natural language command
  def process_command(command)
    prompt = build_command_prompt(command)
    response = make_request(prompt)

    text = extract_text(response)
    cleaned_text = clean_json_response(text)
    JSON.parse(cleaned_text)
  rescue JSON::ParserError => e
    Rails.logger.error "Failed to parse Gemini response: #{e.message}"
    Rails.logger.error "Response text: #{extract_text(response)}"
    { error: 'Invalid JSON response from AI' }
  rescue StandardError => e
    Rails.logger.error "Gemini Command Processing Error: #{e.message}"
    { error: e.message }
  end

  private

  def make_request(prompt, model: 'gemini-2.5-flash')
    url = "#{BASE_URL}"

    # Match the exact curl command format
    body_data = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    }

    # Optional: Add generation config if needed
    body_data[:generationConfig] = {
      temperature: 0.9,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
      candidateCount: 1
    }

    Rails.logger.info "Making Gemini API request to: #{url}"

    response = HTTParty.post(
      url,
      headers: {
        'Content-Type' => 'application/json',
        'x-goog-api-key' => @api_key
      },
      body: body_data.to_json,
      timeout: 60
    )

    unless response.success?
      error_details = response.parsed_response rescue response.body
      Rails.logger.error "Gemini API Error Response: #{error_details}"
      raise "API Error: #{response.code} - #{response.message}. Details: #{error_details}"
    end

    response.parsed_response
  end

  def extract_text(response)
    return '' if response.nil? || response['candidates'].nil?

    candidates = response['candidates']
    return '' if candidates.empty?

    content = candidates.first.dig('content', 'parts')
    return '' if content.nil?

    content.first['text']
  rescue StandardError => e
    Rails.logger.error "Failed to extract text from Gemini response: #{e.message}"
    ''
  end

  def clean_json_response(text)
    return '' if text.blank?

    # Remove markdown code blocks (```json ... ``` or ``` ... ```)
    cleaned = text.strip
    cleaned = cleaned.gsub(/^```json\s*/i, '')
    cleaned = cleaned.gsub(/^```\s*/, '')
    cleaned = cleaned.gsub(/\s*```$/, '')
    cleaned = cleaned.strip

    # If the response still contains code blocks, try to extract JSON from between them
    if cleaned.match?(/^```/)
      # Extract content between code blocks
      match = cleaned.match(/```(?:json)?\s*(.*?)\s*```/m)
      cleaned = match ? match[1] : cleaned
    end

    cleaned.strip
  end

  def build_article_prompt(title, context, word_count)
    <<~PROMPT
      Write a comprehensive, SEO-optimized blog article on the following topic:

      **Title**: #{title}

      #{context.present? ? "**Context**: #{context}" : ''}

      **Requirements**:
      - Target length: #{word_count} words
      - Include an engaging introduction
      - Use clear section headings (use ## for H2 headings)
      - Provide detailed explanations and examples
      - Include code snippets where relevant (use markdown code blocks)
      - Write in a professional yet accessible tone
      - Conclude with a summary or key takeaways
      - Use markdown formatting throughout

      **Format**: Return ONLY the article content in markdown format, without any preamble or meta-commentary.
    PROMPT
  end

  def build_command_prompt(command)
    <<~PROMPT
      Parse this autodialer or blog generation command and return structured JSON:

      Command: "#{command}"

      Analyze the command and determine:
      1. What action the user wants to perform (make_call, bulk_call, generate_blog, bulk_generate_blog, check_status)
      2. Any phone numbers mentioned
      3. Any messages or content to deliver
      4. Any blog topics to generate

      Return ONLY valid JSON in this exact format (NO markdown code blocks, NO backticks, NO explanations):
      {
        "action": "make_call|bulk_call|generate_blog|bulk_generate_blog|check_status",
        "phone_numbers": ["array of phone numbers if applicable"],
        "message": "message to deliver if applicable",
        "blog_topics": ["array of blog topics if applicable"],
        "parameters": {
          "count": number,
          "other_params": "values"
        }
      }

      CRITICAL: Return ONLY the raw JSON object, no markdown formatting, no code blocks, no backticks, no explanation text before or after.
    PROMPT
  end
end
