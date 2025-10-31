# frozen_string_literal: true

class CreatePhoneCalls < ActiveRecord::Migration[7.1]
  def change
    create_table :phone_calls do |t|
      t.string :phone_number, null: false
      t.string :call_sid
      t.string :status, default: 'queued', null: false
      t.integer :duration
      t.text :message
      t.datetime :called_at
      t.text :error_message
      t.integer :retry_count, default: 0

      t.timestamps
    end

    add_index :phone_calls, :phone_number
    add_index :phone_calls, :call_sid, unique: true
    add_index :phone_calls, :status
    add_index :phone_calls, :created_at
  end
end
