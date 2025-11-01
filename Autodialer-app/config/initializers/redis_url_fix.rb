# frozen_string_literal: true

# Fix Redis URL if Render provides it as PostgreSQL format
# Render's Redis databases sometimes provide connectionString in PostgreSQL format
# This converts it to proper Redis URL format

if ENV['REDIS_URL'].present? && ENV['REDIS_URL'].start_with?('postgresql://')
  # Parse the PostgreSQL-formatted connection string
  # Format: postgresql://user:password@host:port/database
  redis_url = ENV['REDIS_URL']
  
  # Extract components using URI parsing
  begin
    uri = URI.parse(redis_url)
    username = uri.user
    password = uri.password
    host = uri.host
    port = uri.port || 6379  # Default Redis port
    database_name = uri.path&.gsub('/', '') || '0'
    
    # Redis uses integer database numbers (0-15 typically)
    # If database_name is not a number, use 0 as default
    db_number = begin
      Integer(database_name)
    rescue ArgumentError
      0
    end
    
    # Construct proper Redis URL: redis://user:password@host:port/db
    fixed_redis_url = "redis://#{username}:#{password}@#{host}:#{port}/#{db_number}"
    
    # Set the corrected URL
    ENV['REDIS_URL'] = fixed_redis_url
    
    # Log the fix (without password)
    Rails.logger.info "Fixed Redis URL from PostgreSQL format to: redis://#{username}:***@#{host}:#{port}/#{db_number}"
  rescue => e
    Rails.logger.error "Failed to parse Redis URL: #{e.message}"
    # Fall back to default
    ENV['REDIS_URL'] = 'redis://localhost:6379/0'
  end
end

