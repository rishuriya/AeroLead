# frozen_string_literal: true

# Ensure services directory is added to autoload paths
Rails.application.config.after_initialize do
  Rails.autoloaders.main.push_dir(Rails.root.join('app', 'services')) if defined?(Rails::Autoloaders)
end

# Also explicitly require in case autoloader doesn't catch it
Rails.application.config.to_prepare do
  services_dir = Rails.root.join('app', 'services')
  if services_dir.exist?
    Dir[services_dir.join('*.rb')].each do |file|
      require_dependency file.to_s
    end
  end
end

