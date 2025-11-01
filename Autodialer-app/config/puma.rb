# Puma configuration file.

# The directory to operate in
directory Dir.pwd

# Allow puma to be restarted by `rails restart` command.
plugin :tmp_restart

# Specifies the `environment` that Puma will run in.
environment ENV.fetch("RAILS_ENV") { "development" }

# Specifies the `pidfile` that Puma will use.
# Disabled for Cloud Run (doesn't need PID files)
# pidfile ENV.fetch("PIDFILE") { "tmp/pids/server.pid" }

# Cloud Run uses PORT environment variable and doesn't support workers mode well
# Use port from ENV (Cloud Run sets this), default to 8080 for GCP, 3000 for local
# Note: Don't use both 'port' and 'bind' - they conflict. Use only 'bind' below.
# port ENV.fetch("PORT") { ENV.fetch("RAILS_ENV") { "development" } == "production" ? 8080 : 3000 }

# Cloud Run doesn't support workers mode well, use threads only
# For GCP Cloud Run: always use 0 workers
# For Render: use workers if WEB_CONCURRENCY is set
if ENV.fetch("RAILS_ENV") { "development" } == "production"
  # Check if running on Cloud Run (PORT will be set by Cloud Run)
  if ENV["PORT"] && ENV["PORT"].to_i >= 8080
    # Cloud Run: no workers, threads only
    workers 0
  else
    # Render: use workers if specified
    workers ENV.fetch("WEB_CONCURRENCY") { 2 }
    preload_app! if ENV.fetch("WEB_CONCURRENCY") { 2 }.to_i > 0
  end
else
  # Development: use threads only (no workers) to avoid macOS fork issues
  workers 0
end

# Specifies the number of `threads` to use
max_threads_count = ENV.fetch("RAILS_MAX_THREADS") { 5 }
min_threads_count = ENV.fetch("RAILS_MIN_THREADS") { max_threads_count }
threads min_threads_count, max_threads_count

# Bind configuration
# Cloud Run: bind to 0.0.0.0 on PORT
# Render: bind to 0.0.0.0 on PORT
# Local development: bind to localhost
if ENV.fetch("RAILS_ENV") { "development" } == "production"
  # Production: bind to all interfaces
  bind "tcp://0.0.0.0:#{ENV.fetch("PORT") { 8080 }}"
else
  # Development: bind to localhost
  bind "tcp://127.0.0.1:#{ENV.fetch("PORT") { 3000 }}"
end

# Set up before_fork and on_worker_boot for zero-downtime deploys
# Only needed when using workers (not on Cloud Run)
if ENV.fetch("RAILS_ENV") { "development" } == "production" && 
   !(ENV["PORT"] && ENV["PORT"].to_i >= 8080) && 
   ENV.fetch("WEB_CONCURRENCY") { 2 }.to_i > 0
  on_worker_boot do
    ActiveRecord::Base.establish_connection if defined?(ActiveRecord)
  end

  before_fork do
    ActiveRecord::Base.connection_pool.disconnect! if defined?(ActiveRecord)
  end
end
