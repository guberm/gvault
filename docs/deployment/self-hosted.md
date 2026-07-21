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
| `GV_JSON_BODY_LIMIT_BYTES` | `1048576` | Maximum actual or declared JSON request-body bytes |
| `GV_TRUST_PROXY` | `false` | Trust the first `X-Forwarded-For` address; enable only behind a sanitizing trusted proxy |
| `GV_AUTH_WINDOW_MS` | `60000` | Fixed authentication rate-limit window in milliseconds |
| `GV_AUTH_ACCOUNT_LIMIT` | `20` | Authentication attempts allowed per normalized account identifier per window |
| `GV_AUTH_ORIGIN_LIMIT` | `100` | Authentication attempts allowed per request source per window |
| `GV_SESSION_TTL_MS` | `86400000` | Fixed bearer-session lifetime in milliseconds |
| `GV_SESSION_MAX_PER_USER` | `10` | Newest active sessions retained per user |
| `GV_SESSION_MAX_TOTAL` | `10000` | Active-session capacity for one server process |

Session settings must be positive integers. Expired and capacity-evicted tokens
are rejected with `401 Unauthorized`. Sessions are held in memory, so every
server restart invalidates all active tokens.

JSON routes reject a declared or streamed body above
`GV_JSON_BODY_LIMIT_BYTES` with `413 Request body too large`; malformed JSON is
rejected with `400 Malformed JSON`. Authentication work that can reach
synchronous `scrypt` is guarded by independent account and source fixed-window
limits. Registration, login, and authenticated recovery setup share those
buckets; recovery completion retains its stricter recovery-specific limiter.
The buckets are process-local and reset on restart, so a multi-instance
deployment needs an external distributed limiter and monitoring. Each limiter
retains at most 10,000 active keys and evicts the oldest key at capacity.

By default, the source is the direct socket address and any client-supplied
`X-Forwarded-For` value is ignored. Set `GV_TRUST_PROXY=true` only when the Node
server cannot be reached except through a trusted reverse proxy that overwrites
`X-Forwarded-For`. The supplied nginx example uses `$remote_addr` for that
reason. Do not combine trusted-proxy mode with an Internet-reachable Node port.

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

## Verified abuse-control deployment (2026-07-21)

- Production checkout and `gvault-public.service` run exact merge commit
  `a35811fa29c940b0cc3bee245911b155e355d799` (v0.1.14).
- The managed service applies a 1 MiB JSON limit, a 60-second authentication
  window, per-account limit 20, and per-source limit 100.
- `cloudflared-gvault.service` is the sole public route to
  `http://127.0.0.1:55174`, but live spoof testing proved that this tunnel
  preserves a client-supplied `X-Forwarded-For` value. Production therefore
  keeps `GV_TRUST_PROXY=false`, ignores that header, and uses the direct
  loopback source for the process-local source bucket. Consequently,
  `GV_AUTH_ORIGIN_LIMIT=100` is one tunnel-wide bucket rather than a per-client
  limit. Enforce per-client limits at the Cloudflare edge, or put a trusted
  proxy that overwrites the client-address header in front of Node; retain
  `GV_TRUST_PROXY=false` for the current tunnel until one of those controls is
  in place.
- Public acceptance returned JSON `400` for malformed input, `413` for both
  declared and chunked oversized bodies, `429` after the account limit, and
  `200` for an independent account login. The managed process stayed active
  with zero post-deploy crash markers.

## Reverse proxy

See `infra/reverse-proxy/nginx.conf`. Its 1 MiB ingress limit matches the server
default; keep the proxy and `GV_JSON_BODY_LIMIT_BYTES` settings aligned if either
is changed.
