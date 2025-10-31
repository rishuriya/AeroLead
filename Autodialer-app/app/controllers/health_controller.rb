# frozen_string_literal: true

class HealthController < ApplicationController
  skip_before_action :verify_authenticity_token

  def index
    health_status = {
      status: 'ok',
      timestamp: Time.current,
      services: {}
    }

    # Check database
    begin
      ActiveRecord::Base.connection.execute('SELECT 1')
      health_status[:services][:database] = 'ok'
    rescue StandardError => e
      health_status[:services][:database] = 'error'
      health_status[:status] = 'degraded'
    end

    # Check Redis (if using Sidekiq)
    begin
      if defined?(Sidekiq)
        Sidekiq.redis(&:ping)
        health_status[:services][:redis] = 'ok'
      end
    rescue StandardError => e
      health_status[:services][:redis] = 'error'
      health_status[:status] = 'degraded'
    end

    # Check Twilio
    begin
      if ENV['TWILIO_ACCOUNT_SID'].present?
        health_status[:services][:twilio] = 'configured'
      else
        health_status[:services][:twilio] = 'not_configured'
      end
    rescue StandardError
      health_status[:services][:twilio] = 'error'
    end

    render json: health_status
  end
end
