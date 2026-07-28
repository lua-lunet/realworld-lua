#!/bin/sh
set -eu

api_url=${HOST:-http://localhost:8081}
response_file=$(mktemp)
trap 'rm -f "$response_file"' EXIT HUP INT TERM

request() {
    curl --silent --show-error --output "$response_file" --write-out '%{http_code}' "$@"
}

status=$(request -X POST "$api_url/api/users" \
    -H 'Content-Type: application/json' \
    --data '{"user":{"username":"demo","email":"demo@example.com","password":"demo-password"}}')

case "$status" in
    201) ;;
    409)
        status=$(request -X POST "$api_url/api/users/login" \
            -H 'Content-Type: application/json' \
            --data '{"user":{"email":"demo@example.com","password":"demo-password"}}')
        [ "$status" = 200 ] || {
            echo "ERROR: demo user exists but could not be authenticated (HTTP $status)." >&2
            cat "$response_file" >&2
            exit 1
        }
        ;;
    *)
        echo "ERROR: could not create demo user (HTTP $status)." >&2
        cat "$response_file" >&2
        exit 1
        ;;
esac

token=$(sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$response_file" | head -n 1)
[ -n "$token" ] || { echo "ERROR: demo user response did not include a token." >&2; exit 1; }

status=$(request "$api_url/api/articles/seeded-demo-article")
if [ "$status" = 404 ]; then
    status=$(request -X POST "$api_url/api/articles" \
        -H 'Content-Type: application/json' \
        -H "Authorization: Token $token" \
        --data '{"article":{"slug":"seeded-demo-article","title":"Seeded demo article","description":"A deterministic local development record.","body":"Created by make seed so the articles and tags endpoints have data.","tagList":["demo","lunet"]}}')
    [ "$status" = 201 ] || {
        echo "ERROR: could not create demo article (HTTP $status)." >&2
        cat "$response_file" >&2
        exit 1
    }
elif [ "$status" != 200 ]; then
    echo "ERROR: could not inspect demo article (HTTP $status)." >&2
    cat "$response_file" >&2
    exit 1
fi

echo "Seeded demo@example.com (password: demo-password) and /api/articles/seeded-demo-article."
