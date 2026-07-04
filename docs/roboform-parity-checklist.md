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

Last updated: 2026-07-03

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
- [ ] Run GVault server as a managed service.
- [ ] Run GVault web/proxy as a managed service.
- [ ] Remove dependence on ad-hoc SSH tunnels for production availability.
- [ ] Verify service restart survival.
- [ ] Verify host reboot survival.
- [ ] Verify TLS renewal path.
- [ ] Define production data directory.
- [ ] Implement backup/restore plan for server data.
- [ ] Add unauthenticated health endpoint if monitoring requires it.
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
- [ ] Extension default server URL uses `https://gvault.guber.dev`.
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
- [ ] Logout returns to login/register screen.
- [ ] Reload after logout stays on login/register screen.
- [ ] Auth loading state.
- [ ] Auth error state for wrong password.
- [ ] Auth error state for server unavailable.
- [ ] Password visibility toggle.
- [ ] Password requirements messaging.
- [ ] Session expired handling.

## 2.2 Core vault UI

- [x] Server-backed item creation was verified at least once.
- [ ] List all server-backed items.
- [ ] Item detail pane.
- [ ] Create Login item.
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
- [ ] Folders/collections.
- [ ] Tags.
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
- [ ] Password generator panel.
- [ ] Use generated password in current item.
- [ ] Password strength indicator.
- [ ] Keyboard shortcut for search.
- [ ] Keyboard shortcut for new item.
- [ ] Keyboard shortcut for save.
- [ ] Settings modal/page.
- [ ] Account modal/page.
- [ ] Responsive mobile web layout.
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
- [ ] Loading state during login/register.
- [ ] Logout.
- [ ] App restart behavior is defined and verified.
- [ ] Local token/session storage policy is implemented.
- [ ] PIN unlock, if chosen.
- [ ] Biometric unlock, if chosen.

## 3.2 Android vault UI

- [x] Android can show at least one server-backed item after login.
- [ ] Full item list screen.
- [ ] Item detail screen.
- [ ] Create Login item.
- [ ] Edit Login item.
- [ ] Delete/trash item.
- [ ] Search.
- [ ] Type filters/categories.
- [ ] Favorites.
- [ ] Pull-to-refresh.
- [x] Sync status.
- [x] Empty state.
- [ ] Loading state.
- [ ] Copy username/password.
- [ ] Reveal/hide password.
- [ ] Password generator.
- [ ] Settings screen.
- [x] Account screen.
- [ ] Material-style polish.

## 3.3 Android Autofill

- [ ] Autofill service uses server-backed Login records.
- [ ] Credential picker shows matching records.
- [ ] Fill username/password into apps/browsers.
- [ ] Identity autofill for address/contact forms.
- [ ] Card autofill where appropriate.
- [ ] No blank placeholder dataset.
- [ ] Autofill setup guidance.
- [ ] Real-device autofill proof.

---

# 4. Browser extension

## 4.1 Extension auth

- [ ] Popup first screen is login/register.
- [ ] Default server URL is `https://gvault.guber.dev`.
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
- [ ] Settings/preferences.
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
- [ ] Linux smoke/login proof.

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

- [ ] TOTP secret storage.
- [ ] Manual secret entry.
- [ ] QR add where platform supports it.
- [ ] Current code display.
- [ ] Countdown.
- [ ] Copy code.
- [ ] Link TOTP to Login.

---

# 8. Organization

- [ ] Folders.
- [ ] Nested folders or collections.
- [ ] Tags.
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

- [ ] Browser login form detection.
- [ ] Browser identity/address form detection.
- [ ] Browser card/payment form detection.
- [ ] Android login form detection via Autofill.
- [ ] Android identity/card fill via Autofill.
- [ ] Save-new-login prompt.
- [ ] Update-password prompt.
- [ ] Autosave enable/disable setting.
- [ ] Autofill enable/disable setting.
- [ ] Per-domain disabled list.
- [ ] Fill prompt behavior setting.
- [ ] Multiple-match chooser.
- [ ] No-match state.
- [ ] Equivalent domains.
- [ ] Subdomain match rules.
- [ ] Per-item URL match controls.

---

# 10. Generator and security tools

## 10.1 Password generator

- [ ] Length control.
- [ ] Uppercase toggle.
- [ ] Lowercase toggle.
- [ ] Numbers toggle.
- [ ] Symbols toggle.
- [ ] Exclude ambiguous characters.
- [ ] Passphrase mode.
- [ ] Strength indicator.
- [ ] Copy generated password.
- [ ] Use generated password in editor.
- [ ] Fill generated password into browser form.
- [ ] Save generated password as Login.

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
- [ ] Device/session management.
- [ ] Revoke device/session.

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

- [ ] Encryption model documented.
- [ ] Authentication model documented.
- [ ] Zero-knowledge boundary documented.
- [ ] Master password handling documented.
- [ ] Key derivation documented.
- [ ] Device/session token model documented.
- [ ] Secure sharing crypto documented.
- [ ] Backup/restore security documented.
- [ ] Recovery limitations documented.
- [ ] Threat model documented.
- [ ] UI copy reviewed so it does not claim unimplemented security.
- [ ] Tests for crypto envelope.
- [ ] Tests for sync/auth boundaries.

---

# 15. Proof and E2E

- [ ] Web E2E through `https://gvault.guber.dev`.
- [ ] Android real-device E2E through `https://gvault.guber.dev`.
- [ ] Chrome extension E2E.
- [ ] Edge extension E2E.
- [ ] Windows desktop login smoke.
- [ ] Linux client login smoke.
- [ ] Server integration tests.
- [ ] Import/export tests.
- [ ] Autofill tests where feasible.
- [ ] Final proof report separates passed/partial/blocked.
