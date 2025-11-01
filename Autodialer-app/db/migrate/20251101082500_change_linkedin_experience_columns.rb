class ChangeLinkedinExperienceColumns < ActiveRecord::Migration[7.1]
  def up
    # Change JSON columns to TEXT for better compatibility with serialized data
    change_column :linkedin_profiles, :all_experience, :text
    change_column :linkedin_profiles, :all_education, :text
  end

  def down
    # Revert back to JSON if needed
    change_column :linkedin_profiles, :all_experience, :json, default: []
    change_column :linkedin_profiles, :all_education, :json, default: []
  end
end
