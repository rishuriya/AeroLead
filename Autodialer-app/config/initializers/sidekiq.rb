# Sidekiq Configuration
# Background job processing with Redis
# Note: redis_url_fix.rb runs before this initializer to fix Render's Redis URL format

redis_url = ENV['REDIS_URL'] || 'redis://localhost:6379/0'

# Ensure URL is in correct format
if redis_url.start_with?('postgresql://')
  Rails.logger.warn "WARNING: Redis URL still in PostgreSQL format! Check redis_url_fix.rb initializer."
end

Sidekiq.configure_server do |config|
  config.redis = {
    url: redis_url,
    network_timeout: 10,
    pool_timeout: 10
  }

  # Server-specific configuration
  config.logger.level = Rails.logger.level

  # Lifecycle hooks
  config.on(:startup) do
    Rails.logger.info "Sidekiq server started"
  end

  config.on(:quiet) do
    Rails.logger.info "Sidekiq server quieting down"
  end

  config.on(:shutdown) do
    Rails.logger.info "Sidekiq server shutting down"
  end
end

Sidekiq.configure_client do |config|
  config.redis = {
    url: redis_url,
    network_timeout: 10,
    pool_timeout: 10,
    size: 5
  }
end

# Dead job retention
Sidekiq.default_job_options = {
  'backtrace' => true,
  'retry' => 3
}

# Configure queues in the server block (queues are configured per process)
# Default queue priority (higher number = higher priority)
# Queues are specified when starting Sidekiq: bundle exec sidekiq -q critical,5 -q default,3 -q low,1

# Log failed jobs
Sidekiq.logger.level = Logger::INFO

Rails.logger.info "Sidekiq configured with Redis at #{redis_url}"
