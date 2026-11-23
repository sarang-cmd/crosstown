#!/usr/bin/env bash
# Publish ONLY to the user's existing private repository. Never recreate it.
# Authenticate with `gh auth login --web --git-protocol https`, or a transient
# GH_TOKEN environment variable. Never put a token in a file, URL or argument.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v gh >/dev/null || { echo 'Install GitHub CLI, then securely authenticate with gh auth login --web --git-protocol https.' >&2; exit 1; }
gh auth status >/dev/null
repository="$(node -p "JSON.parse(require('fs').readFileSync('docs/GITHUB.json')).fullName")"
expected_id="$(node -p "JSON.parse(require('fs').readFileSync('docs/GITHUB.json')).id")"
expected_owner="${repository%%/*}"
[[ "$(gh api user --jq .login)" == "$expected_owner" ]] || { echo "Authenticate as the approved owner: $expected_owner" >&2; exit 1; }
[[ "$(gh api "repos/$repository" --jq .id)" == "$expected_id" ]] || { echo 'Repository ID mismatch. Refusing to publish.' >&2; exit 1; }
[[ "$(gh api "repos/$repository" --jq .private)" == true ]] || { echo 'Expected the existing PRIVATE repository. Review visibility manually.' >&2; exit 1; }
git rev-parse --verify HEAD >/dev/null || { echo 'Create and review an allowlisted local source commit first; never git-add the entire home directory.' >&2; exit 1; }
[[ "$(git branch --show-current)" == main ]] || { echo 'Review the main branch before publishing.' >&2; exit 1; }
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || { echo 'Review and commit the working tree before publishing.' >&2; exit 1; }
remote="https://github.com/$repository.git"
if current="$(git remote get-url origin 2>/dev/null)"; then
  [[ "$current" == "$remote" || "$current" == "git@github.com:$repository.git" ]] || { echo 'Origin does not match the approved repository; refusing to replace it.' >&2; exit 1; }
else
  git remote add origin "$remote"
fi
# The helper obtains the credential transiently; this never writes a token or
# persistent credential-helper configuration. Normal non-fast-forward protection
# remains enabled: no force push, repository creation, deletion or visibility edit.
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push --set-upstream origin main
metadata=.github/repository.json
gh repo edit "$repository" --description "$(node -p "JSON.parse(require('fs').readFileSync('$metadata')).description")" --homepage "$(node -p "JSON.parse(require('fs').readFileSync('$metadata')).homepage")"
while IFS= read -r topic; do gh repo edit "$repository" --add-topic "$topic"; done < <(node -p "JSON.parse(require('fs').readFileSync('$metadata')).topics.join('\n')")
printf '\nPublished reviewed commit %s to https://github.com/%s\n' "$(git rev-parse HEAD)" "$repository"
