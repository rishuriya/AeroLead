# frozen_string_literal: true

module Api
  module V1
    class BaseController < ActionController::API
      rescue_from ActiveRecord::RecordNotFound, with: :record_not_found
      rescue_from ActiveRecord::RecordInvalid, with: :record_invalid
      rescue_from ActionController::ParameterMissing, with: :parameter_missing

      private

      def record_not_found
        render json: { error: 'Record not found' }, status: :not_found
      end

      def record_invalid(exception)
        render json: {
          error: 'Validation failed',
          details: exception.record.errors.full_messages
        }, status: :unprocessable_entity
      end

      def parameter_missing(exception)
        render json: {
          error: 'Parameter missing',
          parameter: exception.param
        }, status: :bad_request
      end

      def paginate(collection)
        page = params[:page] || 1
        per_page = params[:per_page] || 20
        per_page = 100 if per_page.to_i > 100 # Max 100 per page

        collection.page(page).per(per_page)
      end
    end
  end
end
