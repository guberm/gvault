# GVault RoboForm Parity Backlog

Source of truth for this backlog: <https://www.roboform.com/manual>

Created: 2026-07-03  
Target public service: `https://gvault.guber.dev`

## Purpose

This document tracks the feature/UI/product work required for GVault to reach RoboForm-like parity.

The goal is not to copy RoboForm branding or implementation. The goal is to make sure GVault covers the same password-manager product surface:

- login/register-first clients
- server-backed vault data only
- browser and mobile autofill
- full vault item taxonomy
- secure sharing/recovery/security center
- settings, sync, devices, import/export, and platform-specific UX

## Current GVault status snapshot

This is a working snapshot, not a final product claim.

| Surface | Current status | Gap |
|---|---|---|
| Web | Login/register via `https://gvault.guber.dev` works; server-backed register/item flow was verified | Needs complete vault UI, settings, item types, edit/delete/search/filter polish, persistent deployment |
| Android | Login-first UI exists; login through `https://gvault.guber.dev` was verified into server-backed vault state | Needs create/edit/delete/search, polished mobile UI, autofill integration, biometric/local unlock, restart/session handling |
| Browser extension | Existing extension is mostly manual/session fill helper | Needs real login/register, vault pull, current-domain suggestions, one-click fill, save/update prompts |
| Windows desktop | Stub/placeholder app | Needs real login/register client, vault list/detail/editor, tray/taskbar UX |
| Linux desktop/CLI | Stub/preview | Needs decision: CLI or GUI, then real login/register/list/get/create/edit/delete |
| Deployment | `gvault.guber.dev` works through live route/proxy path | Needs persistence: Caddy/service setup, server/web/proxy as services, restart proof |

## Non-negotiable product rules

1. First screen for clients must be login/register, not a fake vault.
2. Default server URL must be `https://gvault.guber.dev`.
3. Displayed vault data must come from the server, not demo/local fake rows.
4. UI must not claim a feature is secure/available until backend + crypto + verification exist.
5. Each client must have proof: build/run plus actual login/sync or documented blocker.
6. `guber.dev` must not be changed for this project; use `gvault.guber.dev` only.

## Client coverage legend

- Web = browser web vault at `gvault.guber.dev`
- Android = Android app + Android Autofill service
- Ext = browser extension for Chrome/Edge
- Win = Windows desktop app
- Linux = Linux desktop or CLI client
- Server = backend/API/storage/crypto support

---

# Feature backlog by RoboForm manual

## Chapter 1 — Installation and Account Setup

### Required product capabilities

- First-run welcome/onboarding screen.
- Create account flow.
- Login existing account flow.
- Master password UX:
  - password requirements
  - confirmation for registration
  - clear error messages
  - no fake local unlock before server auth exists
- Account-created confirmation.
- Optional local unlock method where supported:
  - PIN
  - biometrics
  - platform keychain/secure storage
- Autofill enablement guidance:
  - Android: guide user to enable Android Autofill service
  - Browser: guide user to install/pin extension
- Logout/session reset.
- Session expired handling.
- Server unavailable handling.

### Client coverage

| Client | Needed |
|---|---|
| Web | Auth-first screen, registration, login, logout, error/loading states |
| Android | Auth-first screen, registration, login, local unlock option, autofill setup guidance |
| Ext | Login/register popup; extension onboarding/pin guidance |
| Win | Login/register-first desktop UI |
| Linux | CLI/GUI login/register onboarding |
| Server | auth endpoints, session/token lifecycle, password policy |

---

## Chapter 2 — Key RoboForm Terms / Data Taxonomy

### Required item types

GVault must support these first-class record types:

- Login
- Bookmark
- Application
- Identity
- Contact
- Safenote
- Folder / collection
- Card / payment card
- Bank account
- Passport / document
- Business profile
- Vehicle / car profile, if identity parity is desired
- Authenticator/TOTP item

### Required taxonomy rules

- Logins are for websites/apps with credentials.
- Bookmarks are URLs without credentials.
- Contacts are lookup records and should not be auto-filled by default.
- Identities are form-fill profiles.
- Safenotes are encrypted free-form notes.
- Applications are desktop/app entries, separate from website logins.
- Folders/tags organize records.
- Record type drives editor fields, icons, search filters, and autofill behavior.

### Client coverage

