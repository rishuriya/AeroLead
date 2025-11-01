# frozen_string_literal: true

class BlogGenerationJob < ApplicationJob
  queue_as :default

  retry_on StandardError, wait: :exponentially_longer, attempts: 2

  def perform(title, ai_model = 'gemini', context: nil, word_count: 1000)
    Rails.logger.info "Generating blog post: #{title} using #{ai_model}"

    # Select AI service based on model
    ai_service = case ai_model.to_s.downcase
                 when 'openai'
                   OpenaiService.new
                 when 'gemini'
                   GeminiService.new
                 else
                   GeminiService.new
                 end

    # Generate the article
    result = ai_service.generate_article(
      title,
      context: context,
      word_count: word_count
    )

    if result[:success] && result[:content].present?
      # Create blog post
      blog_post = BlogPost.create!(
        title: title,
        content: result[:content],
        ai_model: ai_model,
        status: 'draft'
      )

      Rails.logger.info "Blog post created: #{blog_post.id} - #{blog_post.title}"

      {
        success: true,
        blog_post_id: blog_post.id,
        slug: blog_post.slug
      }
    else
      Rails.logger.error "Failed to generate blog post: #{result[:error]}"
      raise StandardError, "Blog generation failed: #{result[:error]}"
    end
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.error "Failed to save blog post: #{e.message}"
    raise
  rescue StandardError => e
    Rails.logger.error "Error generating blog post '#{title}': #{e.message}"
    raise
  end

  # Generate multiple blog posts
  def self.perform_bulk(titles, ai_model = 'gemini', context: nil, word_count: 1000)
    titles.each do |title|
      perform_later(title, ai_model, context: context, word_count: word_count)
    end
  end
end
