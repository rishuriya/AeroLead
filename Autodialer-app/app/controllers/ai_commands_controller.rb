# frozen_string_literal: true

class AICommandsController < ApplicationController
  skip_before_action :verify_authenticity_token, only: [:execute]

  def execute
    command = params[:command]

    if command.blank?
      render json: { error: 'Command cannot be blank', success: false }, status: :unprocessable_entity
      return
    end

    # Get AI model from params or use default
    ai_model = params[:ai_model] || ENV.fetch('DEFAULT_AI_MODEL', 'gemini')

    Rails.logger.info "Processing AI command: #{command} with model: #{ai_model}"

    # Parse and execute command
    parser = ::AICommandParser.new(model: ai_model)
    result = parser.execute(command)

    Rails.logger.info "AI Command result: #{result.inspect}"

    if result[:success]
      render json: result, status: :ok
    else
      render json: result, status: :unprocessable_entity
    end
  rescue StandardError => e
    Rails.logger.error "AI Command Error: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
    render json: { error: e.message, success: false }, status: :internal_server_error
  end

  def parse
    command = params[:command]

    if command.blank?
      render json: { error: 'Command cannot be blank' }, status: :unprocessable_entity
      return
    end

    ai_model = params[:ai_model] || ENV.fetch('DEFAULT_AI_MODEL', 'gemini')

    # Just parse, don't execute
    parser = ::AICommandParser.new(model: ai_model)
    result = parser.parse(command)

    render json: result
  rescue StandardError => e
    Rails.logger.error "AI Parse Error: #{e.message}"
    render json: { error: e.message }, status: :internal_server_error
  end
end