| Client | Needed |
|---|---|
| Web | Full taxonomy in sidebar, create/edit forms per type |
| Android | Type filters and editors for core types |
| Ext | Use Login/Identity/Card types for fill suggestions |
| Win | Editor/list grouped by type |
| Linux | CLI commands must expose type |
| Server | schema for all types, encrypted payload compatibility |

---

## Chapter 3 — Browser Integration

### Required product capabilities

- Browser extension install/pin onboarding.
- Extension popup login/register.
- Connected/unconnected/locked status in popup.
- Current page/domain detection.
- Matching credentials for current site.
- One-click login/fill.
- Fill selected login into current page.
- Search full vault from popup.
- Copy username/password from popup.
- Open full web vault button.
- Save-new-login prompt after successful login form submission.
- Update-existing-login prompt after password change.
- Generated-password save prompt.
- Browser action badge:
  - locked
  - unlocked
  - number of matching credentials
- Chrome and Edge parity.
- Context menu actions where browser APIs allow it.

### Client coverage

| Client | Needed |
|---|---|
| Ext | Main implementation surface |
| Web | Open-from-extension target and settings |
| Server | auth/sync APIs; maybe item domain matching metadata |

---

## Chapter 4 — Logins

### Required product capabilities

- Create Login manually.
- Save Login from browser form.
- Update existing Login when password changes.
- Use Login to:
  - open website
  - fill username/password
  - submit only if intentionally supported/configured
- Multiple credentials per domain.
- Domain matching and equivalent domain rules.
- Per-login URL list / match rules.
- Favorite/unfavorite.
- Copy username.
- Copy password.
- Reveal/hide password.
- Re-auth before reveal/copy if configured.
- Password history if supported.
- Trash/delete/restore.

### Client coverage

| Client | Needed |
|---|---|
| Web | Full login editor/detail/list |
| Android | Login list/detail/create/edit/copy/reveal |
| Ext | Save/fill/update login flows |
| Win | Login list/detail/editor |
| Linux | login list/get/create/edit/delete commands |
| Server | encrypted login record schema and sync |

---

## Chapter 5 — Bookmarks

### Required product capabilities

- Create Bookmark manually.
- Save Bookmark from browser.
- Open Bookmark.
- Edit Bookmark URL/title/notes/folder/tags.
- Keep Bookmarks visually separate from Logins.
- Search/filter Bookmarks.
- Favorite Bookmark.

### Client coverage

| Client | Needed |
|---|---|
| Web | Bookmark list/editor/open action |
| Android | Bookmark view/open action |
| Ext | Save/open bookmark from current tab |
| Win | Bookmark editor/open action |
| Linux | bookmark list/open/create/edit commands |
| Server | encrypted bookmark record schema |

---

## Chapter 6 — Safenotes

### Required product capabilities

- Create Safenote.
- View Safenote.
- Edit Safenote.
- Search Safenote content if safely supported client-side after decrypt.
- Copy note content.
- Share/send Safenote when sharing exists.
- Delete/trash/restore Safenote.
- Folder/tag support.
- Long text support.

### Client coverage

| Client | Needed |
|---|---|
| Web | Safenote editor/detail/list |
| Android | Safenote editor/detail/list |
| Ext | Search/copy/open Safenote, not autofill by default |
| Win | Safenote editor |
| Linux | safenote commands |
| Server | encrypted safenote payload |

---

## Chapter 7 — Identities

### Required product capabilities

Identity is a form-fill profile, not just a note.

Required sections/field groups:

- Person:
  - first name
  - middle name
  - last name
  - display name
  - date of birth, if supported
- Address:
  - street
  - city
  - state/region
  - postal code
  - country
- Contact:
  - email
  - phone
- Credit card / payment card:
  - cardholder
  - number
  - expiry
  - CVV, with reveal/copy protections
- Bank account:
  - bank name
  - routing/IBAN/etc. as applicable
  - account number
- Business:
  - company name
  - title
  - business address/contact
- Passport/document:
  - document number
  - issue/expiry
  - country
- Vehicle/car, if implementing full RoboForm-style identity parity.
- Custom fields.

### Required behaviors

- Use Identity to fill non-password forms:
  - checkout
  - signup
  - contact forms
  - address forms
- Browser extension identity fill suggestions.
- Android Autofill identity fill support.
- User must choose which identity/card to fill.

