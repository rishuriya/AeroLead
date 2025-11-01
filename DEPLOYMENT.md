# AeroLead Deployment Guide

Complete guide for building, pushing, deploying, and managing the AeroLead application across different platforms.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Local Docker Deployment](#local-docker-deployment)
- [Google Cloud Platform (GCP) Deployment](#google-cloud-platform-gcp-deployment)
- [Render.com Deployment](#rendercom-deployment)
- [Database Migrations](#database-migrations)
- [Health Checks](#health-checks)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

- Docker Desktop (for local builds)
- Google Cloud SDK (`gcloud`) - for GCP deployment
- PostgreSQL client (for manual DB access)
- Git

### Installation

```bash
# Install Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop

# Install Google Cloud SDK
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init

# Install PostgreSQL client (macOS)
brew install postgresql

# Install PostgreSQL client (Ubuntu/Debian)
sudo apt-get install postgresql-client
```

### Required Accounts

- Google Cloud Platform account (for GCP deployment)
- Render.com account (for Render deployment)
- Twilio account (for phone calling)
- Google Gemini API key (for AI features)

---

## Environment Variables

All deployments require these environment variables:

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database_name

# Redis
REDIS_URL=redis://host:6379/0

# Twilio (Phone Calling)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+15551234567

# AI Services
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXX

# LinkedIn Scraper (Optional)
LINKEDIN_EMAIL=your-linkedin-email@example.com
LINKEDIN_PASSWORD=your-linkedin-password
LINKEDIN_SCRAPER_PATH=/app/lib/linkedin_scraper

# Rails
RAILS_ENV=production
RAILS_MASTER_KEY=your_master_key_here
SECRET_KEY_BASE=your_secret_key_base_here
RAILS_LOG_TO_STDOUT=true
RAILS_SERVE_STATIC_FILES=true

# Server
PORT=8080
WEB_CONCURRENCY=2
RAILS_MAX_THREADS=5
```

### Optional Variables

```bash
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MAX_PHONE_NUMBERS_PER_BATCH=100
MAX_BULK_ARTICLES=20
```

---

## Local Docker Deployment

Test your application locally using Docker before deploying to production.

### 1. Build Docker Images

#### Build Web Service Image

```bash
cd Autodialer-app

# Build the web service (Rails + Puma)
docker build -f Dockerfile.gcp -t aerolead-web:latest .
```

#### Build Worker Service Image

```bash
# Build the worker service (Sidekiq with Puppeteer)
docker build -f Dockerfile.worker.gcp -t aerolead-worker:latest .
```

### 2. Run with Docker Compose

Create a `docker-compose.yml` file in the `Autodialer-app` directory:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: aerolead
      POSTGRES_PASSWORD: password
      POSTGRES_DB: aerolead_production
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  web:
    image: aerolead-web:latest
    depends_on:
      - postgres
      - redis
    ports:
      - "8080:8080"
    environment:
      DATABASE_URL: postgresql://aerolead:password@postgres:5432/aerolead_production
      REDIS_URL: redis://redis:6379/0
      RAILS_ENV: production
      PORT: 8080
      TWILIO_ACCOUNT_SID: ${TWILIO_ACCOUNT_SID}
      TWILIO_AUTH_TOKEN: ${TWILIO_AUTH_TOKEN}
      TWILIO_PHONE_NUMBER: ${TWILIO_PHONE_NUMBER}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      SECRET_KEY_BASE: ${SECRET_KEY_BASE}
    command: >
      bash -c "
        bundle exec rails db:migrate &&
        bundle exec puma -C config/puma.rb
      "

  worker:
    image: aerolead-worker:latest
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgresql://aerolead:password@postgres:5432/aerolead_production
      REDIS_URL: redis://redis:6379/0
      RAILS_ENV: production
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      LINKEDIN_EMAIL: ${LINKEDIN_EMAIL}
      LINKEDIN_PASSWORD: ${LINKEDIN_PASSWORD}
      LINKEDIN_SCRAPER_PATH: /app/lib/linkedin_scraper
    command: /bin/bash /app/start-worker.sh

volumes:
  postgres_data:
  redis_data:
```

### 3. Start Services

```bash
# Create .env file with your credentials
cp .env.example .env
# Edit .env with your values

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f web
docker-compose logs -f worker

# Stop services
docker-compose down
```

### 4. Access Application

```bash
# Application
open http://localhost:8080

# Check health
curl http://localhost:8080/health
```

---

## Google Cloud Platform (GCP) Deployment

Deploy to Google Cloud Run for production use.

### Architecture

```
┌─────────────────────────────────────────┐
│          Google Cloud Platform          │
├─────────────────────────────────────────┤
│                                          │
│  ┌────────────────┐  ┌────────────────┐│
│  │  Cloud Run     │  │  Cloud Run     ││
│  │  (Web Service) │  │  (Worker)      ││
│  │  aerolead-web  │  │  aerolead-     ││
│  │                │  │  worker        ││
│  └────────┬───────┘  └────────┬───────┘│
│           │                    │        │
│  ┌────────▼────────────────────▼──────┐ │
│  │    Cloud SQL (PostgreSQL 15)       │ │
│  │    Production Database             │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │    Memorystore (Redis 7)           │ │
│  │    Job Queues & Cache              │ │
│  └────────────────────────────────────┘ │
│                                          │
└─────────────────────────────────────────┘
```

### Step-by-Step Deployment

#### 1. Setup GCP Project

```bash
# Set your project ID
export PROJECT_ID=your-project-id
export REGION=us-central1

# Login to GCP
gcloud auth login

# Set project
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  secretmanager.googleapis.com
```

#### 2. Create Cloud SQL Database

```bash
# Create PostgreSQL instance
gcloud sql instances create aerolead-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION \
  --root-password=YOUR_SECURE_PASSWORD

# Create database
gcloud sql databases create aerolead_production \
  --instance=aerolead-db

# Create user
gcloud sql users create aerolead \
  --instance=aerolead-db \
  --password=YOUR_DB_PASSWORD

# Get connection name
gcloud sql instances describe aerolead-db --format="value(connectionName)"
# Output: your-project-id:us-central1:aerolead-db
```

#### 3. Create Memorystore Redis

```bash
# Create Redis instance
gcloud redis instances create aerolead-redis \
  --size=1 \
  --region=$REGION \
  --redis-version=redis_7_0

# Get Redis host
gcloud redis instances describe aerolead-redis \
  --region=$REGION \
  --format="value(host)"
```

#### 4. Store Secrets

```bash
# Create secrets for sensitive data
echo -n "YOUR_TWILIO_SID" | gcloud secrets create twilio-account-sid --data-file=-
echo -n "YOUR_TWILIO_TOKEN" | gcloud secrets create twilio-auth-token --data-file=-
echo -n "YOUR_GEMINI_KEY" | gcloud secrets create gemini-api-key --data-file=-
echo -n "YOUR_SECRET_KEY_BASE" | gcloud secrets create rails-secret-key-base --data-file=-
```

#### 5. Build and Push Docker Images

```bash
cd Autodialer-app

# Build web service
docker build -f Dockerfile.gcp -t gcr.io/$PROJECT_ID/aerolead-web:latest .

# Build worker service
docker build -f Dockerfile.worker.gcp -t gcr.io/$PROJECT_ID/aerolead-worker:latest .

# Configure Docker for GCR
gcloud auth configure-docker

# Push images to Google Container Registry
docker push gcr.io/$PROJECT_ID/aerolead-web:latest
docker push gcr.io/$PROJECT_ID/aerolead-worker:latest
```

**Alternative: Use Cloud Build**

Create `cloudbuild.yaml` in the project root:

```yaml
steps:
  # Build web service
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-f'
      - 'Autodialer-app/Dockerfile.gcp'
      - '-t'
      - 'gcr.io/$PROJECT_ID/aerolead-web:latest'
      - '-t'
      - 'gcr.io/$PROJECT_ID/aerolead-web:$COMMIT_SHA'
      - './Autodialer-app'

  # Build worker service
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-f'
      - 'Autodialer-app/Dockerfile.worker.gcp'
      - '-t'
      - 'gcr.io/$PROJECT_ID/aerolead-worker:latest'
      - '-t'
      - 'gcr.io/$PROJECT_ID/aerolead-worker:$COMMIT_SHA'
      - './Autodialer-app'

  # Push web image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/aerolead-web:latest']

  # Push worker image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/aerolead-worker:latest']

images:
  - 'gcr.io/$PROJECT_ID/aerolead-web:latest'
  - 'gcr.io/$PROJECT_ID/aerolead-web:$COMMIT_SHA'
  - 'gcr.io/$PROJECT_ID/aerolead-worker:latest'
  - 'gcr.io/$PROJECT_ID/aerolead-worker:$COMMIT_SHA'

timeout: 1800s
```

Then build using Cloud Build:

```bash
# Trigger build
gcloud builds submit --config=cloudbuild.yaml .

# View build logs
gcloud builds list
gcloud builds log <BUILD_ID>
```

#### 6. Deploy Web Service

```bash
# Get Cloud SQL connection name
export SQL_CONNECTION=$(gcloud sql instances describe aerolead-db --format="value(connectionName)")

# Get Redis host
export REDIS_HOST=$(gcloud redis instances describe aerolead-redis --region=$REGION --format="value(host)")

# Deploy web service
gcloud run deploy aerolead-web \
  --image=gcr.io/$PROJECT_ID/aerolead-web:latest \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=2Gi \
  --cpu=2 \
  --min-instances=1 \
  --max-instances=10 \
  --set-env-vars="RAILS_ENV=production,PORT=8080,RAILS_LOG_TO_STDOUT=true,RAILS_SERVE_STATIC_FILES=true" \
  --set-env-vars="REDIS_URL=redis://$REDIS_HOST:6379/0" \
  --set-cloudsql-instances=$SQL_CONNECTION \
  --set-secrets="TWILIO_ACCOUNT_SID=twilio-account-sid:latest,TWILIO_AUTH_TOKEN=twilio-auth-token:latest,GEMINI_API_KEY=gemini-api-key:latest,SECRET_KEY_BASE=rails-secret-key-base:latest" \
  --set-env-vars="DATABASE_URL=postgresql://aerolead:YOUR_DB_PASSWORD@/$aerolead_production?host=/cloudsql/$SQL_CONNECTION"

# Get service URL
gcloud run services describe aerolead-web --region=$REGION --format="value(status.url)"
```

#### 7. Deploy Worker Service

```bash
# Deploy worker service
gcloud run deploy aerolead-worker \
  --image=gcr.io/$PROJECT_ID/aerolead-worker:latest \
  --region=$REGION \
  --platform=managed \
  --no-allow-unauthenticated \
  --port=8080 \
  --memory=4Gi \
  --cpu=2 \
  --min-instances=1 \
  --max-instances=3 \
  --set-env-vars="RAILS_ENV=production,PORT=8080,LINKEDIN_SCRAPER_PATH=/app/lib/linkedin_scraper" \
  --set-env-vars="REDIS_URL=redis://$REDIS_HOST:6379/0" \
  --set-cloudsql-instances=$SQL_CONNECTION \
  --set-secrets="GEMINI_API_KEY=gemini-api-key:latest,LINKEDIN_EMAIL=linkedin-email:latest,LINKEDIN_PASSWORD=linkedin-password:latest,SECRET_KEY_BASE=rails-secret-key-base:latest" \
  --set-env-vars="DATABASE_URL=postgresql://aerolead:YOUR_DB_PASSWORD@/$aerolead_production?host=/cloudsql/$SQL_CONNECTION"
```

#### 8. Run Database Migrations

```bash
# Connect to Cloud SQL via proxy
cloud_sql_proxy -instances=$SQL_CONNECTION=tcp:5432 &

# Run migrations
cd Autodialer-app
DATABASE_URL="postgresql://aerolead:YOUR_DB_PASSWORD@localhost:5432/aerolead_production" \
  bundle exec rails db:migrate

# Or run migration job on Cloud Run
gcloud run jobs create aerolead-migrate \
  --image=gcr.io/$PROJECT_ID/aerolead-web:latest \
  --region=$REGION \
  --set-cloudsql-instances=$SQL_CONNECTION \
  --set-env-vars="DATABASE_URL=postgresql://aerolead:YOUR_DB_PASSWORD@/$aerolead_production?host=/cloudsql/$SQL_CONNECTION" \
  --set-env-vars="RAILS_ENV=production" \
  --set-secrets="SECRET_KEY_BASE=rails-secret-key-base:latest" \
  --command="bundle" \
  --args="exec,rails,db:migrate"

# Execute migration job
gcloud run jobs execute aerolead-migrate --region=$REGION
```

### Update Deployment

```bash
# Rebuild images
docker build -f Dockerfile.gcp -t gcr.io/$PROJECT_ID/aerolead-web:latest ./Autodialer-app
docker build -f Dockerfile.worker.gcp -t gcr.io/$PROJECT_ID/aerolead-worker:latest ./Autodialer-app

# Push new images
docker push gcr.io/$PROJECT_ID/aerolead-web:latest
docker push gcr.io/$PROJECT_ID/aerolead-worker:latest

# Deploy updates (Cloud Run auto-pulls latest)
gcloud run deploy aerolead-web --image=gcr.io/$PROJECT_ID/aerolead-web:latest --region=$REGION
gcloud run deploy aerolead-worker --image=gcr.io/$PROJECT_ID/aerolead-worker:latest --region=$REGION

# Run migrations if needed
gcloud run jobs execute aerolead-migrate --region=$REGION
```

---

## Render.com Deployment

Simpler deployment option with automatic builds from Git.

### 1. Create render.yaml

Create `render.yaml` in the project root:

```yaml
services:
  # Web Service (Rails + Puma)
  - type: web
    name: aerolead-web
    runtime: ruby
    rootDir: ./Autodialer-app
    buildCommand: bundle install && bundle exec rails assets:precompile
    startCommand: ./bin/start-web.sh
    plan: free
    region: oregon
    envVars:
      - key: RAILS_ENV
        value: production
      - key: RAILS_MASTER_KEY
        sync: false
      - key: SECRET_KEY_BASE
        generateValue: true
      - key: TWILIO_ACCOUNT_SID
        sync: false
      - key: TWILIO_AUTH_TOKEN
        sync: false
      - key: TWILIO_PHONE_NUMBER
        sync: false
      - key: GEMINI_API_KEY
        sync: false
      - key: DATABASE_URL
        fromDatabase:
          name: aerolead-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          type: redis
          name: aerolead-redis
          property: connectionString

  # Worker Service (Sidekiq)
  - type: worker
    name: aerolead-worker
    runtime: ruby
    rootDir: ./Autodialer-app
    buildCommand: |
      bundle install &&
      cd lib/linkedin_scraper &&
      npm install &&
      npx puppeteer browsers install chrome
    startCommand: bundle exec sidekiq -C config/sidekiq.yml
    plan: free
    region: oregon
    envVars:
      - key: RAILS_ENV
        value: production
      - key: RAILS_MASTER_KEY
        sync: false
      - key: GEMINI_API_KEY
        sync: false
      - key: LINKEDIN_EMAIL
        sync: false
      - key: LINKEDIN_PASSWORD
        sync: false
      - key: LINKEDIN_SCRAPER_PATH
        value: lib/linkedin_scraper
      - key: DATABASE_URL
        fromDatabase:
          name: aerolead-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          type: redis
          name: aerolead-redis
          property: connectionString

databases:
  - name: aerolead-db
    databaseName: aerolead_production
    plan: free
    region: oregon

  - name: aerolead-redis
    plan: free
    region: oregon
    maxmemoryPolicy: allkeys-lru
```

### 2. Deploy to Render

#### Option A: Via Render Dashboard

1. Go to https://dashboard.render.com
2. Click "New" → "Blueprint"
3. Connect your GitHub repository
4. Select branch (e.g., `main`)
5. Render will detect `render.yaml` and create all services
6. Add environment variables in dashboard
7. Deploy

#### Option B: Via Render CLI

```bash
# Install Render CLI
npm install -g @render/cli

# Login
render login

# Deploy blueprint
render blueprint launch

# View services
render services list

# View logs
render logs -s aerolead-web
render logs -s aerolead-worker
```

### 3. Run Database Migrations on Render

```bash
# Via Render Dashboard Shell
# 1. Go to your web service in dashboard
# 2. Click "Shell"
# 3. Run:
bundle exec rails db:migrate

# Or create a manual job in render.yaml:
# Add this to render.yaml:
# - type: job
#   name: migrate
#   runtime: ruby
#   rootDir: ./Autodialer-app
#   startCommand: bundle exec rails db:migrate
```

### Update Deployment on Render

```bash
# Push to GitHub
git add .
git commit -m "Update application"
git push origin main

# Render auto-deploys on push
# Or manually trigger via dashboard
```

---

## Database Migrations

### Development/Local

```bash
cd Autodialer-app

# Create migration
bundle exec rails generate migration AddColumnToTable column:type

# Run migrations
bundle exec rails db:migrate

# Rollback
bundle exec rails db:rollback

# Check status
bundle exec rails db:migrate:status
```

### Production - GCP

#### Method 1: Cloud Run Job (Recommended)

```bash
# Create migration job (one-time setup)
gcloud run jobs create aerolead-migrate \
  --image=gcr.io/$PROJECT_ID/aerolead-web:latest \
  --region=$REGION \
  --set-cloudsql-instances=$SQL_CONNECTION \
  --set-env-vars="DATABASE_URL=postgresql://aerolead:PASSWORD@/aerolead_production?host=/cloudsql/$SQL_CONNECTION" \
  --set-env-vars="RAILS_ENV=production" \
  --set-secrets="SECRET_KEY_BASE=rails-secret-key-base:latest" \
  --command="bundle" \
  --args="exec,rails,db:migrate"

# Run migration
gcloud run jobs execute aerolead-migrate --region=$REGION --wait

# View logs
gcloud run jobs executions list --job=aerolead-migrate --region=$REGION
```

#### Method 2: Cloud SQL Proxy

```bash
# Start proxy
cloud_sql_proxy -instances=$SQL_CONNECTION=tcp:5432 &

# Run migration
cd Autodialer-app
DATABASE_URL="postgresql://aerolead:PASSWORD@localhost:5432/aerolead_production" \
  RAILS_ENV=production \
  bundle exec rails db:migrate

# Stop proxy
killall cloud_sql_proxy
```

#### Method 3: Via Cloud Run Shell (One-off)

```bash
# Get a shell on the running web service
gcloud run services proxy aerolead-web --region=$REGION &

# SSH into container (if enabled)
# Then run:
bundle exec rails db:migrate
```

#### Method 1: Dashboard Shell

1. Go to Render Dashboard
2. Select `aerolead-web` service
3. Click "Shell" tab
4. Run: `bundle exec rails db:migrate`

#### Method 2: One-off Job

```bash
# Via Render CLI
render run -s aerolead-web "bundle exec rails db:migrate"
```

#### Method 3: Automatic on Deploy

Add to `render.yaml`:

```yaml
services:
  - type: web
    name: aerolead-web
    # ... other config ...
    preDeployCommand: bundle exec rails db:migrate
```

### Migration Best Practices

1. **Always backup before migrating:**
```bash
# GCP
gcloud sql backups create --instance=aerolead-db

# Local
pg_dump -h localhost -U aerolead aerolead_production > backup.sql
```

2. **Test migrations locally first:**
```bash
# Run on local database
bundle exec rails db:migrate

# Check for issues
bundle exec rails db:migrate:status
```

3. **Use reversible migrations:**
```ruby
class AddIndexToUsers < ActiveRecord::Migration[7.1]
  def change
    add_index :users, :email, unique: true
  end

  # Or explicitly define up/down
  def up
    add_column :users, :name, :string
  end

  def down
    remove_column :users, :name
  end
end
```

4. **Monitor migration progress:**
```bash
# View real-time logs during migration
gcloud run jobs executions describe EXECUTION_NAME --region=$REGION
```

---

## Health Checks

### Web Service Health Check

```bash
# Check web service
curl https://your-service-url/health

# Expected response:
# {"status":"ok","timestamp":"2024-11-01T12:00:00Z"}
```

### Worker Health Check

The worker service runs a separate health server (see `health_server.rb`):

```ruby
# Autodialer-app/health_server.rb
require 'socket'

server = TCPServer.new('0.0.0.0', 8080)
puts "Health server listening on port 8080"

loop do
  client = server.accept
  client.puts "HTTP/1.1 200 OK\r\n"
  client.puts "Content-Type: text/plain\r\n"
  client.puts "\r\n"
  client.puts "OK"
  client.close
end
```

Test locally:
```bash
curl http://localhost:8080
# Response: OK
```

### Database Health Check

```bash
# GCP
gcloud sql instances describe aerolead-db --format="value(state)"
# Expected: RUNNABLE

# Connect and test
psql "postgresql://aerolead:PASSWORD@/aerolead_production?host=/cloudsql/$SQL_CONNECTION"
\dt  # List tables
```

### Redis Health Check

```bash
# GCP
gcloud redis instances describe aerolead-redis --region=$REGION --format="value(state)"
# Expected: READY

# Test connection (from Cloud Shell or VM in same VPC)
redis-cli -h REDIS_HOST ping
# Expected: PONG
```

---

## Troubleshooting

### Common Issues

#### 1. Build Failures

**Issue:** Docker build fails for worker service

```bash
# Error: Puppeteer installation failed
# Solution: Ensure all Chrome dependencies are in Dockerfile
```

Check `Dockerfile.worker.gcp` has all required packages:
- `libnss3`, `libatk1.0-0`, `libxcomposite1`, etc.

**Issue:** Assets precompilation fails

```bash
# Error: Webpacker can't find module
# Solution: Ensure node_modules are installed
```

Add to Dockerfile:
```dockerfile
RUN npm install
RUN bundle exec rails assets:precompile
```

#### 2. Deployment Failures

**Issue:** Cloud Run deployment timeout

```bash
# Increase timeout
gcloud run deploy aerolead-web \
  --timeout=300s \
  # ... other args
```

**Issue:** Container crashes immediately

```bash
# View logs
gcloud run services logs read aerolead-web --region=$REGION --limit=50

# Common causes:
# - Missing environment variables
# - Database connection issues
# - Port mismatch (ensure PORT=8080)
```

#### 3. Database Connection Issues

**Issue:** Can't connect to Cloud SQL

```bash
# Check Cloud SQL instance is running
gcloud sql instances describe aerolead-db

# Verify connection string format
# Correct: postgresql://user:pass@/db?host=/cloudsql/CONNECTION_NAME
# Wrong: postgresql://user:pass@localhost/db
```

**Issue:** SSL/TLS errors

```bash
# Add SSL mode to DATABASE_URL
DATABASE_URL="postgresql://...?sslmode=disable"
```

#### 4. Worker Issues

**Issue:** Sidekiq not processing jobs

```bash
# Check Redis connection
# In Rails console:
redis = Redis.new(url: ENV['REDIS_URL'])
redis.ping  # Should return "PONG"

# Check Sidekiq queues
Sidekiq::Queue.all.map { |q| [q.name, q.size] }
```

**Issue:** LinkedIn scraper fails with "Browser not found"

```bash
# Ensure Chromium is installed in worker container
# Check Dockerfile.worker.gcp line 59:
npx puppeteer browsers install chrome

# Or manually in container:
npx puppeteer browsers install chrome --path /root/.cache/puppeteer
```

#### 5. Memory Issues

**Issue:** Cloud Run service crashes with OOM (Out of Memory)

```bash
# Increase memory allocation
gcloud run services update aerolead-worker \
  --memory=4Gi \
  --region=$REGION

# Or reduce Sidekiq concurrency in config/sidekiq.yml:
production:
  :concurrency: 5  # Reduce from 10
```

### Useful Commands

```bash
# View Cloud Run logs (last 50 lines)
gcloud run services logs read aerolead-web --region=$REGION --limit=50

# Stream logs in real-time
gcloud run services logs tail aerolead-web --region=$REGION

# Get service details
gcloud run services describe aerolead-web --region=$REGION

# List all revisions
gcloud run revisions list --service=aerolead-web --region=$REGION

# Rollback to previous revision
gcloud run services update-traffic aerolead-web \
  --to-revisions=REVISION_NAME=100 \
  --region=$REGION

# Connect to Cloud SQL
gcloud sql connect aerolead-db --user=aerolead

# View environment variables
gcloud run services describe aerolead-web --region=$REGION --format="value(spec.template.spec.containers[0].env)"
```

---

## Continuous Deployment

### Setup GitHub Actions for GCP

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GCP

on:
  push:
    branches: [main]

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  REGION: us-central1

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v1

      - name: Configure Docker
        run: gcloud auth configure-docker

      - name: Build and Push Images
        run: |
          docker build -f Autodialer-app/Dockerfile.gcp \
            -t gcr.io/$PROJECT_ID/aerolead-web:${{ github.sha }} \
            -t gcr.io/$PROJECT_ID/aerolead-web:latest \
            ./Autodialer-app

          docker build -f Autodialer-app/Dockerfile.worker.gcp \
            -t gcr.io/$PROJECT_ID/aerolead-worker:${{ github.sha }} \
            -t gcr.io/$PROJECT_ID/aerolead-worker:latest \
            ./Autodialer-app

          docker push gcr.io/$PROJECT_ID/aerolead-web:latest
          docker push gcr.io/$PROJECT_ID/aerolead-worker:latest

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy aerolead-web \
            --image=gcr.io/$PROJECT_ID/aerolead-web:latest \
            --region=$REGION \
            --platform=managed

          gcloud run deploy aerolead-worker \
            --image=gcr.io/$PROJECT_ID/aerolead-worker:latest \
            --region=$REGION \
            --platform=managed

      - name: Run Migrations
        run: |
          gcloud run jobs execute aerolead-migrate \
            --region=$REGION \
            --wait
```

---

## Summary

### Quick Reference

| Task | Command |
|------|---------|
| Build web image | `docker build -f Dockerfile.gcp -t aerolead-web .` |
| Build worker image | `docker build -f Dockerfile.worker.gcp -t aerolead-worker .` |
| Push to GCR | `docker push gcr.io/$PROJECT_ID/aerolead-web:latest` |
| Deploy web (GCP) | `gcloud run deploy aerolead-web --image=... --region=$REGION` |
| Deploy worker (GCP) | `gcloud run deploy aerolead-worker --image=... --region=$REGION` |
| Run migrations (GCP) | `gcloud run jobs execute aerolead-migrate --region=$REGION` |
| View logs (GCP) | `gcloud run services logs tail aerolead-web --region=$REGION` |
| Deploy to Render | `git push origin main` (auto-deploy) |
| Run migrations (Render) | Dashboard → Shell → `bundle exec rails db:migrate` |

---

**For more information, see:**
- [Main README](./README.md)
- [Application Documentation](./Autodialer-app/README.md)
- [Google Cloud Run Docs](https://cloud.google.com/run/docs)
- [Render Docs](https://render.com/docs)
