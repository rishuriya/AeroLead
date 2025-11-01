# frozen_string_literal: true

class PhoneCall < ApplicationRecord
  # Turbo Streams for real-time updates
  after_create_commit { broadcast_prepend_to "phone_calls", partial: "phone_calls/phone_call", locals: { phone_call: self }, target: "phone_calls" }
  after_update_commit { broadcast_replace_to "phone_calls", partial: "phone_calls/phone_call", locals: { phone_call: self } }
  after_destroy_commit { broadcast_remove_to "phone_calls" }

  # Validations
  validates :phone_number, presence: true, phone: { possible: true, allow_blank: false }
  validates :status, presence: true, inclusion: {
    in: %w[queued ringing in-progress completed failed busy no-answer canceled],
    message: "%{value} is not a valid status"
  }

  # Scopes
  scope :successful, -> { where(status: 'completed') }
  scope :failed, -> { where(status: %w[failed busy no-answer canceled]) }
  scope :pending, -> { where(status: %w[queued ringing in-progress]) }
  scope :recent, -> { order(created_at: :desc) }
  scope :today, -> { where('created_at >= ?', Time.zone.now.beginning_of_day) }

  # Callbacks
  before_validation :normalize_phone_number
  after_create :enqueue_call_job

  # Class methods
  def self.success_rate
    total = count
    return 0 if total.zero?

    (successful.count.to_f / total * 100).round(2)
  end

  def self.analytics
    {
      total: count,
      successful: successful.count,
      failed: failed.count,
      pending: pending.count,
      success_rate: success_rate,
      total_duration: sum(:duration).to_i,
      average_duration: average(:duration).to_i
    }
  end

  # Instance methods
  def successful?
    status == 'completed'
  end

  def failed?
    %w[failed busy no-answer canceled].include?(status)
  end

  def pending?
    %w[queued ringing in-progress].include?(status)
  end

  def duration_in_seconds
    return 0 if duration.nil?

    duration.to_i
  end

  def formatted_duration
    return "N/A" if duration.nil?

    minutes = duration / 60
    seconds = duration % 60
    format("%d:%02d", minutes, seconds)
  end

  # Alias for compatibility
  alias_method :duration_formatted, :formatted_duration

  # Refresh call status from Twilio
  def refresh_status!
    return unless call_sid.present?
    return if %w[completed failed busy no-answer canceled].include?(status)

    twilio = TwilioService.new
    status_result = twilio.get_call_status(call_sid)

    return if status_result[:error].present?

    twilio_status = status_result[:status].to_s.downcase
    mapped_status = map_twilio_status(twilio_status)

    update_params = { status: mapped_status }
    update_params[:duration] = status_result[:duration].to_i if status_result[:duration].present?

    update(update_params)
    mapped_status
  end

  def enqueue_call_job
    # Enqueue background job to make the call
    if status == 'queued'
      # Check if Sidekiq is available (development fallback)
      if Rails.env.development? && !sidekiq_available?
        # Make call immediately in development if Sidekiq isn't running
        PhoneCallJob.perform_now(id)
      else
        # Use background job in production
        PhoneCallJob.perform_later(id)
      end
    end
  end

  private

  def normalize_phone_number
    return unless phone_number.present?

    # Remove all non-digit characters except +
    normalized = phone_number.gsub(/[^\d+]/, '')

    # Add + if not present and starts with country code
    normalized = "+#{normalized}" unless normalized.start_with?('+')

    self.phone_number = normalized
  end

  def sidekiq_available?
    # Check if Redis is available and Sidekiq is processing jobs
    begin
      Redis.new(url: ENV['REDIS_URL'] || 'redis://localhost:6379/0').ping == 'PONG'
    rescue StandardError
      false
    end
  end

  def map_twilio_status(twilio_status)
    case twilio_status.downcase
    when 'queued'
      'queued'
    when 'ringing'
      'ringing'
    when 'in-progress'
      'in-progress'
    when 'completed'
      'completed'
    when 'busy'
      'busy'
    when 'no-answer'
      'no-answer'
    when 'failed'
      'failed'
    when 'canceled'
      'canceled'
    else
      twilio_status
    end
  end
end
