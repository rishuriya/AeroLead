# frozen_string_literal: true

class CallStatusPollJob < ApplicationJob
  queue_as :default

  def perform(phone_call_id)
    phone_call = PhoneCall.find(phone_call_id)

    # Skip if no call_sid (call not initiated yet)
    return unless phone_call.call_sid.present?

    # Skip if already completed or failed
    return if %w[completed failed busy no-answer canceled].include?(phone_call.status)

    # Fetch status from Twilio
    twilio = TwilioService.new
    status_result = twilio.get_call_status(phone_call.call_sid)

    if status_result[:error].present?
      Rails.logger.error "Error fetching call status for #{phone_call.id}: #{status_result[:error]}"
      return
    end

    # Map Twilio status to our status
    twilio_status = status_result[:status].to_s.downcase
    mapped_status = map_twilio_status(twilio_status)

    # Update phone call with latest status
    update_params = {
      status: mapped_status
    }

    # Update duration if available
    if status_result[:duration].present?
      update_params[:duration] = status_result[:duration].to_i
    end

    phone_call.update(update_params)

    Rails.logger.info "Updated phone call #{phone_call.id} status to: #{mapped_status}"

    # If call is still in progress, schedule another check
    if %w[queued ringing in-progress].include?(mapped_status)
      # Schedule next check in 10 seconds
      CallStatusPollJob.set(wait: 10.seconds).perform_later(phone_call_id)
    end
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.error "Phone call not found: #{e.message}"
  rescue StandardError => e
    Rails.logger.error "Error polling call status for #{phone_call_id}: #{e.message}"
  end

  private

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

