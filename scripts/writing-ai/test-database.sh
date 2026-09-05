#!/usr/bin/env bash
# Runs only against a disposable container with no network or persistent volume.
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
container="madison-writing-ai-test-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run --detach --rm --name "$container" --network none --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=ephemeral-writing-test-only public.ecr.aws/supabase/postgres:17.6.1.159 >/dev/null
ready=false
for attempt in $(seq 1 60); do
  # Do not connect to the temporary server used by the image's init scripts.
  if ! docker logs "$container" 2>&1 | grep -q 'init process complete'; then sleep 1; continue; fi
  if docker exec "$container" psql -U supabase_admin -d postgres -Atc "select exists(select 1 from pg_extension where extname='supabase_vault')" 2>/dev/null | grep -qx t; then ready=true; break; fi
  sleep 1
done
if [ "$ready" != true ]; then echo 'Disposable database did not initialize.' >&2; exit 1; fi
docker exec -i "$container" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < "$repo_root/scripts/writing-ai/database-fixture.sql"
docker exec -i "$container" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < "$repo_root/supabase/migrations/20260905000113_writing_ai_settings.sql"
# Match the normal migration owner when testing SECURITY DEFINER access to Vault.
docker exec "$container" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c "alter schema writing_ai_private owner to postgres; alter table public.writing_ai_settings owner to postgres; alter table writing_ai_private.writing_ai_keys owner to postgres; alter function public.read_writing_ai_key(uuid,text) owner to postgres; alter function public.writing_ai_key_status(uuid) owner to postgres; alter function public.save_writing_ai_settings(uuid,text,text,text,text) owner to postgres;"
docker exec -i "$container" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < "$repo_root/scripts/writing-ai/database-assertions.sql"
