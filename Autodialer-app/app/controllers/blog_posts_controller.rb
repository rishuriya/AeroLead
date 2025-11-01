# frozen_string_literal: true

class BlogPostsController < ApplicationController
  before_action :set_blog_post, only: [:show, :edit, :update, :destroy, :publish, :unpublish]

  def index
    @page_title = "Blog Posts"

    @blog_posts = BlogPost.order(created_at: :desc)

    # Apply filters
    @blog_posts = @blog_posts.where(status: params[:status]) if params[:status].present?
    @blog_posts = @blog_posts.by_ai_model(params[:ai_model]) if params[:ai_model].present?
    @blog_posts = @blog_posts.search(params[:search]) if params[:search].present?

    @blog_posts = @blog_posts.page(params[:page]).per(20)

    @statistics = BlogPost.statistics
  end

  def show
    @page_title = @blog_post.title
  end

  def new
    @page_title = "New Blog Post"
    @blog_post = BlogPost.new
  end

  def create
    @blog_post = BlogPost.new(blog_post_params)

    if @blog_post.save
      flash[:notice] = "Blog post created successfully"
      redirect_to @blog_post
    else
      flash.now[:alert] = "Error creating blog post"
      render :new, status: :unprocessable_entity
    end
  end

  def edit
    @page_title = "Edit: #{@blog_post.title}"
  end

  def update
    if @blog_post.update(blog_post_params)
      flash[:notice] = "Blog post updated successfully"
      redirect_to @blog_post
    else
      flash.now[:alert] = "Error updating blog post"
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @blog_post.destroy
    flash[:notice] = "Blog post deleted successfully"
    redirect_to blog_posts_path
  end

  def generate_new
    @page_title = "Generate Blog Posts with AI"
  end

  def generate
    titles = params[:titles]
    ai_model = 'gemini'  # Always use Gemini
    context = params[:context]
    word_count = params[:word_count].presence || 1000

    if titles.blank?
      flash[:alert] = "Please enter at least one blog title"
      redirect_to generate_new_blog_posts_path and return
    end

    # Parse titles (one per line)
    title_list = titles.split("\n").map(&:strip).reject(&:blank?).uniq

    # Validate count
    max_articles = ENV.fetch('MAX_BULK_ARTICLES', 20).to_i
    if title_list.length > max_articles
      flash[:alert] = "Maximum #{max_articles} articles allowed per batch"
      redirect_to generate_new_blog_posts_path and return
    end

    # Enqueue generation jobs with Gemini
    title_list.each do |title|
      BlogGenerationJob.perform_later(title, ai_model, context: context, word_count: word_count.to_i)
    end

    flash[:notice] = "#{title_list.count} blog post(s) queued for AI generation"
    redirect_to blog_posts_path
  end

  def bulk_generate
    # Alternative endpoint for API/programmatic bulk generation
    titles = params[:titles] || []
    ai_model = params[:ai_model] || 'gemini'

    if titles.empty?
      render json: { error: 'No titles provided' }, status: :unprocessable_entity
      return
    end

    titles.each do |title|
      BlogGenerationJob.perform_later(title, ai_model)
    end

    render json: {
      success: true,
      message: "#{titles.count} blog posts queued",
      count: titles.count
    }
  end

  def publish
    if @blog_post.publish!
      flash[:notice] = "Blog post published successfully"
    else
      flash[:alert] = "Error publishing blog post"
    end
    redirect_to @blog_post
  end

  def unpublish
    if @blog_post.unpublish!
      flash[:notice] = "Blog post unpublished"
    else
      flash[:alert] = "Error unpublishing blog post"
    end
    redirect_to @blog_post
  end

  private

  def set_blog_post
    @blog_post = BlogPost.find_by!(slug: params[:id])
  end

  def blog_post_params
    params.require(:blog_post).permit(:title, :content, :excerpt, :status, :ai_model)
  end
end
