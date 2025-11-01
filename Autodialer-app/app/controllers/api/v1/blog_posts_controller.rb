# frozen_string_literal: true

module Api
  module V1
    class BlogPostsController < BaseController
      before_action :set_blog_post, only: [:show, :update, :destroy]

      # GET /api/v1/blog_posts
      def index
        @blog_posts = BlogPost.order(created_at: :desc)

        # Apply filters
        @blog_posts = @blog_posts.where(status: params[:status]) if params[:status].present?
        @blog_posts = @blog_posts.by_ai_model(params[:ai_model]) if params[:ai_model].present?

        @blog_posts = paginate(@blog_posts)

        render json: {
          blog_posts: @blog_posts.map { |post| blog_post_json(post) },
          meta: pagination_meta(@blog_posts),
          statistics: BlogPost.statistics
        }
      end

      # GET /api/v1/blog_posts/:slug
      def show
        render json: blog_post_json(@blog_post, include_content: true)
      end

      # POST /api/v1/blog_posts
      def create
        @blog_post = BlogPost.new(blog_post_params)

        if @blog_post.save
          render json: blog_post_json(@blog_post, include_content: true), status: :created
        else
          render json: {
            error: 'Failed to create blog post',
            details: @blog_post.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PUT /api/v1/blog_posts/:slug
      def update
        if @blog_post.update(blog_post_params)
          render json: blog_post_json(@blog_post, include_content: true)
        else
          render json: {
            error: 'Failed to update blog post',
            details: @blog_post.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/blog_posts/:slug
      def destroy
        @blog_post.destroy
        render json: { success: true, message: 'Blog post deleted' }
      end

      # POST /api/v1/blog_posts/generate
      def generate
        title = params[:title]
        ai_model = params[:ai_model] || ENV.fetch('DEFAULT_AI_MODEL', 'gemini')
        context = params[:context]
        word_count = params[:word_count].presence || 1000

        if title.blank?
          render json: { error: 'Title is required' }, status: :bad_request
          return
        end

        BlogGenerationJob.perform_later(title, ai_model, context: context, word_count: word_count.to_i)

        render json: {
          success: true,
          message: "Blog post generation started for: #{title}",
          ai_model: ai_model
        }, status: :accepted
      end

      private

      def set_blog_post
        @blog_post = BlogPost.find_by!(slug: params[:slug])
      end

      def blog_post_params
        params.require(:blog_post).permit(:title, :content, :excerpt, :status, :ai_model)
      end

      def blog_post_json(post, include_content: false)
        json = {
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          status: post.status,
          ai_model: post.ai_model,
          published_at: post.published_at,
          word_count: post.word_count,
          reading_time: post.reading_time,
          created_at: post.created_at,
          updated_at: post.updated_at
        }

        json[:content] = post.content if include_content

        json
      end

      def pagination_meta(collection)
        {
          current_page: collection.current_page,
          next_page: collection.next_page,
          prev_page: collection.prev_page,
          total_pages: collection.total_pages,
          total_count: collection.total_count
        }
      end
    end
  end
end
