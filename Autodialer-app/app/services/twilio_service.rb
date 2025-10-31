# frozen_string_literal: true

class TwilioService
  attr_reader :client

  def initialize
    @client = Twilio::REST::Client.new(
      ENV['TWILIO_ACCOUNT_SID'],
      ENV['TWILIO_AUTH_TOKEN']
    )
  end

  # Make a call to a phone number with a message
  def make_call(phone_number, message, callback_url: nil)
    return test_call_response if test_mode?

    call = client.calls.create(
      from: ENV['TWILIO_PHONE_NUMBER'],
      to: normalize_phone_number(phone_number),
      twiml: generate_twiml(message),
      status_callback: callback_url,
      status_callback_event: %w[initiated ringing answered completed],
      status_callback_method: 'POST'
    )

    {
      sid: call.sid,
      status: call.status,
      to: call.to,
      from: call.from,
      direction: call.direction
    }
  rescue Twilio::REST::RestError => e
    Rails.logger.error "Twilio API Error: #{e.message}"
    handle_twilio_error(e)
  rescue StandardError => e
    Rails.logger.error "Unexpected error making call: #{e.message}"
    { error: e.message, status: 'failed' }
  end

  # Make bulk calls
  def make_bulk_calls(phone_numbers, message, callback_url: nil)
    results = []

    phone_numbers.each do |number|
      result = make_call(number, message, callback_url: callback_url)
      results << result.merge(phone_number: number)

      # Add delay to respect rate limits
      sleep(rate_limit_delay) unless test_mode?
    end

    results
  end

  # Get call status
  def get_call_status(call_sid)
    return test_call_status if test_mode?

    call = client.calls(call_sid).fetch

    {
      sid: call.sid,
      status: call.status,
      duration: call.duration,
      start_time: call.start_time,
      end_time: call.end_time,
      price: call.price,
      price_unit: call.price_unit
    }
  rescue Twilio::REST::RestError => e
    Rails.logger.error "Error fetching call status: #{e.message}"
    { error: e.message }
  end

  # Cancel a call
  def cancel_call(call_sid)
    return { status: 'canceled' } if test_mode?

    call = client.calls(call_sid).update(status: 'canceled')
    { status: call.status }
  rescue Twilio::REST::RestError => e
    Rails.logger.error "Error canceling call: #{e.message}"
    { error: e.message }
  end

  # Get account balance
  def account_balance
    return { balance: '100.00', currency: 'USD' } if test_mode?

    balance = client.api.v2010.accounts(ENV['TWILIO_ACCOUNT_SID']).fetch.balance
    {
      balance: balance.balance,
      currency: balance.currency
    }
  rescue Twilio::REST::RestError => e
    Rails.logger.error "Error fetching account balance: #{e.message}"
    { error: e.message }
  end

  private

  # Generate TwiML (Twilio Markup Language) for the call
  def generate_twiml(message)
    <<~TWIML
      <Response>
        <Say voice="Polly.Aditi" language="en-IN">#{escape_xml(message)}</Say>
        <Pause length="1"/>
        <Say voice="Polly.Aditi">Thank you. Goodbye.</Say>
      </Response>
    TWIML
  end

  def escape_xml(text)
    text.to_s
        .gsub('&', '&amp;')
        .gsub('<', '&lt;')
        .gsub('>', '&gt;')
        .gsub('"', '&quot;')
        .gsub("'", '&apos;')
  end

  def normalize_phone_number(number)
    # Remove all non-digit characters except +
    normalized = number.to_s.gsub(/[^\d+]/, '')

    # Add + if not present
    normalized = "+#{normalized}" unless normalized.start_with?('+')

    # For Indian numbers, ensure they start with +91
    if normalized.length == 10 && !normalized.start_with?('+')
      normalized = "+91#{normalized}"
    elsif normalized.length == 12 && normalized.start_with?('91') && !normalized.start_with?('+')
      normalized = "+#{normalized}"
    end

    normalized
  end

  def test_mode?
    ENV['TWILIO_TEST_MODE'] == 'true' || Rails.env.test?
  end

  def rate_limit_delay
    # Calls per minute from env or default to 10
    calls_per_minute = ENV.fetch('TWILIO_CALLS_PER_MINUTE', 10).to_i
    60.0 / calls_per_minute
  end

  def handle_twilio_error(error)
    case error.code
    when 21_211
      { error: 'Invalid phone number', status: 'failed' }
    when 21_214
      { error: 'Invalid from phone number', status: 'failed' }
    when 20_003
      { error: 'Authentication error', status: 'failed' }
    when 21_604
      { error: 'Phone number not verified (Trial account)', status: 'failed' }
    else
      { error: error.message, status: 'failed' }
    end
  end

  # Test mode responses
  def test_call_response
    {
      sid: "CA#{SecureRandom.hex(16)}",
      status: 'queued',
      to: '+919876543210',
      from: ENV['TWILIO_PHONE_NUMBER'],
      direction: 'outbound-api'
    }
  end

  def test_call_status
    {
      sid: "CA#{SecureRandom.hex(16)}",
      status: 'completed',
      duration: rand(30..120).to_s,
      start_time: 1.minute.ago,
      end_time: Time.current,
      price: '-0.0075',
      price_unit: 'USD'
    }
  end
end
