class ConvertLinkedinProfilesToJSONFormat < ActiveRecord::Migration[7.1]
  def up
    # Convert existing Ruby hash format data to JSON format
    # Example: {"position" => "Founder"} needs to become {"position": "Founder"}
    
    require 'json'
    
    LinkedinProfile.where(status: 'completed').find_each do |profile|
      updated = false
      
      # Convert all_experience if it exists and is not valid JSON
      if profile.all_experience.present?
        begin
          JSON.parse(profile.all_experience.to_s)
          # Already valid JSON, skip
        rescue JSON::ParserError
          # Not valid JSON - convert Ruby hash format to JSON
          begin
            # Use eval to parse Ruby hash syntax, then convert to JSON
            ruby_hash = eval(profile.all_experience.to_s)
            if ruby_hash.is_a?(Array)
              profile.update_column(:all_experience, ruby_hash.to_json)
              updated = true
            end
          rescue => e
            Rails.logger.warn "Could not convert all_experience for profile #{profile.id}: #{e.message}"
          end
        end
      end
      
      # Convert all_education if it exists and is not valid JSON
      if profile.all_education.present?
        begin
          JSON.parse(profile.all_education.to_s)
          # Already valid JSON, skip
        rescue JSON::ParserError
          # Not valid JSON - convert Ruby hash format to JSON
          begin
            # Use eval to parse Ruby hash syntax, then convert to JSON
            ruby_hash = eval(profile.all_education.to_s)
            if ruby_hash.is_a?(Array)
              profile.update_column(:all_education, ruby_hash.to_json)
              updated = true
            end
          rescue => e
            Rails.logger.warn "Could not convert all_education for profile #{profile.id}: #{e.message}"
          end
        end
      end
      
      puts "Updated profile #{profile.id}: #{profile.profile_url}" if updated
    end
    
    puts "Migration completed: Converted Ruby hash format to JSON format"
  end

  def down
    # This migration cannot be safely reversed
    # Data will remain in JSON format
    puts "Note: This migration cannot be reversed. Data remains in JSON format."
  end
end
