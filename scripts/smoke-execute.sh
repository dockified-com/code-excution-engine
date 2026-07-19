#!/usr/bin/env bash
# Smoke checks for the code execution API against a running Nest + Piston stack.
# Usage:
#   BASE=http://127.0.0.1:3000 API_KEY=dev-key-tutor ./scripts/smoke-execute.sh
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:3000}"
API_KEY="${API_KEY:-dev-key-tutor}"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

echo "==> health (${BASE}/health)"
HEALTH="$(curl -sf "${BASE}/health")" || fail "GET /health failed (is Nest running at ${BASE}?)"
echo "${HEALTH}" | grep -q 'ok' || fail "health body missing ok: ${HEALTH}"
echo "OK: ${HEALTH}"

echo "==> execute judge (public + hidden)"
BODY='{
  "language": "javascript",
  "files": [{"name":"main.js","content":"console.log(1+2)"}],
  "tests": [
    {"id":"t1","expectedStdout":"3","visibility":"public"},
    {"id":"t2","expectedStdout":"999","visibility":"hidden"}
  ]
}'
RESP="$(curl -sf -X POST "${BASE}/v1/execute" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "${BODY}")" || fail "POST /v1/execute failed (check API_KEY and Piston)"

echo "${RESP}"

# Prefer python for structured checks; fall back to grep if unavailable.
if command -v python3 >/dev/null 2>&1; then
  python3 - "${RESP}" <<'PY' || exit 1
import json, sys
raw = sys.argv[1]
data = json.loads(raw)
summary = data.get("summary") or {}
tests = data.get("tests") or []
if summary.get("passed") != 1:
    print(f"FAIL: expected summary.passed == 1, got {summary.get('passed')!r}", file=sys.stderr)
    sys.exit(1)
if summary.get("failed") != 1:
    print(f"FAIL: expected summary.failed == 1, got {summary.get('failed')!r}", file=sys.stderr)
    sys.exit(1)
if summary.get("total") != 2:
    print(f"FAIL: expected summary.total == 2, got {summary.get('total')!r}", file=sys.stderr)
    sys.exit(1)
by_id = {t.get("id"): t for t in tests}
if "t1" not in by_id or "t2" not in by_id:
    print(f"FAIL: missing test results t1/t2: {list(by_id)}", file=sys.stderr)
    sys.exit(1)
pub, hid = by_id["t1"], by_id["t2"]
if not pub.get("passed"):
    print("FAIL: public test t1 should pass", file=sys.stderr)
    sys.exit(1)
if hid.get("passed"):
    print("FAIL: hidden test t2 should fail (wrong answer)", file=sys.stderr)
    sys.exit(1)
# Public may include I/O fields; hidden must not leak them.
leaky = [k for k in ("expectedStdout", "actualStdout", "stdin", "stderr") if k in hid]
if leaky:
    print(f"FAIL: hidden test leaked fields: {leaky}", file=sys.stderr)
    sys.exit(1)
print("OK: summary and visibility filter look correct")
PY
else
  echo "${RESP}" | grep -q '"passed":1' || fail "expected summary.passed 1 in response"
  # Hidden case must not include expectedStdout for t2 (public may include it).
  # Strip public test object roughly by checking no expectedStdout next to t2 hidden.
  if echo "${RESP}" | grep -qE '"id"[[:space:]]*:[[:space:]]*"t2"[^}]*"expectedStdout"'; then
    fail "hidden test t2 appears to include expectedStdout"
  fi
  if echo "${RESP}" | grep -qE '"id"[[:space:]]*:[[:space:]]*"t2"[^}]*"actualStdout"'; then
    fail "hidden test t2 appears to include actualStdout"
  fi
  echo "OK: basic response checks passed (install python3 for stricter JSON asserts)"
fi

echo "==> unauthorized without API key"
CODE="$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/v1/execute" \
  -H "Content-Type: application/json" \
  -d '{}')" || true
if [[ "${CODE}" != "401" ]]; then
  fail "expected HTTP 401 without key, got ${CODE}"
fi
echo "OK: got 401"

echo "==> all smoke checks passed"
