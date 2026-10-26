# Run and deploy Atelier

AWS backend preparation: see [EC2 + RDS + ECR guide](deploy/aws/README.vi.md) and the backend-only Compose configuration in `deploy/aws`.

## Local

```sh
docker compose up --build -d
```

Open http://localhost:3000. Compose starts PostgreSQL, one-shot migrations and seed, Express, then Next.js. Data lives in `postgres-data`. Local administrator: `admin@gmail.com` / `admin123`; register client accounts through the UI. Local database credentials are development defaults.

## Production

Build frontend with `API_INTERNAL_URL=http://backend:4000`. Deploy the frontend and backend images using `docker-compose.prod.yml`. The browser calls the frontend's `/api`; Next proxies to Express on the private Docker network. Put an HTTPS reverse proxy in front of the frontend (bound to loopback by default). Production session cookies require HTTPS.

Set these variables on the host:

- `DOCKERHUB_USERNAME`, `IMAGE_TAG` — image repository and release tag.
- `POSTGRES_PASSWORD` — strong random URL-safe letters, digits, underscores or hyphens; used in the connection URI.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD_B64` — initial administrator seed credentials; Base64 is transport encoding, not encryption.
- `CLIENT_ORIGIN` — exact HTTPS frontend origin.
- Optional `FRONTEND_PORT` and `FRONTEND_BIND`; defaults are 3000 and 127.0.0.1.

Compose waits for DB health, applies migrations, seeds missing records, starts API after seed, and frontend after API readiness. Seed never resets an existing account's password. For a release, recreate the one-shot migration/seed containers as well as app containers (`docker compose up -d --force-recreate` after pulling). Use a maintenance window for migrations that affect running writes.

## Jenkins and CI

Jenkins requires Docker, Git, Node 20+, Credentials Binding, SSH Agent and Workspace Cleanup. Configure credentials `dockerhub-cred`, `server-ssh-key`, `postgres-password`, `admin-email` and `admin-password`. Set `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_DIR`, `CLIENT_ORIGIN`. The pipeline builds/pushes both images, optionally uploads the production Compose file and secrets to the target host. `PUBLIC_API_URL` and `jwt-secret` are no longer used.

GitHub Actions runs typecheck, frontend production build and API integration tests with a PostgreSQL service. Jenkins validates source/builds images; use the CI integration test status as a release gate.

## Migration from JSON deployments

Do not start a freshly seeded production stack over an old JSON deployment and expect records to move automatically. Back up the JSON volume, stop application writes, provision an empty PostgreSQL target and run `migrate` plus `import:json` validation/apply as described in `backend/README.md`. Do not seed before import. Review unsupported demo card orders and invalid records explicitly. Validate counts, totals and stock before switching traffic; retain the old volume.

Back up PostgreSQL with `pg_dump` and verify a restore before rollout. Never run `docker compose down -v` on production. After new database writes, rollback must retain PostgreSQL data and use compatible application/schema versions; returning to the stale JSON file loses those writes. The implementation has been tested locally; no production deployment is performed by editing these files.
