# frozen_string_literal: true

module AutodialerHelper
  def status_color(status)
    case status.to_s.downcase
    when 'completed'
      '#198754' # green
    when 'failed'
      '#dc3545' # red
    when 'queued'
      '#6c757d' # gray
    when 'ringing'
      '#0dcaf0' # cyan
    when 'in-progress'
      '#0d6efd' # blue
    when 'busy'
      '#ffc107' # yellow
    when 'no-answer'
      '#6c757d' # gray
    when 'canceled'
      '#343a40' # dark
    else
      '#6c757d' # gray (default)
    end
  end
end
