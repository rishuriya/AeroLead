# frozen_string_literal: true

class ApplicationController < ActionController::Base
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  # allow_browser versions: :modern

  before_action :set_locale

  helper_method :current_user

  rescue_from ActiveRecord::RecordNotFound, with: :record_not_found
  rescue_from ActionController::ParameterMissing, with: :parameter_missing

  private

  def set_locale
    I18n.locale = params[:locale] || I18n.default_locale
  end

  def current_user
    # Placeholder for authentication - implement with Devise or similar
    @current_user ||= User.first if defined?(User)
  end

  def record_not_found
    flash[:alert] = "The requested record was not found."
    redirect_to root_path
  end

  def parameter_missing(exception)
    flash[:alert] = "Required parameter missing: #{exception.param}"
    redirect_back fallback_location: root_path
  end

  def set_default_meta_tags
    @page_title ||= "Autodialer with AI Blog Generator"
    @page_description ||= "Automated phone calling system with AI-powered blog content generation"
  end
end
