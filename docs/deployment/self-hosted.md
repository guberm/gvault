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

## Reverse proxy

See `infra/reverse-proxy/nginx.conf`.
