# frozen_string_literal: true

class PhoneCallJob < ApplicationJob
  queue_as :default

  retry_on StandardError, wait: :exponentially_longer, attempts: 3

  def perform(phone_call_id)
    phone_call = PhoneCall.find(phone_call_id)

    # Skip if already processed
    return if phone_call.status != 'queued'

    # Update status to in-progress
    phone_call.update(status: 'in-progress')

    # Make the call using Twilio
    twilio = TwilioService.new
    callback_url = Rails.application.routes.url_helpers.webhooks_twilio_status_url(host: ENV.fetch('APP_HOST', 'localhost:3000'))

    result = twilio.make_call(
      phone_call.phone_number,
      phone_call.message || 'This is an automated call.',
      callback_url: callback_url
    )

    if result[:error].present?
      # Call failed
      phone_call.update(
        status: 'failed',
        error_message: result[:error]
      )
      Rails.logger.error "Phone call #{phone_call.id} failed: #{result[:error]}"
    else
      # Call initiated successfully
      phone_call.update(
        call_sid: result[:sid],
        status: result[:status],
        called_at: Time.current
      )
      Rails.logger.info "Phone call #{phone_call.id} initiated with SID: #{result[:sid]}"

      # Start polling for status updates (since webhooks may not work in development)
      # Poll every 10 seconds until call is completed
      CallStatusPollJob.set(wait: 10.seconds).perform_later(phone_call_id)
    end
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.error "Phone call not found: #{e.message}"
  rescue StandardError => e
    Rails.logger.error "Error processing phone call #{phone_call_id}: #{e.message}"
    phone_call&.update(
      status: 'failed',
      error_message: e.message
    )
    raise # Re-raise to trigger retry
  end
end
