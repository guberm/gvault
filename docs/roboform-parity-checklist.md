# GVault RoboForm Parity Implementation Checklist

Companion checklist for: [`docs/roboform-parity-backlog.md`](./roboform-parity-backlog.md)  
Reference source: <https://www.roboform.com/manual>  
Target public service: `https://gvault.guber.dev`

## How to use this file

- Use `[x]` only for items that are implemented **and verified**.
- Use `[ ]` for not implemented, partial, or unverified items.
- If a feature is partially done, keep the parent unchecked and check only the verified sub-parts.
- Update the `Last verified` notes when a real build/run/device/browser proof is collected.
- Do not check UI-only stubs that are not backed by server/API/crypto where required.

## Current verified snapshot

Last updated: 2026-07-18

- [x] `gvault.guber.dev` resolves publicly to the intended service endpoint.
- [x] Web client can open at `https://gvault.guber.dev`.
- [x] Web client has login/register-first screen.
- [x] Web register/auth API traffic works through `https://gvault.guber.dev`.
- [x] Web can create at least one server-backed vault item through public DNS.
- [x] Android app has login/register-first screen.
- [x] Android app can login through `https://gvault.guber.dev` and reach server-backed vault state.
- [ ] Deployment is persistent across reboot/Caddy/service restart.
- [ ] Browser extension is a real server-backed login/fill client.
- [ ] Windows desktop is a real server-backed login/vault client.
- [ ] Linux client is a real server-backed CLI/GUI client.

---

# 0. Deployment and operations

