#!/usr/bin/env bash
# Tells Bing, Yandex and other IndexNow engines (Bing also feeds ChatGPT and
# Copilot search) that every URL in the live sitemap changed. Run after a deploy.
set -euo pipefail
KEY=75fde996bfe8826d2297b3860f05601b
URLS=$(curl -fsSL https://fiscallm.com/sitemap.xml | grep -o '<loc>[^<]*' | sed 's/<loc>//' | jq -R . | jq -s .)
curl -sS -o /dev/null -w "IndexNow: %{http_code}\n" -X POST https://api.indexnow.org/indexnow \
  -H 'content-type: application/json; charset=utf-8' \
  -d "{\"host\":\"fiscallm.com\",\"key\":\"$KEY\",\"keyLocation\":\"https://fiscallm.com/$KEY.txt\",\"urlList\":$URLS}"
