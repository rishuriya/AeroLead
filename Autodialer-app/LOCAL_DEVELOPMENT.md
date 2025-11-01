# Local Development Setup

## Running the Application Locally

The `bin/start-web.sh` script is now **conditional**:
- **On Render**: Runs both Puma + Sidekiq together (required for free tier)
- **Locally**: Runs only Puma (you control Sidekiq separately)

## Option 1: Using Foreman (Recommended)

Foreman reads the `Procfile` and runs both processes:

```bash
# Install foreman (if not already installed)
gem install foreman

# Start both web and worker
foreman start
```

This will start:
- `web`: Puma server on port 3000
- `worker`: Sidekiq background worker

## Option 2: Separate Terminals

Run each process in a separate terminal:

```bash
# Terminal 1: Start Rails server
rails server
# or
bundle exec puma -C config/puma.rb

# Terminal 2: Start Sidekiq worker
bundle exec sidekiq -C config/sidekiq.yml
```

## Option 3: Using Rails Server (Only Web)

If you just want to test the web interface without background jobs:

```bash
rails server
# or
./bin/start-web.sh  # Will detect it's local and run only Puma
```

## Environment Variables

Make sure you have a `.env` file with:

```bash
DATABASE_URL=postgresql://localhost/autodialer_development
REDIS_URL=redis://localhost:6379/0
RAILS_ENV=development
# ... other API keys
```

## Checking What Mode It's Running

The script will print:
- **Local**: "Running locally - starting Puma only..."
- **Render**: "Running on Render - starting both Puma and Sidekiq together..."

## Troubleshooting

### Sidekiq Not Running Locally
- Make sure Redis is running: `redis-server`
- Check `REDIS_URL` is correct in `.env`
- Run Sidekiq manually: `bundle exec sidekiq`

### Script Runs Both Processes Locally
- Check if `RAILS_ENV=production` is set (should be `development` locally)
- Check if `PORT` is set (shouldn't be set locally, or use different port)
- The script checks for `FOREMAN_PROJECT_NAME` - if using Foreman, it won't run both

### Use Foreman for Development
**Best practice**: Use `foreman start` for local development - it matches production setup better.


