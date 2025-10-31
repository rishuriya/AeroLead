# frozen_string_literal: true

class HomeController < ApplicationController
  def index
    @page_title = "Dashboard - Autodialer & AI Blog Generator"

    # Get statistics for dashboard
    @phone_call_stats = PhoneCall.analytics
    @blog_stats = BlogPost.statistics

    # Recent activity
    @recent_calls = PhoneCall.recent.limit(5)
    @recent_blogs = BlogPost.published.recent.limit(5)

    # Today's activity
    @calls_today = PhoneCall.today.count
    @blogs_today = BlogPost.where('created_at >= ?', Time.zone.now.beginning_of_day).count
  end
end
