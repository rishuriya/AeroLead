# frozen_string_literal: true

class AutodialerController < ApplicationController
  def index
    @page_title = "Autodialer - Make Calls"
    @phone_calls = PhoneCall.recent.page(params[:page]).per(20)
    @analytics = PhoneCall.analytics
  end

  def start_calling
    phone_numbers_text = params[:phone_numbers]
    message = params[:message].presence || "This is an automated call."

    if phone_numbers_text.blank?
      flash[:alert] = "Please enter at least one phone number"
      redirect_to autodialer_index_path and return
    end

    # Parse phone numbers (one per line)
    phone_numbers = phone_numbers_text.split("\n")
                                      .map(&:strip)
                                      .reject(&:blank?)
                                      .uniq

    # Validate count
    max_numbers = ENV.fetch('MAX_PHONE_NUMBERS_PER_BATCH', 100).to_i
    if phone_numbers.length > max_numbers
      flash[:alert] = "Maximum #{max_numbers} phone numbers allowed per batch"
      redirect_to autodialer_index_path and return
    end

    # Create phone call records
    created_calls = []
    errors = []

    phone_numbers.each do |number|
      phone_call = PhoneCall.new(
        phone_number: number,
        message: message,
        status: 'queued'
      )

      if phone_call.save
        created_calls << phone_call
      else
        errors << "#{number}: #{phone_call.errors.full_messages.join(', ')}"
      end
    end

    # Show results
    if created_calls.any?
      flash[:notice] = "#{created_calls.count} call(s) queued successfully"
      flash[:alert] = "Errors: #{errors.join('; ')}" if errors.any?
    else
      flash[:alert] = "No calls were queued. Errors: #{errors.join('; ')}"
    end

    redirect_to autodialer_index_path
  end

  def upload_csv
    unless params[:csv_file].present?
      flash[:alert] = "Please select a CSV file"
      redirect_to autodialer_index_path and return
    end

    file = params[:csv_file]
    message = params[:message].presence || "This is an automated call."

    begin
      require 'csv'

      csv_data = CSV.parse(file.read, headers: true)
      phone_numbers = csv_data['phone_number'].compact.map(&:strip).uniq

      if phone_numbers.empty?
        flash[:alert] = "No phone numbers found in CSV. Ensure there's a 'phone_number' column."
        redirect_to autodialer_index_path and return
      end

      # Create phone calls
      created_calls = phone_numbers.map do |number|
        PhoneCall.create(
          phone_number: number,
          message: message,
          status: 'queued'
        )
      end.select(&:persisted?)

      flash[:notice] = "#{created_calls.count} call(s) queued from CSV"
    rescue CSV::MalformedCSVError => e
      flash[:alert] = "Invalid CSV file: #{e.message}"
    rescue StandardError => e
      flash[:alert] = "Error processing CSV: #{e.message}"
    end

    redirect_to autodialer_index_path
  end

  def logs
    @page_title = "Call Logs"

    @phone_calls = PhoneCall.order(created_at: :desc)

    # Apply filters
    if params[:status].present?
      @phone_calls = @phone_calls.where(status: params[:status])
    end

    if params[:date_from].present?
      @phone_calls = @phone_calls.where('created_at >= ?', params[:date_from])
    end

    if params[:date_to].present?
      @phone_calls = @phone_calls.where('created_at <= ?', params[:date_to])
    end

    if params[:search].present?
      @phone_calls = @phone_calls.where('phone_number LIKE ?', "%#{params[:search]}%")
    end

    @phone_calls = @phone_calls.page(params[:page]).per(50)

    # Calculate statistics for the filtered results
    all_calls = PhoneCall.all
    all_calls = all_calls.where(status: params[:status]) if params[:status].present?
    all_calls = all_calls.where('created_at >= ?', params[:date_from]) if params[:date_from].present?
    all_calls = all_calls.where('created_at <= ?', params[:date_to]) if params[:date_to].present?
    all_calls = all_calls.where('phone_number LIKE ?', "%#{params[:search]}%") if params[:search].present?

    @stats = {
      total: all_calls.count,
      successful: all_calls.where(status: 'completed').count,
      failed: all_calls.where(status: 'failed').count,
      pending: all_calls.where(status: ['queued', 'ringing', 'in-progress']).count
    }
  rescue StandardError => e
    Rails.logger.error "Logs Error: #{e.message}"
    flash[:alert] = "Error loading call logs"
    redirect_to autodialer_index_path
  end

  def refresh_status
    phone_call = PhoneCall.find(params[:phone_call_id] || params[:id])
    new_status = phone_call.refresh_status!

    if new_status
      flash[:notice] = "Call status updated to: #{new_status}"
    else
      flash[:alert] = "Could not refresh call status"
    end

    redirect_to autodialer_logs_path
  end

  def analytics
    @page_title = "Analytics Dashboard"

    # Get call analytics
    base_analytics = PhoneCall.analytics
    total = base_analytics[:total]
    failure_rate = 0
    if total > 0 && base_analytics[:failed] > 0
      failure_rate = (base_analytics[:failed].to_f / total * 100).round(2)
    end

    @call_analytics = {
      total_calls: total,
      successful_calls: base_analytics[:successful],
      failed_calls: base_analytics[:failed],
      pending_calls: base_analytics[:pending],
      success_rate: base_analytics[:success_rate],
      failure_rate: failure_rate,
      total_duration: base_analytics[:total_duration],
      avg_duration: base_analytics[:average_duration],
      max_duration: PhoneCall.where.not(duration: nil).maximum(:duration) || 0,
      min_duration: PhoneCall.where.not(duration: nil).minimum(:duration) || 0,
      today_calls: PhoneCall.today.count,
      by_status: PhoneCall.group(:status).count,
      daily_trend: PhoneCall.where('created_at >= ?', 7.days.ago)
                           .group("DATE(created_at)")
                           .count
                           .transform_keys { |k| k.strftime('%m/%d') }
    }

    # Get blog analytics
    blog_stats = BlogPost.statistics
    @blog_analytics = {
      total: blog_stats[:total],
      published: blog_stats[:published],
      draft: blog_stats[:draft],
      archived: blog_stats[:archived],
      by_ai_model: blog_stats[:by_ai_model],
      today_count: BlogPost.where('created_at >= ?', Time.zone.now.beginning_of_day).count,
      weekly_trend: BlogPost.where('created_at >= ?', 7.days.ago)
                            .group("DATE(created_at)")
                            .count
                            .transform_keys { |k| k.strftime('%m/%d') }
    }

    # Dashboard stats from home controller
    @phone_call_stats = base_analytics
    @recent_calls = PhoneCall.recent.limit(5)
    @recent_blogs = BlogPost.published.recent.limit(5)
    @calls_today = PhoneCall.today.count
    @blogs_today = @blog_analytics[:today_count]

    # Recent failed calls
    @recent_failed_calls = PhoneCall.where(status: 'failed')
                                    .order(updated_at: :desc)
                                    .limit(10)
  rescue StandardError => e
    Rails.logger.error "Analytics Error: #{e.message}"
    flash[:alert] = "Error loading analytics data"
    redirect_to autodialer_index_path
  end
end
