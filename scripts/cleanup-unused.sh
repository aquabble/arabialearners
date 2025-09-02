#!/usr/bin/env bash
set -euo pipefail

ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )"/.. && pwd )"
cd "$ROOT"

echo "Removing unused components and libs..."
rm -f src/components/Drills.jsx || true
rm -f src/components/GrammarHub.jsx || true
rm -f src/components/Profile.jsx || true
rm -f src/components/ProfileFirebase.jsx || true
rm -f src/lib/autoSync.js || true
rm -f src/lib/cloudStore.js || true
rm -f src/lib/firebase-guard.js || true
rm -f src/lib/persistence.js || true
rm -f src/lib/generator.js || true
rm -f src/lib/semester1.json || true
rm -f src/styles/logo-dropdown.css || true

echo "Optionally removing unused deps (safe if Profile.jsx is deleted)..."
if npm pkg get dependencies | grep -q '"ai"'; then
  npm remove ai
fi
if npm pkg get dependencies | grep -q '"@react-oauth/google"'; then
  npm remove @react-oauth/google
fi

echo "Done. Recommended: npm install && npm run dev"
