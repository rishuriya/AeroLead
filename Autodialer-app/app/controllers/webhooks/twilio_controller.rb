# frozen_string_literal: true

module Webhooks
  class TwilioController < ApplicationController
    skip_before_action :verify_authenticity_token
    before_action :verify_twilio_request, except: [:voice_callback]

    # POST /webhooks/twilio/status
    def status_callback
      call_sid = params['CallSid']
      call_status = params['CallStatus']
      call_duration = params['CallDuration']

      phone_call = PhoneCall.find_by(call_sid: call_sid)

      if phone_call
        phone_call.update(
          status: map_twilio_status(call_status),
          duration: call_duration.to_i,
          called_at: Time.current
        )

        Rails.logger.info "Updated phone call #{phone_call.id}: #{call_status}"
      else
        Rails.logger.warn "Phone call not found for SID: #{call_sid}"
      end

      head :ok
    end

    # POST /webhooks/twilio/voice
    def voice_callback
      # This is called when a call is initiated
      # Return TwiML if needed
      render xml: <<~TWIML
        <Response>
          <Say voice="Polly.Aditi">Thank you for your call.</Say>
        </Response>
      TWIML
    end

    private

    def verify_twilio_request
      # In production, verify Twilio signature
      # For now, we'll skip verification in development
      return true if Rails.env.development?

      # Add Twilio signature verification here
      # See: https://www.twilio.com/docs/usage/security#validating-requests
      true
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
end
