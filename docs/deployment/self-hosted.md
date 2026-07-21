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

## Public Web security headers

`scripts/dev/serve-public.mjs` applies the production browser policy before
routing every request, so HTML, static assets, `/healthz`, and `/api/*`
responses share the same headers. The policy restricts scripts and styles to
the same origin; blocks framing, plugins, referrers, and unused powerful APIs;
enables one-year HSTS and `nosniff`; permits same-origin clipboard write; and
allows HTTPS connections for a separately configured self-hosted server URL.
QR enrollment scans uploaded images and therefore does not require camera
permission.

HSTS is honored by browsers only over HTTPS. Keep TLS termination in front of
the built-in public wrapper, and preserve an equivalent policy when replacing
that wrapper with a custom static host. Verify the effective public response,
not only proxy configuration, for example:

```sh
curl --silent --show-error --dump-header - --output /dev/null https://vault.example.com/
curl --silent --show-error --dump-header - --output /dev/null https://vault.example.com/app.js
curl --silent --show-error --dump-header - --output /dev/null https://vault.example.com/healthz
```

## Durable JSON store

`GV_DATA_DIR/gvault-store.json` is the primary schema-v1 store. Every mutation
holds `gvault-store.json.lock`, validates the current state, writes through a
unique temporary file, fsyncs it, atomically replaces the primary, and fsyncs
the data directory. Before replacement, the last valid primary is atomically
copied to `gvault-store.json.bak`. All three files are local-node state and must
live on a filesystem with local atomic rename semantics; do not share this data
directory between hosts.

The lock contains the local writer PID and a random ownership token. A later
writer removes it only when that PID is no longer alive. An interrupted writer
that leaves incomplete lock metadata is treated as stale after 10 seconds. A
live writer is never preempted; callers fail after a 10-second acquisition
timeout rather than writing concurrently.

Reads accept only schema version 1 and validate users, recovery envelopes,
devices, and encrypted-record shapes. If the primary is malformed but the
rollback snapshot is valid, the server emits a recovery warning and reads the
rollback. The next successful mutation repairs the primary without replacing
that valid rollback. If neither file validates, startup or the request fails
closed; never replace both copies before preserving incident evidence.

### Operator backup

Use a filesystem backup in addition to the per-mutation rollback snapshot. The
following offline procedure gives one exact point-in-time file. Set
`HEALTH_URL` to the managed listener when it differs from the default; the
verified public deployment below uses `http://127.0.0.1:55174/healthz`.

```sh
set -eu
DATA_DIR=/home/mg/.local/share/gvault-data
BACKUP_DIR="$DATA_DIR/operator-backups"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${GV_SERVER_PORT:-8080}/healthz}"
SERVICE_STOPPED=0
restart_if_needed() {
  status=$?
  trap - EXIT HUP INT TERM
  if [ "$SERVICE_STOPPED" -eq 1 ]; then systemctl --user start gvault-public.service || true; fi
  exit "$status"
}
trap restart_if_needed EXIT HUP INT TERM
systemctl --user stop gvault-public.service
SERVICE_STOPPED=1
install -d -m 700 "$BACKUP_DIR"
install -m 600 "$DATA_DIR/gvault-store.json" "$BACKUP_DIR/gvault-store-$STAMP.json"
systemctl --user start gvault-public.service
SERVICE_STOPPED=0
curl --fail --silent "$HEALTH_URL"
trap - EXIT HUP INT TERM
```

Store copies on separate encrypted media according to the operator's retention
policy. They contain account hashes, device metadata, recovery envelopes, and
client-encrypted vault records; treat them as sensitive even though vault item
plaintext is not present.

Validate a candidate without exposing its contents by staging it under the
expected filename and invoking the production validator:

