# Self-hosted Deployment

## Requirements

- Node.js 22+ for local development.
- Docker and Docker Compose for container deployment.
- A reverse proxy that terminates HTTPS in production.

## Environment

| Variable | Default | Description |
| --- | --- | --- |
| `GV_SERVER_HOST` | `127.0.0.1` | Server bind host |
| `GV_SERVER_PORT` | `8080` | Server port |
| `GV_DATA_DIR` | `./data` | Persistent storage directory |
| `GV_ALLOWED_ORIGINS` | `*` | Comma-separated CORS allowlist |

## Backup

Authenticated users can call `POST /api/backup/export`. The export includes encrypted vault records, devices, and non-secret account metadata.

Restore uses `POST /api/backup/import` with a server-local backup path.

This is a low-level prototype path, not a complete restore plan. Import currently
trusts an authenticated caller-supplied server-local path, appends records without
schema/envelope or duplicate validation, and has no transactional rollback.
Duplicate handling, import validation, restore workflow/validation, and the
dedicated security contract remain tracked by #346, #347, #351, #352, and #392.

## Verified public deployment snapshot (2026-07-17)

- Public endpoint: `https://gvault.guber.dev` on host `24.150.94.103`.
- Managed user service: `gvault-public.service`.
- Production checkout: `/home/mg/.local/share/gvault-public`.
- Production data directory: `/home/mg/.local/share/gvault-data`.
- Store file mode: `0600`.
- Controlled service restart followed by successful local and public `/healthz`
  checks.

This snapshot does not prove host-reboot survival, TLS renewal, or a complete
backup/restore runbook; those checklist items remain open.

## Reverse proxy

See `infra/reverse-proxy/nginx.conf`.