### Client coverage

| Client | Needed |
|---|---|
| Web | Identity editor and custom fields |
| Android | Identity editor and Autofill support |
| Ext | Fill identity/card forms |
| Win | Identity/contact editor |
| Linux | identity CRUD commands |
| Server | encrypted structured identity schema |

---

## Chapter 8 — RoboForm Editor

### Required product capabilities

- Unified vault editor.
- All tab showing all items.
- Type tabs:
  - Logins
  - Bookmarks
  - Applications
  - Identities
  - Contacts
  - Safenotes
  - Authenticator
  - Shared
  - Security Center
- Item-specific editor forms.
- Create/edit/delete/move/copy actions.
- Fill forms from editor where platform supports it.
- Shared item indicators.
- Search within editor.
- Sort A-Z, recent, type, favorites.
- Folder/tag navigation.

### Application records

- Distinct from web Logins.
- Store app name/path/identifier and optional credential metadata.
- Launch/fill semantics only where platform APIs allow it.
- If unsupported, UI must say unsupported instead of pretending.

### Contacts

- Contact is a lookup record.
- Fields: name, phone, email, address, notes, organization.
- Not used for autofill by default.

### Client coverage

| Client | Needed |
|---|---|
| Web | Main editor implementation |
| Android | Mobile editor views |
| Ext | Lightweight popup editor or open web editor |
| Win | Native editor or embedded web view |
| Linux | CLI editor commands or GUI editor |
| Server | record schemas and sync |

---

## Chapter 9 — Taskbar Icon / Tray UX

### Required product capabilities

For Windows desktop, and optionally Linux tray if GUI exists:

- Tray/taskbar icon.
- Lock/unlock status.
- Quick search.
- Recent items.
- Favorites.
- Open vault.
- Sync now.
- Settings.
- Logout/lock.
- Show connection/server status.

### Client coverage

| Client | Needed |
|---|---|
| Win | Main implementation |
| Linux | If GUI/tray chosen |
| Web/Android/Ext | Not applicable, but equivalent quick access UX where relevant |

---

## Chapter 10 — AutoFill Dialog

### Required product capabilities

- Enable/disable AutoFill prompts.
- Show matching items for current site/app/form.
- Let user choose which item to fill.
- Handle no-match state.
- Handle multiple-match state.
- Fill Logins.
- Fill Identities.
- Fill payment cards.
- Respect per-domain disabled rules.
- Respect security settings before revealing/filling sensitive fields.

### Client coverage

| Client | Needed |
|---|---|
| Ext | Browser autofill dialog/suggestions |
| Android | Android Autofill service credential picker |
| Web | Settings and item metadata |
| Server | record metadata for matching, encrypted payload sync |

---

## Chapter 11 — Password Generator

### Required product capabilities

- Generate password while creating new account/login.
- Generate password while updating existing password.
- Custom parameters:
  - length
  - uppercase
  - lowercase
  - numbers
  - symbols
  - exclude ambiguous chars
  - passphrase mode, if supported
- Strength indicator.
- Copy generated password.
- Use generated password in current item/form.
- Save generated password as new Login.
- Prompt to save generated password if used in browser.

### Client coverage

| Client | Needed |
|---|---|
| Web | Generator panel integrated with editor |
| Android | Generator screen/panel |
| Ext | Generate/fill/save from popup/content script |
| Win | Generator in editor |
| Linux | generator command |
| Server | Usually client-side only, unless policy storage is added |

---

## Chapter 12 — Authenticator

### Required product capabilities

- TOTP/2FA item type.
- Add via QR code where platform supports camera/screen capture.
- Add via manual secret.
- Show current code.
- Countdown timer.
- Copy code.
- Link TOTP to Login item.
- Fill/copy TOTP in browser extension where possible.
- Secure backup/recovery semantics.

### Client coverage

| Client | Needed |
|---|---|
| Web | TOTP editor/display |
| Android | TOTP display/copy, QR scan optional |
| Ext | Copy/fill current TOTP for matching login |
| Win/Linux | Display/copy TOTP |
| Server | encrypted TOTP secret storage only; code generation can be client-side |

---

## Chapter 13 — Sharing and Sending

### Required product capabilities

- Share item with another user.
- Send item one-time or as shared record, depending design.
- Permission levels:
  - view/use
  - edit
  - reshare/admin, if supported
