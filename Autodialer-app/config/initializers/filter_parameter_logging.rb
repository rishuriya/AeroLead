# Be sure to restart your server when you modify this file.

# Configure parameters to be partially matched (e.g. passw matches password) and filtered from the log file.
# Use this to limit dissemination of sensitive information.
# See the ActiveSupport::ParameterFilter documentation for supported notations and behaviors.

Rails.application.config.filter_parameters += [
  :passw, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn,
  :password, :password_confirmation,
  :api_key, :access_token, :refresh_token, :auth_token,
  :twilio_account_sid, :twilio_auth_token,
  :gemini_api_key, :openai_api_key, :anthropic_api_key,
  :stripe_api_key, :aws_access_key_id, :aws_secret_access_key
]
