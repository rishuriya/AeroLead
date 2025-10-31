module ApplicationHelper
  # Status color mapping for phone calls
  def status_color(status)
    case status.to_s.downcase
    when 'completed', 'success'
      '#198754' # green
    when 'failed', 'error'
      '#dc3545' # red
    when 'queued', 'pending'
      '#6c757d' # gray
    when 'ringing'
      '#0dcaf0' # cyan
    when 'in-progress', 'processing'
      '#0d6efd' # blue
    when 'busy'
      '#ffc107' # yellow/warning
    when 'no-answer', 'no_answer'
      '#6c757d' # gray
    when 'canceled', 'cancelled'
      '#343a40' # dark
    else
      '#6c757d' # default gray
    end
  end

  # Status badge class for phone calls
  def call_status_badge_class(status)
    case status.to_s.downcase
    when 'completed'
      'bg-success'
    when 'failed'
      'bg-danger'
    when 'in-progress'
      'bg-info'
    when 'ringing'
      'bg-primary'
    when 'busy'
      'bg-warning'
    when 'no-answer'
      'bg-secondary'
    when 'canceled'
      'bg-dark'
    else
      'bg-secondary'
    end
  end

  # Status badge class for blog posts
  def blog_status_badge_class(status)
    case status.to_s.downcase
    when 'published'
      'bg-success'
    when 'draft'
      'bg-warning'
    when 'archived'
      'bg-secondary'
    else
      'bg-secondary'
    end
  end

  # Format phone number for display
  def format_phone_number(phone_number)
    return phone_number unless phone_number.present?

    # Remove any non-digit characters
    digits = phone_number.gsub(/\D/, '')

    # Format Indian phone numbers (+91 XXXXX XXXXX)
    if digits.start_with?('91') && digits.length == 12
      "+91 #{digits[2..6]} #{digits[7..11]}"
    elsif digits.length == 10
      "+91 #{digits[0..4]} #{digits[5..9]}"
    else
      phone_number
    end
  end

  # Format duration in seconds to human readable format
  def format_duration(seconds)
    return 'N/A' unless seconds.present? && seconds.positive?

    minutes = seconds / 60
    secs = seconds % 60

    if minutes > 0
      "#{minutes}m #{secs}s"
    else
      "#{secs}s"
    end
  end

  # Humanize AI model name
  def humanize_ai_model(model)
    return 'Unknown' unless model.present?

    case model.to_s.downcase
    when 'gemini'
      'Google Gemini'
    when 'openai', 'gpt'
      'OpenAI GPT-4'
    when 'anthropic', 'claude'
      'Anthropic Claude'
    else
      model.titleize
    end
  end

  # Generate page title with site name
  def page_title(title = nil)
    base_title = 'Autodialer with AI Blog Generator'
    title.present? ? "#{title} | #{base_title}" : base_title
  end

  # Icon for AI model
  def ai_model_icon(model)
    case model.to_s.downcase
    when 'gemini'
      'bi-stars'
    when 'openai', 'gpt'
      'bi-robot'
    when 'anthropic', 'claude'
      'bi-chat-dots'
    else
      'bi-cpu'
    end
  end

  # Status icon for phone call
  def call_status_icon(status)
    case status.to_s.downcase
    when 'completed'
      'bi-check-circle-fill'
    when 'failed'
      'bi-x-circle-fill'
    when 'in-progress'
      'bi-arrow-repeat'
    when 'ringing'
      'bi-phone-vibrate-fill'
    when 'busy'
      'bi-exclamation-triangle-fill'
    when 'no-answer'
      'bi-telephone-x-fill'
    when 'canceled'
      'bi-slash-circle-fill'
    when 'queued'
      'bi-clock-fill'
    else
      'bi-question-circle-fill'
    end
  end

  # Truncate text with ellipsis
  def smart_truncate(text, length: 100, separator: ' ')
    return text unless text.present? && text.length > length

    text.truncate(length, separator: separator, omission: '...')
  end

  # Format number with delimiter
  def format_number(number)
    number_with_delimiter(number)
  end

  # Calculate percentage
  def calculate_percentage(part, total)
    return 0 if total.zero?
    ((part.to_f / total.to_f) * 100).round(2)
  end

  # Success rate class for styling
  def success_rate_class(rate)
    case rate
    when 0..25
      'text-danger'
    when 26..50
      'text-warning'
    when 51..75
      'text-info'
    else
      'text-success'
    end
  end

  # Markdown to HTML (for previews)
  def markdown_to_html(text)
    return '' unless text.present?

    markdown = Redcarpet::Markdown.new(
      Redcarpet::Render::HTML.new(hard_wrap: true, filter_html: false),
      autolink: true,
      space_after_headers: true,
      fenced_code_blocks: true,
      strikethrough: true,
      superscript: true,
      highlight: true,
      tables: true
    )

    markdown.render(text).html_safe
  end

  # Time ago in words with icon
  def time_ago_with_icon(time)
    return 'N/A' unless time.present?

    content_tag(:span, class: 'text-muted') do
      concat content_tag(:i, '', class: 'bi bi-clock me-1')
      concat time_ago_in_words(time)
      concat ' ago'
    end
  end

  # Active nav link class
  def active_nav_class(path)
    current_page?(path) ? 'active' : ''
  end

  # Active controller class
  def active_controller_class(controller_name)
    controller.controller_name == controller_name ? 'active' : ''
  end

  # Flash message icon
  def flash_icon(type)
    case type.to_s
    when 'notice', 'success'
      'bi-check-circle-fill'
    when 'alert', 'error'
      'bi-exclamation-triangle-fill'
    when 'warning'
      'bi-exclamation-circle-fill'
    when 'info'
      'bi-info-circle-fill'
    else
      'bi-bell-fill'
    end
  end

  # Flash message class
  def flash_class(type)
    case type.to_s
    when 'notice', 'success'
      'alert-success'
    when 'alert', 'error'
      'alert-danger'
    when 'warning'
      'alert-warning'
    when 'info'
      'alert-info'
    else
      'alert-primary'
    end
  end
end