- Revoke share.
- Accept/decline shared item.
- Shared-with-me view.
- Shared-by-me view.
- Shared item indicators.
- Audit status.
- Public/private key design before UI claims secure sharing.
- Never share master password.

### Client coverage

| Client | Needed |
|---|---|
| Web | Main sharing center UI |
| Android | Shared item visibility, maybe manage shares later |
| Ext | Indicate shared items; maybe use only |
| Win/Linux | Basic shared item display/manage |
| Server | major backend and crypto support required |

---

## Chapter 14 — Emergency Access

### Required product capabilities

- Add trusted contact.
- Define waiting period.
- Request emergency access.
- Approve/deny access request.
- Cancel access request.
- Notify user of pending request.
- Recovery/access UI for trusted contact.
- Audit trail.
- Crypto design before implementation.
- Clear warnings about what can/cannot be recovered.

### Client coverage

| Client | Needed |
|---|---|
| Web | Main emergency access UI |
| Android | View/approve/deny requests |
| Ext | Probably not primary management surface |
| Win/Linux | Basic visibility/manage if product wants parity |
| Server | backend workflows, notification, crypto, audit |

---

## Chapter 15 — Security Center

### Required product capabilities

- Security score.
- Weak password detection.
- Reused password detection.
- Duplicate password detection.
- Old/stale password detection.
- Compromised password detection only if real breach source exists.
- List affected items.
- Actionable fix flow:
  - open item
  - generate replacement password
  - update site/password manually or via browser helper if feasible
- Explanations and severity.
- No fake security claims.

### Client coverage

| Client | Needed |
|---|---|
| Web | Main Security Center |
| Android | View score/issues, basic actions |
| Ext | Prompt during password update/generation |
| Win/Linux | Basic security report |
| Server | optional breach API integration; local/client-side analysis for encrypted data |

---

## Chapter 16 — RoboForm Online / Web Vault

### Required product capabilities

- Online web vault at `https://gvault.guber.dev`.
- Login/register.
- View/search/edit vault items.
- Sync with other clients.
- Account/settings management.
- No fake/demo rows.
- Clear server connection status.
- Responsive layout.
- Accessible UI.

### Client coverage

| Client | Needed |
|---|---|
| Web | Main implementation |
| Server | stable deployment, auth, sync, data directory, backups |

---

## Chapter 17 — Start Page

### Required product capabilities

- Start/dashboard page after login.
- Navigation to vault sections.
- Favorites.
- Recent items.
- Search.
- Customizable widgets/sections if desired.
- Edit item from start page.
- Open login/bookmark from start page.

### Client coverage

| Client | Needed |
|---|---|
| Web | Dashboard/start page |
| Android | Home tab/dashboard |
| Ext | Popup home/search/favorites |
| Win/Linux | Home view if GUI |

---

## Chapter 18 — Options and Settings

### General settings

- Theme.
- Language/locale if supported.
- Startup behavior.
- Default server URL.
- Diagnostics.
- Version/build info.
- Logout/delete local session.

### Browser settings

- Browser integration toggles.
- Toolbar/popup behavior.
- Extension account data.
- Security settings.
- Autofill settings.
- Autosave settings.
- Keyboard shortcuts.
- Domain rules.

### Account and data

- Email/account display.
- Change password flow if implemented.
- Export/import/backup/restore.
- Delete account/local data.
- License/subscription only if product needs it; otherwise omit.

### Security settings

- Auto-lock.
- Lock timeout.
- Require master password/re-auth for sensitive actions.
- PIN/biometric unlock where supported.
- Clipboard clear timeout.
- Device/session management.

### AutoFill settings

- Enable/disable autofill.
- Prompt behavior.
- Fill without prompt setting, if supported.
- Per-site disabled list.

### AutoSave settings

- Prompt to save new login.
- Prompt to update changed password.
- Disable autosave on selected domains.

### Context menu settings

- Show/hide browser context menu actions.
- Fill/save/generate/search menu entries.

### Search settings

- Search fields included.
- Fuzzy search.
- Exact search.
- Search shortcuts.

### Keyboard settings

- Global hotkeys where OS/browser allows.
- Command palette shortcuts.
- Fill/generate/search shortcuts.

### Domains / applications / advanced

