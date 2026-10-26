#!/usr/bin/env bash
set -euo pipefail

release=${1:?Usage: deploy.sh COMMIT_SHA}
[[ "$release" =~ ^[a-f0-9]{40}$ ]] || { echo 'Expected a full Git commit SHA' >&2; exit 1; }
root=/opt/atelier-demo
archive=/tmp/backend-$release.tar.gz
cd "$root"
exec 9> .deploy.lock
flock -n 9 || { echo 'Another deployment is running' >&2; exit 1; }
test -f .env
test -f compose.yml
test -f "$archive"
# Existing Compose identity and volume names are kept; CI never replaces secrets or seeds DB.
mkdir -p "releases/$release"
tar -xzf "$archive" -C "releases/$release"
sudo -n docker build -t "atelier-backend:$release" "releases/$release/backend"
cp .env .env.previous
chmod 600 .env.previous
python3 - "$release" <<'PY'
import sys
from pathlib import Path
p = Path('.env')
lines = [line for line in p.read_text().splitlines() if not line.startswith('RELEASE_TAG=')]
lines.append('RELEASE_TAG=' + sys.argv[1])
p.write_text('\n'.join(lines) + '\n')
p.chmod(0o600)
PY
sudo -n docker compose config --quiet
sudo -n docker compose up -d --wait db
# Maintenance window: stop writes before applying migrations.
sudo -n docker compose stop backend
if ! sudo -n docker compose run --rm -T --interactive=false migrate; then
  # Current migration runner wraps all migrations in one DB transaction.
  cp .env.previous .env
  sudo -n docker compose up -d --no-build --wait backend proxy
  echo 'Migration failed; previous image restarted. Release rejected.' >&2
  exit 1
fi
if ! sudo -n docker compose up -d --no-build --wait --wait-timeout 120 backend proxy; then
  echo 'Startup failed after migration. Review logs and schema compatibility before rollback.' >&2
  exit 1
fi
# Check the private API directly; the public proxy may later enforce HTTPS.
curl --fail --silent --show-error --retry 5 --retry-delay 2 --retry-connrefused --max-time 10 \
  http://127.0.0.1:4000/api/ready
sudo -n docker compose exec -T backend node --input-type=module -e '
const response = await fetch("http://127.0.0.1:4000/api/products");
if (!response.ok || !Array.isArray((await response.json()).data)) process.exit(1);
console.log("Catalog smoke test OK");'
sudo -n docker compose ps
rm -f "$archive" "/tmp/deploy-$release.sh"
echo "Deployed $release"
