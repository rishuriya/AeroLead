# frozen_string_literal: true

module Api
  module V1
    class PhoneCallsController < BaseController
      before_action :set_phone_call, only: [:show, :destroy]

      # GET /api/v1/phone_calls
      def index
        @phone_calls = PhoneCall.order(created_at: :desc)

        # Apply filters
        @phone_calls = @phone_calls.where(status: params[:status]) if params[:status].present?

        @phone_calls = paginate(@phone_calls)

        render json: {
          phone_calls: @phone_calls.map { |call| phone_call_json(call) },
          meta: pagination_meta(@phone_calls),
          analytics: PhoneCall.analytics
        }
      end

      # GET /api/v1/phone_calls/:id
      def show
        render json: phone_call_json(@phone_call)
      end

      # POST /api/v1/phone_calls
      def create
        @phone_call = PhoneCall.new(phone_call_params)

        if @phone_call.save
          render json: phone_call_json(@phone_call), status: :created
        else
          render json: {
            error: 'Failed to create phone call',
            details: @phone_call.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/phone_calls/bulk_create
      def bulk_create
        phone_numbers = params[:phone_numbers]
        message = params[:message].presence || "This is an automated call."

        if phone_numbers.blank? || !phone_numbers.is_a?(Array)
          render json: { error: 'phone_numbers must be an array' }, status: :bad_request
          return
        end

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
            errors << { phone_number: number, errors: phone_call.errors.full_messages }
          end
        end

        render json: {
          success: true,
          created: created_calls.count,
          failed: errors.count,
          phone_calls: created_calls.map { |call| phone_call_json(call) },
          errors: errors
        }, status: :created
      end

      # DELETE /api/v1/phone_calls/:id
      def destroy
        if @phone_call.pending?
          @phone_call.update(status: 'canceled')
          render json: { success: true, message: 'Call canceled' }
        else
          render json: { error: 'Can only cancel pending calls' }, status: :unprocessable_entity
        end
      end

      private

      def set_phone_call
        @phone_call = PhoneCall.find(params[:id])
      end

      def phone_call_params
        params.require(:phone_call).permit(:phone_number, :message, :status)
      end

      def phone_call_json(call)
        {
          id: call.id,
          phone_number: call.phone_number,
          message: call.message,
          status: call.status,
          call_sid: call.call_sid,
          duration: call.duration,
          called_at: call.called_at,
          error_message: call.error_message,
          created_at: call.created_at,
          updated_at: call.updated_at
        }
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