- Equivalent domains.
- Subdomain matching.
- Per-item domain rules.
- App matching rules.
- Advanced diagnostics.
- Reset local cache.

### Client coverage

| Client | Needed |
|---|---|
| Web | Full account/settings UI |
| Android | Mobile settings |
| Ext | Extension settings/options page |
| Win | Desktop options/preferences |
| Linux | CLI config or GUI settings |
| Server | APIs for devices/sessions/account where required |

---

## Chapter 19 — RoboForm Security

### Required architecture topics

- Encryption model.
- Authentication model.
- Zero-knowledge boundaries.
- What server can and cannot see.
- Master password handling.
- Key derivation.
- Device/session tokens.
- Secure sharing crypto.
- Backup/restore security.
- Recovery limitations.
- Threat model documentation.

### Required UI rules

- UI must not claim zero-knowledge or secure sharing until implemented.
- UI must clearly warn about plaintext export.
- UI must require re-auth for sensitive actions if configured.
- UI must distinguish account password/session from encryption/master password if those differ.

### Client coverage

| Client | Needed |
|---|---|
| All | Security-sensitive UX and honest messaging |
| Server | crypto/auth primitives, docs, tests |

---

# Cross-cutting product backlog

## Deployment and operations

- Persistent `gvault.guber.dev` routing.
- Caddy config or equivalent file-backed reverse proxy config.
- GVault server as a service.
- Web/proxy as a service.
- Restart/reboot proof.
- TLS certificate renewal proof.
- Server data directory and backup plan.
- Health endpoint that does not require auth if monitoring is desired.

## Sync and devices

- Show connected devices.
- Revoke device/session.
- Last sync per client.
- Manual sync.
- Sync conflict/error UI.
- Offline/server unavailable state.

## Organization

- Folders.
- Nested folders or collections if desired.
- Tags.
- Favorites.
- Trash/archive.
- Restore from trash.
- Bulk move/delete.
- Sort A-Z/recent/type/favorite.

## Import/export/migration

- RoboForm import.
- CSV import.
- Bitwarden import.
- 1Password import.
- Field mapping preview.
- Duplicate handling.
- Export encrypted archive.
- Export plaintext with strong warning.
- Backup/restore validation.

## Clipboard and sensitive field UX

- Copy buttons.
- Reveal/hide.
- Auto-clear clipboard timer.
- Re-auth before reveal/copy, if configured.
- Avoid logging secrets.

## Proof/E2E requirements

Each implemented feature should eventually have relevant proof:

- build result
- unit/integration tests where available
- browser proof for web/extension
- real Android device proof for Android
- Windows smoke proof for desktop
- Linux smoke proof for CLI/desktop
- server-side data proof when verifying server-backed behavior

# Suggested implementation phases

## Phase 0 — Stabilize deployment

1. Persist `gvault.guber.dev` route.
2. Run GVault server/web/proxy as services.
3. Verify restart/reboot survival.

## Phase 1 — Core password manager MVP

1. Web: login/register/list/detail/create/edit/delete/search.
2. Android: login/register/list/detail/create/edit/delete/search.
3. Extension: login/register/current-domain fill from server-backed records.
4. Server: stable schemas for Login/Safenote/Bookmark/Identity/Card.

## Phase 2 — RoboForm core parity

1. Save/update login prompts.
2. Identity/card form filling.
3. Password generator.
4. Folders/tags/favorites/trash.
5. Settings/autofill/autosave/domain rules.

## Phase 3 — Advanced features

1. Authenticator/TOTP.
2. Security Center.
3. Sharing/Sending.
4. Emergency Access.
5. Import/export/backup/restore.

## Phase 4 — Desktop and polish

1. Windows desktop real client + tray UX.
2. Linux CLI/GUI client.
3. Start page/dashboard.
4. Keyboard shortcuts/command palette.
5. Accessibility/responsive polish.

# Open decisions

- Is Linux a CLI-first product or GUI product?
- Will GVault use one account password as both login and encryption secret, or separate auth password vs master/encryption password?
- What is the official zero-knowledge/encryption model?
- Which import formats are MVP?
- Which sharing/emergency access crypto model will be used?
- Should web keep sessions across reloads, or always start at login screen?
- Should browser extension store tokens in extension storage or require unlock every session?
- Which desktop framework should replace the current Windows/Linux stubs?
