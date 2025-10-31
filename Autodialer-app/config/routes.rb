Rails.application.routes.draw do
  # Root route
  root "home#index"

  # Autodialer routes
  resources :autodialer, only: [:index] do
    collection do
      post :start_calling
      post :upload_csv
      post :refresh_status
    end
  end

  # Separate routes for logs and analytics to get proper path helpers
  get '/autodialer/logs', to: 'autodialer#logs', as: 'autodialer_logs'
  get '/autodialer/analytics', to: 'autodialer#analytics', as: 'autodialer_analytics'

  # Blog posts routes
  resources :blog_posts do
    collection do
      get :generate_new
      post :generate
      post :bulk_generate
    end
    member do
      post :publish
      post :unpublish
    end
  end

  # AI Commands - explicit controller reference
  post '/ai/command', to: 'ai_commands#execute'
  post '/ai/parse', to: 'ai_commands#parse'

  # API routes
  namespace :api do
    namespace :v1 do
      # Phone calls API
      resources :phone_calls, only: [:index, :show, :create, :destroy] do
        collection do
          post :bulk_create
        end
      end

      # Blog posts API
      resources :blog_posts, param: :slug, only: [:index, :show, :create, :update, :destroy] do
        collection do
          post :generate
        end
      end

      # AI command API
      post '/ai/command', to: 'ai_commands#execute'
    end
  end

  # Twilio webhook endpoints
  post '/webhooks/twilio/status', to: 'webhooks/twilio#status_callback'
  post '/webhooks/twilio/voice', to: 'webhooks/twilio#voice_callback'

  # Health check
  get '/health', to: 'health#index'

  # Sidekiq Web UI (for monitoring background jobs)
  require 'sidekiq/web'
  mount Sidekiq::Web => '/sidekiq'
end
