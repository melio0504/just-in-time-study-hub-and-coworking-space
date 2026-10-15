#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd -- "${script_dir}/.." && pwd)"
database_url="${PAYMONGO_TEST_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
functions_env_file="${PAYMONGO_TEST_ENV_FILE:-${project_root}/supabase/functions/.env}"
print_only=false

usage() {
  cat <<'EOF'
Usage: npm run paymongo:test-url -- [--print-only]

Find the latest active local PayMongo test Payment Intent, retrieve its test
control URL, and open it in the default browser when a desktop is available.

Options:
  --print-only  Print the URL without opening a browser.
  --help        Show this help message.

Optional environment variables:
  PAYMONGO_TEST_DATABASE_URL  Override the local Postgres connection URL.
  PAYMONGO_TEST_ENV_FILE      Override the Supabase Functions environment file.
EOF
}

case "${1:-}" in
  "") ;;
  --print-only) print_only=true ;;
  --help|-h)
    usage
    exit 0
    ;;
  *)
    echo "Unknown option: $1" >&2
    usage >&2
    exit 2
    ;;
esac

for required_command in psql curl jq sed; do
  if ! command -v "${required_command}" >/dev/null 2>&1; then
    echo "Required command not found: ${required_command}" >&2
    exit 1
  fi
done

if [[ ! -f "${functions_env_file}" ]]; then
  echo "Supabase Functions environment file not found: ${functions_env_file}" >&2
  echo "Create it from supabase/functions/.env.example and add your PayMongo test keys." >&2
  exit 1
fi

paymongo_test_key="$({ sed -n 's/^PAYMONGO_SECRET_KEY=//p' "${functions_env_file}" || true; } | tail -n 1 | tr -d '\r')"
if [[ ! "${paymongo_test_key}" =~ ^sk_test_[A-Za-z0-9_]+$ ]]; then
  echo "PAYMONGO_SECRET_KEY in ${functions_env_file} is missing or is not a test key." >&2
  echo "This helper intentionally refuses to use live PayMongo credentials." >&2
  exit 1
fi

cleanup() {
  unset paymongo_test_key paymongo_response
}
trap cleanup EXIT

if ! intent_id="$(
  psql "${database_url}" -v ON_ERROR_STOP=1 -tAc "
    select provider_payment_intent_id
    from public.payments
    where provider_payment_intent_id is not null
      and livemode is false
      and status in ('pending', 'processing')
    order by created_at desc
    limit 1
  "
)"; then
  echo "Could not query the local Supabase database." >&2
  echo "Start it with: npm run supabase:start" >&2
  exit 1
fi

intent_id="$(printf '%s' "${intent_id}" | tr -d '[:space:]')"
if [[ ! "${intent_id}" =~ ^pi_[A-Za-z0-9]+$ ]]; then
  echo "No active local PayMongo test Payment Intent was found." >&2
  echo "Create a reservation and wait for its QR code, then run this command again." >&2
  exit 1
fi

if ! paymongo_response="$(
  curl --silent --show-error --fail --max-time 20 \
    --user "${paymongo_test_key}:" \
    "https://api.paymongo.com/v1/payment_intents/${intent_id}"
)"; then
  echo "Could not retrieve Payment Intent ${intent_id} from PayMongo." >&2
  exit 1
fi

if ! test_url="$(
  jq -er '(.data.attributes.next_action.code.test_url // empty) | select(type == "string" and startswith("https://"))' \
    <<<"${paymongo_response}"
)"; then
  echo "PayMongo did not return an active test control URL for ${intent_id}." >&2
  echo "The QR code may have expired or the Payment Intent may already be resolved." >&2
  exit 1
fi

printf 'PayMongo test controls:\n%s\n' "${test_url}"

if [[ "${print_only}" == true ]]; then
  exit 0
fi

if command -v xdg-open >/dev/null 2>&1 \
  && { [[ -n "${DISPLAY:-}" ]] || [[ -n "${WAYLAND_DISPLAY:-}" ]]; } \
  && xdg-open "${test_url}" >/dev/null 2>&1; then
  echo "Opened the test controls in your default browser."
elif command -v open >/dev/null 2>&1 && open "${test_url}" >/dev/null 2>&1; then
  echo "Opened the test controls in your default browser."
else
  echo "A browser could not be opened automatically. Open the URL printed above."
fi
