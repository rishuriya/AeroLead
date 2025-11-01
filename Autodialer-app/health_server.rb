#!/usr/bin/env ruby
# Simple HTTP server for Cloud Run health checks

require 'socket'

port = ENV['PORT'] || 8080

server = TCPServer.new(port)
puts "Health check server listening on port #{port}"

loop do
  client = server.accept
  request = client.gets

  # Respond to all requests with HTTP 200 OK
  response = "HTTP/1.1 200 OK\r\n" \
             "Content-Type: text/plain\r\n" \
             "Content-Length: 2\r\n" \
             "\r\n" \
             "OK"

  client.puts response
  client.close
end
