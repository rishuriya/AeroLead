FactoryBot.define do
  factory :linkedin_profile do
    profile_url { "MyString" }
    name { "MyString" }
    headline { "MyString" }
    location { "MyString" }
    about { "MyText" }
    current_company { "MyString" }
    current_position { "MyString" }
    all_experience { "" }
    education { "MyString" }
    all_education { "" }
    top_skills { "MyText" }
    all_skills { "MyText" }
    skills_count { 1 }
    email { "MyString" }
    phone { "MyString" }
    website { "MyString" }
    profile_image_url { "MyString" }
    connections { "MyString" }
    pronouns { "MyString" }
    status { "MyString" }
    scraped_at { "2025-11-01 13:40:18" }
    error_message { "MyText" }
  end
end
