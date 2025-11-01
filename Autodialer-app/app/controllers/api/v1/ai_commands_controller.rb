# frozen_string_literal: true

module Api
  module V1
    class AiCommandsController < BaseController
      # POST /api/v1/ai/command
      def execute
        command = params[:command]

        if command.blank?
          render json: { error: 'Command cannot be blank' }, status: :bad_request
          return
        end

        ai_model = params[:ai_model] || ENV.fetch('DEFAULT_AI_MODEL', 'gemini')

        parser = ::AICommandParser.new(model: ai_model)
        result = parser.execute(command)

        if result[:success]
          render json: result
        else
          render json: result, status: :unprocessable_entity
        end
      rescue StandardError => e
        Rails.logger.error "AI Command API Error: #{e.message}"
        render json: { error: e.message, success: false }, status: :internal_server_error
      end
    end
  end
end
