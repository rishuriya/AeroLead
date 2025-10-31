# frozen_string_literal: true

class CreateBlogPosts < ActiveRecord::Migration[7.1]
  def change
    create_table :blog_posts do |t|
      t.string :title, null: false
      t.string :slug, null: false
      t.text :content, null: false
      t.text :excerpt
      t.string :ai_model
      t.string :status, default: 'draft', null: false
      t.datetime :published_at
      t.json :metadata

      t.timestamps
    end

    add_index :blog_posts, :slug, unique: true
    add_index :blog_posts, :status
    add_index :blog_posts, :published_at
    add_index :blog_posts, :ai_model
    add_index :blog_posts, :created_at
  end
end
