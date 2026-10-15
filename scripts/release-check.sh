#!/bin/sh
set -eu

echo "📦 PACKET RELEASE VERIFICATION"

echo "1. JavaScript syntax"
for file in src/*.js; do
  node --check "$file"
done

echo "2. Automated tests"
node --test test/*.test.js

echo "3. Dependency audit"
npm audit --omit=dev

echo "4. Git whitespace"
git diff --check
git diff --cached --check

echo "5. Docker configuration"
test -f Dockerfile
test -f .dockerignore

echo "6. Convex source"
test -f convex/http.ts

echo "7. Git tracked secrets check"
if git ls-files | grep -E '(^|/)(\.env(\..*)?|\.packet-relay\.env)$'; then
  echo "❌ Environment file is tracked by Git"
  exit 1
fi

echo "✅ RELEASE CHECKS PASSED"
