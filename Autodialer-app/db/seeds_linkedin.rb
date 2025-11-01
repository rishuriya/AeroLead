# LinkedIn Profiles Seed Data
# Run with: rails runner db/seeds_linkedin.rb

puts "🔄 Seeding LinkedIn Profiles..."

# Sample LinkedIn profiles to test with
sample_profiles = [
  "https://linkedin.com/in/satyanadella/",
  "https://linkedin.com/in/jeffweiner08/",
  "https://linkedin.com/in/billgates/"
]

created_count = 0
skipped_count = 0

sample_profiles.each do |url|
  begin
    profile = LinkedinProfile.create!(profile_url: url)
    created_count += 1
    puts "✓ Added: #{url}"
  rescue ActiveRecord::RecordInvalid => e
    skipped_count += 1
    puts "⚠ Skipped (already exists): #{url}"
  end
end

puts "\n📊 Summary:"
puts "  Created: #{created_count} profiles"
puts "  Skipped: #{skipped_count} profiles"
puts "  Total: #{LinkedinProfile.count} profiles in database"
puts "\n✅ Done! Profiles are now queued for scraping."
puts "   Check status at: http://localhost:3000/linkedin_profiles"
