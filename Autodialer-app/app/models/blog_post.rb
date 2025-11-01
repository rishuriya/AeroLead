# frozen_string_literal: true

class BlogPost < ApplicationRecord
  # Validations
  validates :title, presence: true, length: { minimum: 5, maximum: 200 }
  validates :slug, presence: true, uniqueness: true, format: {
    with: /\A[a-z0-9\-]+\z/,
    message: "only allows lowercase letters, numbers, and hyphens"
  }
  validates :content, presence: true, length: { minimum: 100 }
  validates :status, inclusion: { in: %w[draft published archived] }
  validates :ai_model, inclusion: {
    in: %w[gemini openai anthropic],
    allow_nil: true
  }

  # Callbacks
  before_validation :generate_slug, on: :create, if: -> { slug.blank? && title.present? }
  before_validation :generate_excerpt, if: -> { excerpt.blank? && content.present? }

  # Scopes
  scope :published, -> { where(status: 'published').where.not(published_at: nil) }
  scope :draft, -> { where(status: 'draft') }
  scope :archived, -> { where(status: 'archived') }
  scope :recent, -> { order(created_at: :desc) }
  scope :by_ai_model, ->(model) { where(ai_model: model) }

  # Class methods
  def self.search(query)
    return all if query.blank?

    where("title ILIKE ? OR content ILIKE ?", "%#{query}%", "%#{query}%")
  end

  def self.statistics
    {
      total: count,
      published: published.count,
      draft: draft.count,
      archived: archived.count,
      by_ai_model: group(:ai_model).count
    }
  end

  # Instance methods
  def publish!
    update(status: 'published', published_at: Time.current)
  end

  def unpublish!
    update(status: 'draft', published_at: nil)
  end

  def archive!
    update(status: 'archived')
  end

  def published?
    status == 'published' && published_at.present?
  end

  def draft?
    status == 'draft'
  end

  def archived?
    status == 'archived'
  end

  def word_count
    content.split.size
  end

  def reading_time
    # Average reading speed: 200 words per minute
    (word_count / 200.0).ceil
  end

  def content_html
    # Convert markdown to HTML if needed
    return content unless content.present?

    renderer = Redcarpet::Render::HTML.new(
      hard_wrap: true,
      filter_html: false,
      with_toc_data: true
    )
    markdown = Redcarpet::Markdown.new(renderer, {
      autolink: true,
      tables: true,
      fenced_code_blocks: true,
      strikethrough: true,
      highlight: true
    })
    markdown.render(content).html_safe
  end

  private

  def generate_slug
    return if title.blank?

    base_slug = title.parameterize
    slug_candidate = base_slug
    counter = 1

    while BlogPost.exists?(slug: slug_candidate)
      slug_candidate = "#{base_slug}-#{counter}"
      counter += 1
    end

    self.slug = slug_candidate
  end

  def generate_excerpt
    return if content.blank?

    # Take first 200 characters or first paragraph
    plain_text = content.gsub(/[#*`\[\]()]/, '').strip
    self.excerpt = plain_text.truncate(200, separator: ' ')
  end
end
