# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.1].define(version: 2025_10_31_000002) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "blog_posts", force: :cascade do |t|
    t.string "title", null: false
    t.string "slug", null: false
    t.text "content", null: false
    t.text "excerpt"
    t.string "ai_model"
    t.string "status", default: "draft", null: false
    t.datetime "published_at"
    t.json "metadata"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["ai_model"], name: "index_blog_posts_on_ai_model"
    t.index ["created_at"], name: "index_blog_posts_on_created_at"
    t.index ["published_at"], name: "index_blog_posts_on_published_at"
    t.index ["slug"], name: "index_blog_posts_on_slug", unique: true
    t.index ["status"], name: "index_blog_posts_on_status"
  end

  create_table "phone_calls", force: :cascade do |t|
    t.string "phone_number", null: false
    t.string "call_sid"
    t.string "status", default: "queued", null: false
    t.integer "duration"
    t.text "message"
    t.datetime "called_at"
    t.text "error_message"
    t.integer "retry_count", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["call_sid"], name: "index_phone_calls_on_call_sid", unique: true
    t.index ["created_at"], name: "index_phone_calls_on_created_at"
    t.index ["phone_number"], name: "index_phone_calls_on_phone_number"
    t.index ["status"], name: "index_phone_calls_on_status"
  end

end
