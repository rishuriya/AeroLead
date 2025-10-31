# CORS Configuration for API access
# Be sure to restart your server when you modify this file.

# Avoid CORS issues when API is called from the frontend app.
# Handle Cross-Origin Resource Sharing (CORS) in order to accept cross-origin AJAX requests.

# Read more: https://github.com/cyu/rack-cors

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  # Allow API access from any origin in development
  if Rails.env.development?
    allow do
      origins '*'
      resource '/api/*',
        headers: :any,
        methods: [:get, :post, :put, :patch, :delete, :options, :head],
        credentials: false,
        max_age: 600
    end

    allow do
      origins '*'
      resource '/webhooks/*',
        headers: :any,
        methods: [:post, :options],
        credentials: false
    end
  end

  # Production: specify allowed origins
  if Rails.env.production?
    allowed_origins = ENV['ALLOWED_ORIGINS']&.split(',') || []

    if allowed_origins.any?
      allow do
        origins allowed_origins
        resource '/api/*',
          headers: :any,
          methods: [:get, :post, :put, :patch, :delete, :options, :head],
          credentials: true,
          max_age: 3600
      end

      allow do
        origins allowed_origins
        resource '/webhooks/*',
          headers: :any,
          methods: [:post, :options],
          credentials: false
      end
    else
      # If no origins specified, allow all (not recommended for production)
      Rails.logger.warn "WARNING: CORS is allowing all origins in production. Set ALLOWED_ORIGINS env variable."

      allow do
        origins '*'
        resource '/api/*',
          headers: :any,
          methods: [:get, :post, :put, :patch, :delete, :options, :head],
          credentials: false
      end

      allow do
        origins '*'
        resource '/webhooks/*',
          headers: :any,
          methods: [:post, :options],
          credentials: false
      end
    end
  end
end
