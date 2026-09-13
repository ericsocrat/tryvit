#!/usr/bin/env bash
set -euo pipefail

# Ephemeral Supabase lifecycle for GitHub-hosted browser jobs.
#
# This script deliberately exposes no credentials. The guarded visual-safety
# launcher performs readiness checks and obtains local fixture credentials only
# after proving the configured API origin is loopback-only.

action="${1:-}"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repository_root="$(cd -- "${script_dir}/../../.." && pwd -P)"
temporary_root="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
failure_classifier="${script_dir}/local-supabase-failure.mjs"

# Keep captured CLI output private even outside GitHub-hosted runners.
umask 077

# Local lifecycle commands never need hosted-project authority. Strip any
# accidentally inherited cloud controls before invoking the CLI.
unset SUPABASE_ACCESS_TOKEN
unset SUPABASE_DB_PASSWORD
unset SUPABASE_PROJECT_ID
unset SUPABASE_URL
unset SUPABASE_SERVICE_KEY
unset SUPABASE_SERVICE_ROLE_KEY
unset NEXT_PUBLIC_SUPABASE_URL
unset NEXT_PUBLIC_SUPABASE_ANON_KEY

run_without_output() {
  local label="$1"
  shift
  local output_file
  output_file="$(mktemp "${temporary_root}/tryvit-${label}.XXXXXX")"
  trap 'rm -f -- "$output_file"' HUP INT TERM

  if ! "$@" >"$output_file" 2>&1; then
    # Supabase CLI output can contain local JWTs. Never replay it into Actions
    # logs or retain it as an artifact, even on failure. The classifier returns
    # one reviewed constant and never echoes captured text.
    local cause
    cause="$(node "$failure_classifier" "$output_file" 2>/dev/null || printf 'unclassified')"
    case "$cause" in
      configuration-invalid|container-image-unavailable|docker-daemon-unavailable|migration-failed|network-failure|port-conflict|runner-resource-exhausted|service-health-failed|unclassified) ;;
      *) cause="unclassified" ;;
    esac
    printf '[VS_LOCAL_RUNTIME] %s-failed; cause=%s; credential-bearing CLI output withheld\n' "$label" "$cause" >&2
    rm -f -- "$output_file"
    trap - HUP INT TERM
    return 1
  fi
  rm -f -- "$output_file"
  trap - HUP INT TERM
}

case "$action" in
  start)
    # Browser coverage requires Postgres, Kong/API, GoTrue, PostgREST, and the
    # existing feature-flag Realtime subscription. Every unrelated service
    # remains excluded to reduce runner startup time and image usage.
    run_without_output "supabase-start" \
      supabase start \
        --workdir "$repository_root" \
        --exclude storage-api,imgproxy,postgres-meta,studio,mailpit,edge-runtime,logflare,vector,supavisor
    printf '[VS_LOCAL_RUNTIME] started; guarded readiness is still required\n'
    ;;
  stop)
    run_without_output "supabase-stop" \
      supabase stop --workdir "$repository_root" --no-backup
    printf '[VS_LOCAL_RUNTIME] stopped; local volumes removed without backup\n'
    ;;
  *)
    printf '[VS_LOCAL_RUNTIME] expected start or stop\n' >&2
    exit 2
    ;;
esac
