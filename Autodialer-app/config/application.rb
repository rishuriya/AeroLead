require_relative "boot"

require "rails/all"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module AutodialerApp
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 7.1

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w(assets tasks))

    # Ensure app/services is autoloaded
    config.autoload_paths << Rails.root.join('app', 'services')

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    # config.time_zone = "Central Time (US & Canada)"
    # config.eager_load_paths << Rails.root.join("extras")

    # Set default time zone to IST (Indian Standard Time)
    config.time_zone = 'Asia/Kolkata'
    config.active_record.default_timezone = :local

    # API configuration
    config.api_only = false

    # Active Job configuration for Sidekiq
    config.active_job.queue_adapter = :sidekiq

    # Session store configuration
    config.session_store :cookie_store, key: '_autodialer_session'

    # CORS configuration (if needed for API)
    config.middleware.insert_before 0, Rack::Cors do
      allow do
        origins '*'
        resource '/api/*',
          headers: :any,
          methods: [:get, :post, :put, :patch, :delete, :options, :head],
          credentials: false
      end
    end

    # Generator configuration
    config.generators do |g|
      g.test_framework :rspec, fixture: true
      g.fixture_replacement :factory_bot, dir: "spec/factories"
      g.view_specs false
      g.helper_specs false
      g.stylesheets false
      g.javascripts false
      g.helper false
    end

    # Enable asset pipeline
    config.assets.enabled = true if config.respond_to?(:assets)

    # Rails 7.1+ uses importmap by default for JS
    config.importmap.sweep_cache if config.respond_to?(:importmap)

    # Log configuration
    config.log_level = :info
    config.log_tags = [:request_id]

    # Custom configuration
    config.x.twilio.test_mode = ENV['TWILIO_TEST_MODE'] == 'true'
    config.x.ai.default_model = ENV['DEFAULT_AI_MODEL'] || 'gemini'

    # Rate limiting configuration
    config.x.rate_limit.calls_per_minute = 10
    config.x.rate_limit.blogs_per_hour = 50

    # Don't generate system test files
    config.generators.system_tests = nil
  end
end
