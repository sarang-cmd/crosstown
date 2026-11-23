#!/usr/bin/env bash
# Publish only a reviewed feature branch to the user's existing private repo.
# Authenticate with GitHub CLI or a transient GH_TOKEN; never commit credentials.
# This opens/reuses a PR. It does not push application content to main or merge.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v gh >/dev/null || { echo 'Install GitHub CLI and securely authenticate first.' >&2; exit 1; }
gh auth status >/dev/null
repository="$(node -p "JSON.parse(require('fs').readFileSync('docs/GITHUB.json')).fullName")"
expected_id="$(node -p "JSON.parse(require('fs').readFileSync('docs/GITHUB.json')).id")"
expected_owner="${repository%%/*}"
[[ "$(gh api user --jq .login)" == "$expected_owner" ]] || { echo "Authenticate as the approved owner: $expected_owner" >&2; exit 1; }
[[ "$(gh api "repos/$repository" --jq .id)" == "$expected_id" ]] || { echo 'Repository ID mismatch; refusing to publish.' >&2; exit 1; }
[[ "$(gh api "repos/$repository" --jq .private)" == true ]] || { echo 'Expected the existing PRIVATE repository.' >&2; exit 1; }
base="$(gh api "repos/$repository" --jq .default_branch)"
git rev-parse --verify HEAD >/dev/null || { echo 'Create reviewed, allowlisted commits first; never git-add the home directory.' >&2; exit 1; }
branch="$(git symbolic-ref --quiet --short HEAD)" || { echo 'Check out the reviewed feature branch; detached HEAD is not publishable.' >&2; exit 1; }
[[ "$branch" != "$base" && "$branch" != main && "$branch" != master ]] || { echo 'Use a separate feature branch; direct default-branch publishing is refused.' >&2; exit 1; }
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || { echo 'Review and commit the working tree before publishing.' >&2; exit 1; }
remote="https://github.com/$repository.git"
if current="$(git remote get-url origin 2>/dev/null)"; then
  [[ "$current" == "$remote" || "$current" == "git@github.com:$repository.git" ]] || { echo 'Origin does not match the approved repository.' >&2; exit 1; }
else
  git remote add origin "$remote"
fi
# No force push, repository creation/deletion, visibility edit, merge or deployment.
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push --set-upstream origin "$branch"
if gh pr view "$branch" --repo "$repository" --json url --jq .url 2>/dev/null; then
  exit 0
fi
title="${PR_TITLE:-$(git log -1 --format=%s)}"
args=(--repo "$repository" --base "$base" --head "$branch" --title "$title")
if [[ -n "${PR_BODY_FILE:-}" ]]; then
  [[ -f "$PR_BODY_FILE" ]] || { echo 'PR_BODY_FILE does not exist.' >&2; exit 1; }
  args+=(--body-file "$PR_BODY_FILE")
else
  args+=(--body 'Reviewed source branch. See docs/TESTING.md and docs/PROGRESS.md for exact verification and open acceptance. This publication does not merge or deploy the project.')
fi
gh pr create "${args[@]}"
