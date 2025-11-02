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

  # Blog routes - /blog paths only
  get '/blog', to: 'blog_posts#index', as: 'blog'
  get '/blog/generate/new', to: 'blog_posts#generate_new', as: 'generate_new_blog'
  post '/blog/generate', to: 'blog_posts#generate', as: 'generate_blog'
  post '/blog/bulk_generate', to: 'blog_posts#bulk_generate', as: 'bulk_generate_blog'
  get '/blog/new', to: 'blog_posts#new', as: 'new_blog'
  post '/blog', to: 'blog_posts#create', as: 'create_blog'
  get '/blog/:id', to: 'blog_posts#show', as: 'show_blog', constraints: { id: /[^\/]+/ }
  get '/blog/:id/edit', to: 'blog_posts#edit', as: 'edit_blog'
  patch '/blog/:id', to: 'blog_posts#update', as: 'update_blog'
  delete '/blog/:id', to: 'blog_posts#destroy', as: 'destroy_blog'
  post '/blog/:id/publish', to: 'blog_posts#publish', as: 'publish_blog'
  post '/blog/:id/unpublish', to: 'blog_posts#unpublish', as: 'unpublish_blog'

  # Legacy /blog_posts paths - redirect to /blog
  get '/blog_posts', to: redirect('/blog')
  get '/blog_posts/generate_new', to: redirect('/blog/generate/new')
  post '/blog_posts/generate', to: redirect('/blog/generate')
  post '/blog_posts/bulk_generate', to: redirect('/blog/bulk_generate')
  get '/blog_posts/new', to: redirect('/blog/new')
  post '/blog_posts', to: redirect('/blog')
  get '/blog_posts/:slug', to: redirect { |params, request| "/blog/#{params[:slug]}" }
  get '/blog_posts/:slug/edit', to: redirect { |params, request| "/blog/#{params[:slug]}/edit" }
  patch '/blog_posts/:slug', to: redirect { |params, request| "/blog/#{params[:slug]}" }
  delete '/blog_posts/:slug', to: redirect { |params, request| "/blog/#{params[:slug]}" }
  post '/blog_posts/:slug/publish', to: redirect { |params, request| "/blog/#{params[:slug]}/publish" }
  post '/blog_posts/:slug/unpublish', to: redirect { |params, request| "/blog/#{params[:slug]}/unpublish" }

  # LinkedIn profiles routes
  resources :linkedin_profiles, only: [:index, :new, :create, :show, :destroy] do
    collection do
      post :upload_csv
      post :bulk_create
    end
    member do
      post :retry_scraping
    end
  end

  # LinkedIn analytics
  get '/linkedin_profiles/analytics', to: 'linkedin_profiles#analytics', as: 'linkedin_profiles_analytics'

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