- [x] Create DNS record for `gvault.guber.dev`.
- [x] `gvault.guber.dev` points to public IP instead of Cloudflare Tunnel-only route.
- [x] Public HTTPS returns GVault web UI.
- [x] Public auth/register API works through `https://gvault.guber.dev`.
- [ ] Persist reverse-proxy route in file-backed Caddy config or equivalent.
- [x] Run GVault server as a managed service. (#41; `gvault-public.service` verified active on 2026-07-17)
- [x] Run GVault web/proxy as a managed service. (#42; the managed public service serves API and Web assets)
- [ ] Remove dependence on ad-hoc SSH tunnels for production availability.
- [x] Verify service restart survival. (#44; controlled restart followed by local and public health checks)
- [ ] Verify host reboot survival.
- [ ] Verify TLS renewal path.
- [x] Define production data directory. (#47; `/home/mg/.local/share/gvault-data`, store mode `0600`)
- [ ] Implement backup/restore plan for server data.
- [x] Add unauthenticated health endpoint if monitoring requires it. (#49; local and public `/healthz` verified)
- [ ] Add deployment/runbook documentation.

---

# 1. Cross-client non-negotiables

- [x] Web first screen is login/register.
- [x] Android first screen is login/register.
- [ ] Browser extension first screen is login/register.
- [ ] Windows desktop first screen is login/register.
- [ ] Linux client has login/register entrypoint.
- [x] Web default/public server URL uses `https://gvault.guber.dev`.
- [x] Android can use `https://gvault.guber.dev`.
- [x] Extension default server URL uses `https://gvault.guber.dev`. (#54, #149, #480)
- [ ] Windows desktop default server URL uses `https://gvault.guber.dev`.
- [ ] Linux client default server URL uses `https://gvault.guber.dev`.
- [x] Web displayed vault data can come from server-backed records.
- [x] Android displayed vault data can come from server-backed records.
- [ ] Extension displayed/fill data comes from server-backed records.
- [ ] Windows desktop displayed data comes from server-backed records.
- [ ] Linux displayed data comes from server-backed records.
- [ ] All clients avoid fake/demo rows in production UI.
- [ ] All clients have logout.
- [ ] All clients handle auth failure.
- [ ] All clients handle server unavailable.
- [ ] All clients handle session expired.
- [ ] All sensitive UI claims are backed by real implementation.

---

# 2. Web client

## 2.1 Auth and session

- [x] Web opens at `https://gvault.guber.dev`.
- [x] Web shows login/register-first screen.
- [x] Registration exists on first screen.
- [x] Login UI points to `https://gvault.guber.dev`.
- [x] Register request works through public DNS.
- [ ] Existing-user login through UI is repeatedly verified after clean reload.
- [x] Logout returns to login/register screen. (#483; server token is revoked before Web credentials are cleared)
- [x] Reload after logout stays on login/register screen. (#483)
- [ ] Auth loading state.
- [ ] Auth error state for wrong password.
- [ ] Auth error state for server unavailable.
- [ ] Password visibility toggle.
- [ ] Password requirements messaging.
- [x] Session expired handling. (#483; rejected protected requests clear local session and vault state)

## 2.2 Core vault UI

- [x] Server-backed item creation was verified at least once.
- [ ] List all server-backed items.
- [ ] Item detail pane.
- [x] Create Login item.
- [ ] Edit Login item.
- [ ] Delete/trash Login item.
- [ ] Restore item from trash.
- [ ] Create Safenote.
- [ ] Create Bookmark.
- [ ] Create Identity.
- [ ] Create Contact.
- [ ] Create Card.
- [ ] Search vault items.
- [ ] Filter by item type.
- [ ] Real counts per category.
- [ ] Favorites.
- [x] Folders/collections. (#90; implementation/live proof in #263 and #264)
- [x] Tags. (#91; implementation/live proof in #265)
- [ ] Empty state.
- [ ] Loading/skeleton state.
- [ ] Save/sync status state.
- [ ] Sync error state.
- [ ] Last sync display from real data only.

## 2.3 Web password-manager UX

- [ ] Copy username.
- [ ] Copy password.
- [ ] Reveal/hide password.
- [ ] Re-auth before reveal/copy if configured.
- [ ] Auto-clear clipboard timer.
- [x] Password generator panel. (#102)
- [x] Use generated password in current item. (#103, PR #460)
- [x] Password strength indicator. (#104, PR #458)
- [ ] Keyboard shortcut for search.
- [ ] Keyboard shortcut for new item.
- [ ] Keyboard shortcut for save.
- [ ] Settings modal/page.
- [ ] Account modal/page.
- [x] Responsive mobile web layout. (#110, #480)
- [ ] Dark/light theme consistency.

---

# 3. Android client

## 3.1 Auth and session

- [x] Android app builds and installs on real device.
- [x] Android first screen is login/register.
- [x] Android manifest has network permission.
- [x] Android can login through `https://gvault.guber.dev`.
- [x] Android reaches connected/server-backed vault state after login.
- [x] Clean install defaults to `https://gvault.guber.dev` without manual correction.
- [x] Registration through Android is verified.
- [x] Wrong-password error state.
- [x] Server-unavailable error state.
- [x] Loading state during login/register.
- [x] Logout. (#483; physical-device flow also revokes the current server token)
- [x] App restart behavior is defined and verified. (#118; Keystore-backed Autofill cache clears on restart/sign-out and was verified on Pixel 7 Pro)
- [x] Local token/session storage policy is implemented.
- [ ] PIN unlock, if chosen.
- [ ] Biometric unlock, if chosen.

## 3.2 Android vault UI

- [x] Android can show at least one server-backed item after login.
- [x] Full item list screen.
- [x] Item detail screen.
- [x] Create Login item.
- [x] Edit Login item.
- [x] Delete/trash item.
- [x] Search.
- [x] Type filters/categories.
- [x] Favorites.
- [x] Pull-to-refresh.
- [x] Sync status.
- [x] Empty state.
- [x] Loading state.
- [x] Copy username/password.
- [x] Reveal/hide password.
- [x] Password generator.
- [x] Settings screen.
- [x] Account screen.
- [x] Material-style polish.

## 3.3 Android Autofill

- [x] Autofill service uses server-backed Login records.
- [x] Credential picker shows matching records.
- [x] Fill username/password into apps/browsers.
- [x] Identity autofill for address/contact forms.
- [x] Card autofill where appropriate.
- [x] No blank placeholder dataset.
- [x] Autofill setup guidance.
- [x] Real-device autofill proof.

---

# 4. Browser extension

## 4.1 Extension auth

- [ ] Popup first screen is login/register.
- [x] Default server URL is `https://gvault.guber.dev`. (#149, #480)
- [ ] Register from popup.
- [ ] Login from popup.
- [ ] Token/session storage in extension storage.
- [ ] Logout.
- [ ] Locked/unlocked/connected status.
- [ ] Auth error states.
- [ ] Chrome proof.
- [ ] Edge proof.

## 4.2 Extension vault/fill UX

- [ ] Pull vault records from server.
- [ ] Detect current tab/domain.
- [ ] Show matching credentials for current domain.
- [ ] One-click fill selected credential.
- [ ] Copy username/password from popup.
- [ ] Search vault from popup.
- [ ] Open full web vault button.
- [ ] Badge shows locked/unlocked/match count.
- [ ] Save-new-login prompt.
- [ ] Update-existing-login prompt.
- [ ] Generated-password save prompt.
- [ ] Context menu fill/save/generate/search actions.
- [ ] Per-site disabled/autofill rules.
- [ ] Multiple credentials per domain.
- [ ] Equivalent domain matching.

---

# 5. Windows desktop client

- [ ] Replace placeholder/stub copy.
- [ ] Login/register-first UI.
- [ ] Default server URL is `https://gvault.guber.dev`.
- [ ] Register via server API.
- [ ] Login via server API.
- [ ] Pull server-backed vault records.
- [ ] Vault list.
- [ ] Item detail.
- [ ] Create/edit/delete basic records.
- [ ] Search.
- [ ] Copy/reveal sensitive fields.
- [ ] Logout.
- [ ] Connected/sync/error status bar.
- [x] Settings/preferences. (#186, PR #457)
- [ ] Tray/taskbar icon.
- [ ] Tray quick search/recent/favorites.
- [ ] Build `.exe`.
- [ ] Windows smoke/login proof.

---

# 6. Linux client

- [ ] Decide CLI vs GUI as first-class target.
- [ ] If CLI: `gvault login`.
- [ ] If CLI: `gvault register`.
- [ ] If CLI: `gvault list`.
- [ ] If CLI: `gvault get`.
- [ ] If CLI: `gvault create`.
- [ ] If CLI: `gvault edit`.
- [ ] If CLI: `gvault delete`.
- [ ] If GUI: login/register-first UI.
- [ ] If GUI: vault list/detail/editor.
- [ ] Default server URL is `https://gvault.guber.dev`.
- [ ] Remove preview-only GitHub message.
- [ ] Build/package Linux client.
- [x] Linux smoke/login proof.

---

# 7. Data types and editors

## 7.1 Login

- [ ] Title.
- [ ] Username/email.
- [ ] Password.
- [ ] Website/URL list.
- [ ] Notes.
- [ ] Favorite.
- [ ] Folder/tags.
- [ ] Match rules.
- [ ] Password history, if supported.

## 7.2 Bookmark

- [ ] Title.
- [ ] URL.
- [ ] Notes.
- [ ] Open action.
- [ ] Favorite.
- [ ] Folder/tags.

## 7.3 Safenote

- [ ] Title.
- [ ] Body.
- [ ] Notes.
- [ ] Copy action.
- [ ] Folder/tags.

## 7.4 Identity

- [ ] Person section.
- [ ] Address section.
- [ ] Contact section.
- [ ] Business section.
- [ ] Passport/document section.
- [ ] Vehicle/car section, if desired.
- [ ] Custom fields.
- [ ] Use for form fill.

## 7.5 Contact

- [ ] Name.
- [ ] Email.
- [ ] Phone.
- [ ] Address.
- [ ] Organization.
- [ ] Notes.
- [ ] Explicitly not default autofill source.

## 7.6 Payment card

- [ ] Cardholder.
- [ ] Number.
- [ ] Expiry.
- [ ] CVV.
- [ ] Billing address.
- [ ] Reveal/copy protections.
- [ ] Form fill support.

## 7.7 Bank account

- [ ] Bank name.
- [ ] Account number.
- [ ] Routing/IBAN/SWIFT fields as applicable.
- [ ] Notes.
- [ ] Reveal/copy protections.

## 7.8 Application

- [ ] App name/path/identifier.
- [ ] Username/password if applicable.
- [ ] Launch/open action where supported.
- [ ] Fill semantics only if platform supports it.

## 7.9 Authenticator/TOTP

- [x] TOTP secret storage. (#256, PR #469)
- [x] Manual secret entry. (#257)
- [x] QR add where platform supports it. (#258, PR #471)
- [x] Current code display.
- [x] Countdown.
- [x] Copy code.
- [x] Link TOTP to Login. (#262, PR #467)

---

# 8. Organization

- [x] Folders.
- [x] Nested folders or collections. (#264, PR #476)
- [x] Tags. (#265, PR #478)
- [ ] Favorites.
- [ ] Trash/archive.
- [ ] Restore from trash.
- [ ] Permanent delete.
- [ ] Bulk move.
- [ ] Bulk delete.
- [ ] Sort A-Z.
- [ ] Sort by recent.
- [ ] Sort by type.
- [ ] Sort by favorite.

---

# 9. Form filling and autosave

- [x] Browser login form detection.
- [x] Browser identity/address form detection.
- [x] Browser card/payment form detection.
- [x] Android login form detection via Autofill.
- [x] Android identity/card fill via Autofill.
- [x] Save-new-login prompt.
- [x] Update-password prompt.
- [x] Autosave enable/disable setting.
- [x] Autofill enable/disable setting.
- [x] Per-domain disabled list.
- [x] Fill prompt behavior setting.
- [x] Multiple-match chooser.
- [x] No-match state.
- [x] Equivalent domains.
- [x] Subdomain match rules.
- [x] Per-item URL match controls.

---

# 10. Generator and security tools

## 10.1 Password generator

- [x] Length control.
- [x] Uppercase toggle.
- [x] Lowercase toggle.
- [x] Numbers toggle.
- [x] Symbols toggle.
- [x] Exclude ambiguous characters.
- [x] Passphrase mode.
- [x] Strength indicator.
- [x] Copy generated password.
- [x] Use generated password in editor.
- [x] Fill generated password into a visible browser password field authorized by a trusted direct pointer gesture on that exact field (one field per action; no label-forwarded click, focus-event trust, or field scanning; focus, visibility, and topmost hit-testing revalidated at fill time).
- [x] Save generated password as Login.

## 10.2 Security Center

- [ ] Security score.
- [ ] Weak password detection.
- [ ] Reused password detection.
- [ ] Duplicate password detection.
- [ ] Old/stale password detection.
- [ ] Compromised password detection with real breach source only.
- [ ] Affected items list.
- [ ] Fix action: open item.
- [ ] Fix action: generate replacement.
- [ ] Fix action: update/save changed password.

## 10.3 Authenticator

- [ ] TOTP item type.
- [ ] Code display/copy.
- [ ] Countdown.
- [ ] Browser fill/copy current TOTP for matching login.
- [ ] Mobile TOTP display/copy.

---

# 11. Sharing and recovery

## 11.1 Sharing/Sending

- [ ] Sharing crypto design documented.
- [ ] Public/private key material support.
- [ ] Share item with another user.
- [ ] Send one-time item, if chosen.
- [ ] Permission levels.
- [ ] Accept share.
- [ ] Decline share.
- [ ] Revoke share.
- [ ] Shared with me view.
- [ ] Shared by me view.
- [ ] Shared indicators on items.
- [ ] Audit/status UI.

## 11.2 Emergency Access

- [ ] Emergency access crypto/workflow design documented.
- [ ] Add trusted contact.
- [ ] Waiting period setting.
- [ ] Request emergency access.
- [ ] Approve request.
- [ ] Deny request.
- [ ] Cancel request.
- [ ] Notifications/status.
- [ ] Audit trail.
- [ ] Clear recovery limitations.

---

# 12. Import/export/backup/restore

- [x] RoboForm import.
- [x] CSV import.
- [x] Bitwarden import.
- [x] 1Password import.
- [ ] Field mapping preview.
- [ ] Duplicate handling.
- [ ] Import validation.
- [ ] Encrypted export.
- [ ] Plaintext export warning.
- [ ] Backup snapshot.
- [ ] Restore from backup.
- [ ] Restore validation.
- [ ] Master-password recovery/reset policy.
- [ ] No misleading claim that lost encrypted secrets can be decrypted.

---

# 13. Settings

## 13.1 General/account

- [ ] Server URL setting.
- [ ] Account email display.
- [ ] Theme setting.
- [ ] Startup behavior.
- [ ] Diagnostics.
- [ ] Version/build info.
- [ ] Logout.
- [ ] Delete local session/cache.
- [ ] Delete account, if supported.

## 13.2 Security

- [ ] Auto-lock.
- [ ] Lock timeout.
- [ ] Clipboard clear timeout.
- [ ] Require re-auth for sensitive actions.
- [ ] PIN unlock setting.
- [ ] Biometric unlock setting.
- [x] Device/session management. (#483; bounded list/revoke/logout APIs and shared API client)
- [x] Revoke device/session. (#371, #483)

## 13.3 Browser/autofill/autosave

- [ ] Browser integration toggles.
- [ ] Toolbar/popup behavior.
- [ ] Autofill prompt setting.
- [ ] Autosave prompt setting.
- [ ] Context menu setting.
- [ ] Domain disabled list.
- [ ] Equivalent domains management.

## 13.4 Search/keyboard/advanced

- [ ] Search behavior settings.
- [ ] Keyboard shortcuts.
- [ ] Command palette.
- [ ] Advanced diagnostics.
- [ ] Reset local cache.
- [ ] Export logs without secrets.

---

# 14. Security architecture and documentation

- [x] Encryption model documented. — [`docs/security/encryption-model.md`](./security/encryption-model.md)
- [x] Authentication model documented. — [`docs/security/authentication-model.md`](./security/authentication-model.md)
- [ ] Zero-knowledge boundary documented.
- [x] Master password handling documented. (#388, #500; regular login separated from registration and local vault restoration)
- [ ] Key derivation documented.
- [x] Device/session token model documented. (#390, #483; [`docs/security/authentication-model.md`](./security/authentication-model.md))
- [ ] Secure sharing crypto documented.
- [ ] Backup/restore security documented.
- [x] Recovery limitations documented.
- [x] Threat model documented.
- [x] UI copy reviewed so it does not claim unimplemented security.
- [x] Tests for crypto envelope.
- [x] Tests for sync/auth boundaries.

---

# 15. Proof and E2E

- [x] Web E2E through `https://gvault.guber.dev`.
- [x] Android real-device E2E through `https://gvault.guber.dev`.
- [x] Chrome extension E2E.
- [x] Edge extension E2E.
- [x] Windows desktop login smoke.
- [x] Linux client login smoke.
- [x] Server integration tests.
- [x] Import/export tests.
- [x] Autofill tests where feasible.
- [x] Final proof report separates passed/partial/blocked: [`docs/roboform-parity-proof-report.md`](./roboform-parity-proof-report.md).

---

# 16. Repository audit follow-ups

Audit report: [`docs/repository-audit-2026-07-17.md`](./repository-audit-2026-07-17.md)

- [x] #483 Server session expiry, revocation, logout, and bounded lifecycle.
- [x] #484 Android encrypted Autofill storage and physical-device restart/lock proof. (Pixel 7 Pro, Android 17/API 37)
- [x] #485 Request-size bounds, stable malformed/oversized 4xx responses, pre-scrypt account/source rate limits, and explicit trusted-proxy handling. (Current Cloudflare Tunnel preserves forged `X-Forwarded-For`, so production safely keeps `GV_TRUST_PROXY=false`.)
- [x] #486 One cross-client minimum master-password policy, including Android device proof. (11 rejected, 12 accepted on Pixel 7 Pro)
- [x] #487 Web blank account-password validation without a fallback credential. (PRs #495/#496; live commit `43eb1b8` verified with zero auth requests)
- [x] #488 Canonical Android `VaultItem` timestamps and cross-client compatibility. (device-created live record accepted by shared validator)
- [x] #489 Dot-boundary-safe URL matching for lookalike domains. (v0.1.15 exact/subdomain acceptance plus sibling and parent-suffix rejection)
- [x] #490 Durable, validated, concurrency-safe server storage. (v0.1.16 schema validation, serialized writers, atomic fsync/rollback recovery, multi-process tests, and operator runbook)
- [x] #491 Production CSP and browser security headers. (v0.1.17 shared response policy plus v0.1.18 HTML `no-transform`, five-route header proof, and zero-error live Chromium acceptance)
- [x] #492 Mandatory CI and deterministic cross-browser gates. (v0.1.19 protected `main`: isolated quality, real Chrome/Edge/Firefox, signed Android APK, dependency audit, artifact checks, and physical-device acceptance)
- [ ] #493 Versioned, interoperable KDF metadata across shared, Web, and Android clients.
- [ ] #494 Revision-first sync merge semantics.
- [x] #500 Regular account login separated from master-password registration and local vault restoration.
- [x] #501 Zero-knowledge account-password recovery with a master-protected recovery token.