```sh
set -eu
CANDIDATE=/path/to/gvault-store-backup.json
CHECK_DIR="$(mktemp -d)"
trap 'rm -rf "$CHECK_DIR"' EXIT HUP INT TERM
install -m 600 "$CANDIDATE" "$CHECK_DIR/gvault-store.json"
GV_CHECK_DIR="$CHECK_DIR" node --input-type=module -e \
  'import { JsonStore } from "./apps/server/dist/storage.js"; new JsonStore(process.env.GV_CHECK_DIR).read(); console.log("schema-v1 valid")'
```

### Operator restore

The restore procedure stages the candidate once, validates that exact staged
file, then stops the only writer. It preserves the current primary, rollback,
and lock as incident evidence. Any failure after the live primary is replaced
automatically reinstalls the preserved primary before restarting the service.

```sh
set -eu
DATA_DIR=/home/mg/.local/share/gvault-data
CANDIDATE=/path/to/gvault-store-backup.json
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${GV_SERVER_PORT:-8080}/healthz}"
STAGE_DIR="$(mktemp -d)"
STAGED_STORE="$STAGE_DIR/gvault-store.json"
INCIDENT_DIR="$DATA_DIR/incidents/$(date -u +%Y%m%dT%H%M%SZ)"
SERVICE_STOPPED=0
ROLLBACK_REQUIRED=0
restore_cleanup() {
  status=$?
  trap - EXIT HUP INT TERM
  if [ "$ROLLBACK_REQUIRED" -eq 1 ]; then
    systemctl --user stop gvault-public.service || true
    install -m 600 "$INCIDENT_DIR/gvault-store.json" "$DATA_DIR/gvault-store.json" || true
    if [ -e "$INCIDENT_DIR/gvault-store.json.bak" ]; then
      install -m 600 "$INCIDENT_DIR/gvault-store.json.bak" "$DATA_DIR/gvault-store.json.bak" || true
    else
      rm -f "$DATA_DIR/gvault-store.json.bak"
    fi
    rm -f "$DATA_DIR/gvault-store.json.lock" "$DATA_DIR/gvault-store.json.restore"
    systemctl --user start gvault-public.service || true
  elif [ "$SERVICE_STOPPED" -eq 1 ]; then
    systemctl --user start gvault-public.service || true
  fi
  rm -rf "$STAGE_DIR"
  exit "$status"
}
trap restore_cleanup EXIT HUP INT TERM
install -m 600 "$CANDIDATE" "$STAGED_STORE"
GV_CHECK_DIR="$STAGE_DIR" node --input-type=module -e \
  'import { JsonStore } from "./apps/server/dist/storage.js"; new JsonStore(process.env.GV_CHECK_DIR).read(); console.log("schema-v1 valid")'
systemctl --user stop gvault-public.service
SERVICE_STOPPED=1
install -d -m 700 "$INCIDENT_DIR"
install -m 600 "$DATA_DIR/gvault-store.json" "$INCIDENT_DIR/gvault-store.json"
for file in gvault-store.json.bak gvault-store.json.lock; do
  if [ -e "$DATA_DIR/$file" ]; then install -m 600 "$DATA_DIR/$file" "$INCIDENT_DIR/$file"; fi
done
ROLLBACK_REQUIRED=1
install -m 600 "$STAGED_STORE" "$DATA_DIR/gvault-store.json.restore"
mv -f "$DATA_DIR/gvault-store.json.restore" "$DATA_DIR/gvault-store.json"
rm -f "$DATA_DIR/gvault-store.json.bak" "$DATA_DIR/gvault-store.json.lock"
systemctl --user start gvault-public.service
SERVICE_STOPPED=0
curl --fail --silent "$HEALTH_URL"
ROLLBACK_REQUIRED=0
trap - EXIT HUP INT TERM
rm -rf "$STAGE_DIR"
```

After health passes, perform an authenticated login and sync pull for a known
account. Roll back by stopping the service and reinstalling the preserved
primary only if that preserved file validates. These filesystem procedures
restore the whole server state; the authenticated backup API below restores
only encrypted records into one account and has separate known limitations.

## Backup API

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
