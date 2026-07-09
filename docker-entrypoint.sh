#!/bin/sh
set -e

if [ "${RUN_DB_MIGRATIONS:-true}" = "true" ]; then
  ./node_modules/.bin/drizzle-kit migrate
fi

exec "$@"
