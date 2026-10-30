#!/usr/bin/env bash
# Runs SQL regression tests in a THROWAWAY local Postgres (never the project DB).
# Usage: PGBIN=/path/to/postgresql/bin scripts/run-sql-tests.sh
set -euo pipefail
PGBIN="${PGBIN:?set PGBIN to a local PostgreSQL bin directory}"
DIR="$(mktemp -d)"; trap '"$PGBIN/pg_ctl" -D "$DIR" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
"$PGBIN/initdb" -D "$DIR" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$DIR" -o "-k $DIR -p 55432 -c listen_addresses=''" -w start >/dev/null
P=("$PGBIN/psql" -h "$DIR" -p 55432 -U postgres -v ON_ERROR_STOP=1 -q -d postgres)
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"${P[@]}" -f "$ROOT/tests/sql/fixtures.sql"
"${P[@]}" -f "$ROOT/drizzle/migrations/0137_atomic_report_finalize_and_outcome_receipts.sql"
"${P[@]}" -f "$ROOT/tests/sql/finalize-and-outcome.test.sql"
echo "SQL tests: PASS"
