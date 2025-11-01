# frozen_string_literal: true

class OpenaiService
  def initialize
    @client = OpenAI::Client.new(access_token: ENV['OPENAI_API_KEY'])
  end

  # Generate a blog article
  def generate_article(title, context: nil, word_count: 1000)
    prompt = build_article_prompt(title, context, word_count)

    response = @client.chat(
      parameters: {
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: 'You are a professional technical writer.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2500
      }
    )

    content = response.dig('choices', 0, 'message', 'content')

    {
      content: content,
      title: title,
      model: 'openai',
      success: true
    }
  rescue StandardError => e
    Rails.logger.error "OpenAI API Error: #{e.message}"
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
      sleep(1) # Rate limiting
      result.merge(title: title)
    end
  end

  # Process natural language command
  def process_command(command)
    prompt = build_command_prompt(command)

    response = @client.chat(
      parameters: {
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: 'You are an AI assistant that parses commands into structured JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }
    )

    content = response.dig('choices', 0, 'message', 'content')
    JSON.parse(content)
  rescue JSON::ParserError => e
    Rails.logger.error "Failed to parse OpenAI response: #{e.message}"
    { error: 'Invalid JSON response from AI' }
  rescue StandardError => e
    Rails.logger.error "OpenAI Command Processing Error: #{e.message}"
    { error: e.message }
  end

  private

  def build_article_prompt(title, context, word_count)
    <<~PROMPT
      Write a comprehensive, SEO-optimized blog article on the following topic:

      **Title**: #{title}

      #{context.present? ? "**Context**: #{context}" : ''}

      **Requirements**:
      - Target length: approximately #{word_count} words
      - Include an engaging introduction
      - Use clear section headings (use ## for H2 headings)
      - Provide detailed explanations and examples
      - Include code snippets where relevant (use markdown code blocks)
      - Write in a professional yet accessible tone
      - Conclude with a summary or key takeaways
      - Use markdown formatting throughout

      Return ONLY the article content in markdown format.
    PROMPT
  end

  def build_command_prompt(command)
    <<~PROMPT
      Parse this command and return structured JSON:

      Command: "#{command}"

      Analyze the command and determine:
      1. What action the user wants to perform
      2. Any phone numbers mentioned
      3. Any messages or content
      4. Any blog topics

      Return valid JSON in this format:
      {
        "action": "make_call|bulk_call|generate_blog|bulk_generate_blog|check_status",
        "phone_numbers": ["array"],
        "message": "string or null",
        "blog_topics": ["array or null"],
        "parameters": {}
      }
    PROMPT
  end
end
