#!/bin/sh
set -eu

if [ -z "${API_URL:-}" ]; then
  echo "ERRO: defina API_URL com a URL publica do backend, incluindo /api." >&2
  exit 1
fi

envsubst '${API_URL}' \
  < /opt/gente-boa/runtime-config.template.js \
  > /usr/share/nginx/html/config.js
