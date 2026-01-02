#!/bin/sh
set -e

# Run migrations
echo "Running database migrations..."
# Simple retry logic for DB connection
MAX_RETRIES=30
count=0
while [ $count -lt $MAX_RETRIES ]; do
  # Use global prisma CLI directly
  if prisma migrate deploy; then
    echo "Migrations applied successfully."
    break
  fi
  echo "Migration failed, retrying in 2 seconds... ($((count+1))/$MAX_RETRIES)"
  sleep 2
  count=$((count+1))
done

if [ $count -eq $MAX_RETRIES ]; then
  echo "Failed to apply migrations after $MAX_RETRIES attempts."
  exit 1
fi

# Start the application
echo "Starting application..."
node server.js
