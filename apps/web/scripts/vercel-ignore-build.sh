#!/usr/bin/env bash

# Vercel Ignored Build Step for the apps/web project.
# Exit 0 skips the build; any nonzero exit lets Vercel continue the build.
# The script compares the last successful deployment on this branch with the
# current commit, and skips only when every changed path is allowlisted below.

set -u

allow_build() {
  printf 'Vercel ignore check: proceeding with build (%s).\n' "$1" >&2
  exit 1
}

skip_build() {
  printf 'Vercel ignore check: skipping build (%s).\n' "$1"
  exit 0
}

previous_sha="${VERCEL_GIT_PREVIOUS_SHA:-}"
current_sha="${VERCEL_GIT_COMMIT_SHA:-}"

if [[ -z "$previous_sha" || -z "$current_sha" ]]; then
  allow_build 'required Vercel commit SHA is missing'
fi

if [[ ! "$previous_sha" =~ ^([[:xdigit:]]{40}|[[:xdigit:]]{64})$ || ! "$current_sha" =~ ^([[:xdigit:]]{40}|[[:xdigit:]]{64})$ ]]; then
  allow_build 'a Vercel commit SHA has an invalid format'
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" 2>/dev/null && pwd -P)" || \
  allow_build 'cannot locate the ignore script'

repo_root="$(git -C "$script_dir" rev-parse --show-toplevel 2>/dev/null)" || \
  allow_build 'cannot locate the repository root'

if ! git -C "$repo_root" cat-file -e "${previous_sha}^{commit}" 2>/dev/null; then
  allow_build 'the previous deployment commit is unavailable in the clone'
fi

if ! git -C "$repo_root" cat-file -e "${current_sha}^{commit}" 2>/dev/null; then
  allow_build 'the current deployment commit is unavailable in the clone'
fi

# A force-push or a shallow clone may leave the previous deployment outside
# the current commit's known history. In either case, build to avoid skipping
# a deployment when the comparison is incomplete.
if ! git -C "$repo_root" merge-base --is-ancestor "$previous_sha" "$current_sha" 2>/dev/null; then
  allow_build 'the previous deployment is not a verified ancestor'
fi

# Git exits 0 when no non-allowlisted path changed, 1 when such a change exists,
# and >1 on comparison errors. Only exit 0 is safe to skip. --no-renames makes
# both sides of a rename visible, so moving an allowed file elsewhere still
# causes a build.
if git -C "$repo_root" diff \
  --quiet \
  --no-ext-diff \
  --no-renames \
  "$previous_sha" \
  "$current_sha" \
  -- \
  . \
  ':(exclude).github/workflows/**' \
  ':(exclude)apps/web/scripts/vercel-ignore-build.sh' 2>/dev/null; then
  skip_build 'all changed paths are GitHub workflows or this script'
else
  diff_status=$?
  if [[ "$diff_status" -eq 1 ]]; then
    allow_build 'at least one non-allowlisted path changed'
  fi

  allow_build 'Git could not compare the deployment commits'
fi
