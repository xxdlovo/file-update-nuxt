#!/bin/sh
set -e

db_path="${DATABASE_URL#file:}"

if [ "$db_path" = "$DATABASE_URL" ] || [ -z "$db_path" ]; then
  db_path="/app/data/app.db"
fi

mkdir -p "$(dirname "$db_path")"
touch "$db_path"

if [ "${RUN_DB_MIGRATIONS:-true}" = "true" ]; then
  ./node_modules/.bin/drizzle-kit migrate
fi

exec "$@"
