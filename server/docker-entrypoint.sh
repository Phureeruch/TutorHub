#!/bin/sh
set -e

# If DATABASE_URL is not set or empty, construct it dynamically using POSTGRES_* variables.
# Credentials are URL-encoded with Node.js encodeURIComponent to safely handle special characters.
if [ -z "$DATABASE_URL" ] && [ -n "$POSTGRES_PASSWORD" ]; then
  ENCODED_USER=$(node -e 'console.log(encodeURIComponent(process.env.POSTGRES_USER || "postgres"))')
  ENCODED_PASS=$(node -e 'console.log(encodeURIComponent(process.env.POSTGRES_PASSWORD || ""))')
  DB_HOST="${POSTGRES_HOST:-db}"
  DB_PORT="${POSTGRES_PORT:-5432}"
  DB_NAME="${POSTGRES_DB:-tutorhub}"
  export DATABASE_URL="postgresql://${ENCODED_USER}:${ENCODED_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"
fi

exec "$@"
