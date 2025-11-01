class CreateLinkedinProfiles < ActiveRecord::Migration[7.1]
  def change
    create_table :linkedin_profiles do |t|
      t.string :profile_url, null: false
      t.string :name
      t.string :headline
      t.string :location
      t.text :about
      t.string :current_company
      t.string :current_position
      t.json :all_experience
      t.string :education
      t.json :all_education
      t.text :top_skills
      t.text :all_skills
      t.integer :skills_count, default: 0
      t.string :email
      t.string :phone
      t.string :website
      t.string :profile_image_url
      t.string :connections
      t.string :pronouns
      t.string :status, default: 'pending'
      t.datetime :scraped_at
      t.text :error_message

      t.timestamps
    end

    add_index :linkedin_profiles, :profile_url, unique: true
    add_index :linkedin_profiles, :status
    add_index :linkedin_profiles, :created_at
  end
end
