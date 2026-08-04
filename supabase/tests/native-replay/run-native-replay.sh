#!/usr/bin/env bash
#
# Replay the ordered migration suite and the paper-doll pgTAP test against a
# native PostgreSQL 16 cluster, for environments with no Docker daemon
# (Claude Code on the web, CI runners without privileged containers).
#
# This is a stand-in for `npx supabase start` + `npx supabase test db --local`,
# NOT a replacement for it. Where a Docker daemon exists, prefer the CLI: it
# runs the real Supabase platform images rather than the bootstrap shim in
# 00_supabase_bootstrap.sql.
#
# Usage:  bash supabase/tests/native-replay/run-native-replay.sh [db_name]
#
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
DB="${1:-madison_test}"
PORT="${PGPORT_NATIVE:-54329}"
PGBIN=/usr/lib/postgresql/16/bin
PGDATA=/var/lib/postgresql/pdtest
OUTDIR="${REPLAY_OUT:-$HERE/.out}"

mkdir -p "$OUTDIR"
LOG="$OUTDIR/migration-run.log"
RESULTS="$OUTDIR/migration-results.tsv"
: > "$LOG"; : > "$RESULTS"

PSQL="psql -h 127.0.0.1 -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"

# ---------------------------------------------------------------- prereqs
need_pkg=()
for ext in pgtap vector plpgsql_check; do
  ls /usr/share/postgresql/16/extension/ 2>/dev/null | grep -q "^${ext}" || need_pkg+=("$ext")
done
if [ ${#need_pkg[@]} -gt 0 ]; then
  echo "==> installing missing extensions: ${need_pkg[*]}"
  apt-get install -y -q postgresql-16-pgtap postgresql-16-pgvector postgresql-16-plpgsql-check >/dev/null 2>&1
fi

# pg_net is a Supabase platform extension with no native package. Install an
# inert stub so `CREATE EXTENSION IF NOT EXISTS "pg_net"` resolves and no
# migration performs network I/O during replay.
EXT=/usr/share/postgresql/16/extension
if [ ! -f "$EXT/pg_net.control" ]; then
  cat > "$EXT/pg_net.control" <<'CTL'
comment = 'Async HTTP (local replay stub - no network I/O)'
default_version = '0.0-stub'
relocatable = false
schema = 'net'
CTL
  cat > "$EXT/pg_net--0.0-stub.sql" <<'SQL'
\echo Use "CREATE EXTENSION pg_net" to load this file. \quit
CREATE FUNCTION net.http_post(url text, body jsonb DEFAULT '{}'::jsonb,
  params jsonb DEFAULT '{}'::jsonb, headers jsonb DEFAULT '{}'::jsonb,
  timeout_milliseconds int DEFAULT 5000)
RETURNS bigint LANGUAGE sql AS $$ SELECT 0::bigint $$;
CREATE FUNCTION net.http_get(url text, params jsonb DEFAULT '{}'::jsonb,
  headers jsonb DEFAULT '{}'::jsonb, timeout_milliseconds int DEFAULT 5000)
RETURNS bigint LANGUAGE sql AS $$ SELECT 0::bigint $$;
SQL
fi

# ---------------------------------------------------------------- cluster
if ! "$PGBIN/pg_isready" -h 127.0.0.1 -p "$PORT" >/dev/null 2>&1; then
  echo "==> starting native cluster on port $PORT"
  if [ ! -d "$PGDATA/base" ]; then
    mkdir -p "$PGDATA" /var/lib/postgresql/pdrun /var/lib/postgresql/pdlog
    chown -R postgres:postgres "$PGDATA" /var/lib/postgresql/pdrun /var/lib/postgresql/pdlog
    chmod 700 "$PGDATA"
    su postgres -c "$PGBIN/initdb -D $PGDATA -U postgres --auth=trust --encoding=UTF8 --locale=C" >/dev/null
  fi
  su postgres -c "$PGBIN/pg_ctl -D $PGDATA -l /var/lib/postgresql/pdlog/pg.log \
    -o '-p $PORT -k /var/lib/postgresql/pdrun -c listen_addresses=127.0.0.1' start -w -t 60" >/dev/null
fi
"$PGBIN/pg_isready" -h 127.0.0.1 -p "$PORT" || { echo "cluster unavailable"; exit 1; }

# --------------------------------------------------------------- bootstrap
echo "==> recreating $DB"
psql -h 127.0.0.1 -p "$PORT" -U postgres -q -c "DROP DATABASE IF EXISTS $DB" >>"$LOG" 2>&1
psql -h 127.0.0.1 -p "$PORT" -U postgres -q -c "CREATE DATABASE $DB" >>"$LOG" 2>&1

echo "==> applying Supabase bootstrap shim"
if ! $PSQL -d "$DB" -f "$HERE/00_supabase_bootstrap.sql" >>"$LOG" 2>&1; then
  echo "BOOTSTRAP FAILED — see $LOG"; tail -25 "$LOG"; exit 1
fi

# -------------------------------------------------------------- migrations
ok=0; fail=0
for f in "$REPO"/supabase/migrations/*.sql; do
  name=$(basename "$f")
  err=$($PSQL -d "$DB" -f "$f" 2>&1 >/dev/null)
  if [ $? -eq 0 ]; then
    ok=$((ok+1)); printf 'OK\t%s\t\n' "$name" >> "$RESULTS"
  else
    fail=$((fail+1))
    first=$(printf '%s' "$err" | grep -m1 'ERROR:' | head -c 300)
    printf 'FAIL\t%s\t%s\n' "$name" "$first" >> "$RESULTS"
    { echo "### $name"; printf '%s\n\n' "$err"; } >> "$LOG"
  fi
done
echo "==> migrations applied: $ok   failed: $fail   (of $((ok+fail)))"

echo
echo "--- paper-doll migrations ---"
awk -F'\t' '$2 ~ /paper_doll/ {printf "  %-6s %s\n", $1, $2}' "$RESULTS"

# ------------------------------------------------------------------ pgTAP
echo
echo "==> pgTAP: paper_doll_family_release_v1"
OUT=$(psql -h 127.0.0.1 -p "$PORT" -U postgres -d "$DB" \
  -f "$REPO/supabase/tests/paper_doll_family_release_v1.sql" 2>&1)
printf '%s\n' "$OUT" > "$OUTDIR/pgtap.out"
passed=$(printf '%s' "$OUT" | grep -cE '^ ok [0-9]+ -')
failed=$(printf '%s' "$OUT" | grep -cE 'not ok')
printf '%s' "$OUT" | grep -oE 'ok [0-9]+ - .*' | sed 's/^/  /'
echo
echo "==> pgTAP passed: $passed   failed: $failed"

[ "$failed" -eq 0 ] && [ "$passed" -gt 0 ] || { echo "PGTAP GATE FAILED"; exit 1; }
echo "==> PGTAP GATE PASSED"
