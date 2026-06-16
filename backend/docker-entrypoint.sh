#!/bin/sh
set -eu

echo "Aplicando migrations..."
npx prisma migrate deploy

if [ "${RUN_SEED_ON_START:-false}" = "true" ]; then
  echo "Executando seed inicial..."
  npm run prisma:seed
fi

echo "Iniciando API..."
exec node dist/src/index.js
