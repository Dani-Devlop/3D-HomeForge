#!/usr/bin/env bash
# Publishes 3D HomeForge to GitHub Pages infrastructure.
# Usage:  GH_TOKEN=github_pat_xxx bash scripts/publish.sh
# The token is read from the GH_TOKEN environment variable only —
# it is never written to disk, never hardcoded, never committed.
set -euo pipefail

REPO_OWNER="Dani-Devlop"
REPO_NAME="3D-HomeForge"
BRANCH="main"
AUTHOR_NAME="Dani-Devlop"
AUTHOR_EMAIL="Dani-Devlop@users.noreply.github.com"

if [ -z "${GH_TOKEN:-}" ]; then
  echo "ERROR: GH_TOKEN is not set. Run:  GH_TOKEN=<your-token> bash scripts/publish.sh"
  exit 1
fi

API="https://api.github.com"
AUTH="Authorization: Bearer ${GH_TOKEN}"
ACCEPT="Accept: application/vnd.github+json"

# 1. Commit identity (repo-local)
git config user.name  "$AUTHOR_NAME"
git config user.email "$AUTHOR_EMAIL"

# 2. Resolve the account's numeric ID and prefer the numeric noreply email
USER_ID="$(curl -s -H "$AUTH" "$API/users/${REPO_OWNER}" | sed -n 's/.*"id": \([0-9]*\).*/\1/p' | head -1)"
if [ -n "$USER_ID" ]; then
  git config user.email "${USER_ID}+${REPO_OWNER}@users.noreply.github.com"
  echo "→ Using numeric noreply email: ${USER_ID}+${REPO_OWNER}@users.noreply.github.com"
  # Re-apply to any commits made earlier with the plain form
  if ! git diff --quiet HEAD 2>/dev/null || [ -n "$(git status --porcelain)" ]; then
    git commit -q --amend --no-edit --reset-author || true
  fi
fi

# 3. Push to the canonical repo
echo "→ Pushing ${BRANCH} to ${REPO_OWNER}/${REPO_NAME} ..."
git push "https://x-access-token:${GH_TOKEN}@github.com/${REPO_OWNER}/${REPO_NAME}.git" "${BRANCH}"

# 4. Repo metadata: About description, homepage, topics
echo "→ Setting repo About/topics ..."
curl -s -o /dev/null -X PATCH -H "$AUTH" -H "$ACCEPT" \
  "$API/repos/${REPO_OWNER}/${REPO_NAME}" \
  -d '{
    "description": "Turn real-space photos into editable, shareable 3D interior designs — AI reconstruction, professional web editor, live client links, glTF/GLB export.",
    "homepage": "https://dani-devlop.github.io/3D-HomeForge/",
    "has_issues": true,
    "has_wiki": false
  }'

curl -s -o /dev/null -X PUT -H "$AUTH" -H "$ACCEPT" \
  "$API/repos/${REPO_OWNER}/${REPO_NAME}/topics" \
  -d '{"names":["3d","threejs","home-design","interior-design","webgl","github-pages","dark-mode","english-ui"]}'

# 5. Verify commit author resolves to the Dani-Devlop profile
echo "→ Verifying commit authorship ..."
sleep 3
LOGIN="$(curl -s -H "$AUTH" "$API/repos/${REPO_OWNER}/${REPO_NAME}/commits?per_page=1" \
  | sed -n 's/.*"login": "\([^"]*\)".*/\1/p' | head -1)"
echo "   latest commit author.login = ${LOGIN:-<unknown>}"
if [ "$LOGIN" = "$REPO_OWNER" ]; then
  echo "✓ Commit author verified as ${REPO_OWNER}"
else
  echo "✗ WARNING: author.login is '${LOGIN:-?}' — fix git config, amend and re-push."
  exit 2
fi

echo
echo "✓ Done. Enable GitHub Pages via Settings → Pages → Build and deployment →"
echo "  Source: GitHub Actions (required once), or run the deploy workflow manually:"
echo "  https://github.com/${REPO_OWNER}/${REPO_NAME}/actions/workflows/deploy.yml"
