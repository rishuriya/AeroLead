#!/usr/bin/env bash
# Conditional startup script:
# - On Render/production: Runs both Puma + Sidekiq together (free tier limitation)
# - Locally: Runs only Puma (use Procfile/foreman for separate processes)

set -e

# Check if running on Render
# Render sets RENDER=true, or check for production with PORT (Render always sets PORT)
if [ "$RENDER" = "true" ] || ([ "$RAILS_ENV" = "production" ] && [ -n "$PORT" ] && [ -z "$FOREMAN_PROJECT_NAME" ]); then
  # Running on Render - start both Puma and Sidekiq together
  echo "Running on Render - starting both Puma and Sidekiq together..."
  
  # Function to handle shutdown signals
  cleanup() {
    echo "Received shutdown signal, stopping processes..."
    if [ ! -z "$SIDEKIQ_PID" ]; then
      kill $SIDEKIQ_PID 2>/dev/null || true
      wait $SIDEKIQ_PID 2>/dev/null || true
    fi
    exit 0
  }
  
  # Set up signal handlers
  trap cleanup SIGTERM SIGINT SIGQUIT
  
  # Start Sidekiq in the background
  echo "Starting Sidekiq worker..."
  bundle exec sidekiq -C config/sidekiq.yml &
  SIDEKIQ_PID=$!
  
  # Wait a moment for Sidekiq to initialize and establish Redis connection
  sleep 5
  
  # Start Puma in the foreground (main process - Render detects port via this)
  echo "Starting Puma server..."
  bundle exec puma -C config/puma.rb
else
  # Running locally - only start Puma
  # Use 'foreman start' or run 'rails server' for local development
  echo "Running locally - starting Puma only..."
  echo "To run Sidekiq locally, use: bundle exec sidekiq -C config/sidekiq.yml"
  echo "Or use: foreman start (from Procfile)"
  bundle exec puma -C config/puma.rb
fi

