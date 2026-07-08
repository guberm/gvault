# GVault RoboForm Parity GitHub Issue Index

Generated from `docs/roboform-parity-checklist.md`.

Total unchecked checklist task issues linked here: 335
Missing task issues: 0

Section-level issues: #1–#35. Granular task issues are linked below.

##  — Current verified snapshot

- [ ] #36 Deployment is persistent across reboot/Caddy/service restart. — https://github.com/guberm/gvault/issues/36
- [ ] #37 Browser extension is a real server-backed login/fill client. — https://github.com/guberm/gvault/issues/37
- [ ] #38 Windows desktop is a real server-backed login/vault client. — https://github.com/guberm/gvault/issues/38
- [ ] #39 Linux client is a real server-backed CLI/GUI client. — https://github.com/guberm/gvault/issues/39

## 0. Deployment and operations

Parent issue: #1 — https://github.com/guberm/gvault/issues/1

- [ ] #40 Persist reverse-proxy route in file-backed Caddy config or equivalent. — https://github.com/guberm/gvault/issues/40
- [ ] #41 Run GVault server as a managed service. — https://github.com/guberm/gvault/issues/41
- [ ] #42 Run GVault web/proxy as a managed service. — https://github.com/guberm/gvault/issues/42
- [ ] #43 Remove dependence on ad-hoc SSH tunnels for production availability. — https://github.com/guberm/gvault/issues/43
- [ ] #44 Verify service restart survival. — https://github.com/guberm/gvault/issues/44
- [ ] #45 Verify host reboot survival. — https://github.com/guberm/gvault/issues/45
- [ ] #46 Verify TLS renewal path. — https://github.com/guberm/gvault/issues/46
- [ ] #47 Define production data directory. — https://github.com/guberm/gvault/issues/47
- [ ] #48 Implement backup/restore plan for server data. — https://github.com/guberm/gvault/issues/48
- [ ] #49 Add unauthenticated health endpoint if monitoring requires it. — https://github.com/guberm/gvault/issues/49
- [ ] #50 Add deployment/runbook documentation. — https://github.com/guberm/gvault/issues/50

## 1. Cross-client non-negotiables

Parent issue: #2 — https://github.com/guberm/gvault/issues/2

- [ ] #51 Browser extension first screen is login/register. — https://github.com/guberm/gvault/issues/51
- [ ] #52 Windows desktop first screen is login/register. — https://github.com/guberm/gvault/issues/52
- [ ] #53 Linux client has login/register entrypoint. — https://github.com/guberm/gvault/issues/53
- [ ] #54 Extension default server URL uses `https://gvault.guber.dev`. — https://github.com/guberm/gvault/issues/54
- [ ] #55 Windows desktop default server URL uses `https://gvault.guber.dev`. — https://github.com/guberm/gvault/issues/55
- [ ] #56 Linux client default server URL uses `https://gvault.guber.dev`. — https://github.com/guberm/gvault/issues/56
- [ ] #57 Extension displayed/fill data comes from server-backed records. — https://github.com/guberm/gvault/issues/57
- [ ] #58 Windows desktop displayed data comes from server-backed records. — https://github.com/guberm/gvault/issues/58
- [ ] #59 Linux displayed data comes from server-backed records. — https://github.com/guberm/gvault/issues/59
- [ ] #60 All clients avoid fake/demo rows in production UI. — https://github.com/guberm/gvault/issues/60
- [ ] #61 All clients have logout. — https://github.com/guberm/gvault/issues/61
- [ ] #62 All clients handle auth failure. — https://github.com/guberm/gvault/issues/62
- [ ] #63 All clients handle server unavailable. — https://github.com/guberm/gvault/issues/63
- [ ] #64 All clients handle session expired. — https://github.com/guberm/gvault/issues/64
- [ ] #65 All sensitive UI claims are backed by real implementation. — https://github.com/guberm/gvault/issues/65

## 2. Web client — 2.1 Auth and session

Parent issue: #3 — https://github.com/guberm/gvault/issues/3

- [ ] #66 Existing-user login through UI is repeatedly verified after clean reload. — https://github.com/guberm/gvault/issues/66
- [ ] #67 Logout returns to login/register screen. — https://github.com/guberm/gvault/issues/67
- [ ] #68 Reload after logout stays on login/register screen. — https://github.com/guberm/gvault/issues/68
- [ ] #69 Auth loading state. — https://github.com/guberm/gvault/issues/69
- [ ] #70 Auth error state for wrong password. — https://github.com/guberm/gvault/issues/70
- [ ] #71 Auth error state for server unavailable. — https://github.com/guberm/gvault/issues/71
- [ ] #72 Password visibility toggle. — https://github.com/guberm/gvault/issues/72
- [ ] #73 Password requirements messaging. — https://github.com/guberm/gvault/issues/73
- [ ] #74 Session expired handling. — https://github.com/guberm/gvault/issues/74

## 2. Web client — 2.2 Core vault UI

Parent issue: #4 — https://github.com/guberm/gvault/issues/4

- [ ] #75 List all server-backed items. — https://github.com/guberm/gvault/issues/75
- [ ] #76 Item detail pane. — https://github.com/guberm/gvault/issues/76
- [x] #77 Create Login item. — https://github.com/guberm/gvault/issues/77
- [ ] #78 Edit Login item. — https://github.com/guberm/gvault/issues/78
- [ ] #79 Delete/trash Login item. — https://github.com/guberm/gvault/issues/79
- [ ] #80 Restore item from trash. — https://github.com/guberm/gvault/issues/80
- [ ] #81 Create Safenote. — https://github.com/guberm/gvault/issues/81
- [ ] #82 Create Bookmark. — https://github.com/guberm/gvault/issues/82
- [ ] #83 Create Identity. — https://github.com/guberm/gvault/issues/83
- [ ] #84 Create Contact. — https://github.com/guberm/gvault/issues/84
- [ ] #85 Create Card. — https://github.com/guberm/gvault/issues/85
- [ ] #86 Search vault items. — https://github.com/guberm/gvault/issues/86
- [ ] #87 Filter by item type. — https://github.com/guberm/gvault/issues/87
- [ ] #88 Real counts per category. — https://github.com/guberm/gvault/issues/88
- [ ] #89 Favorites. — https://github.com/guberm/gvault/issues/89
- [ ] #90 Folders/collections. — https://github.com/guberm/gvault/issues/90
- [ ] #91 Tags. — https://github.com/guberm/gvault/issues/91
- [ ] #92 Empty state. — https://github.com/guberm/gvault/issues/92
- [ ] #93 Loading/skeleton state. — https://github.com/guberm/gvault/issues/93
- [ ] #94 Save/sync status state. — https://github.com/guberm/gvault/issues/94
- [ ] #95 Sync error state. — https://github.com/guberm/gvault/issues/95
- [ ] #96 Last sync display from real data only. — https://github.com/guberm/gvault/issues/96

## 2. Web client — 2.3 Web password-manager UX

Parent issue: #5 — https://github.com/guberm/gvault/issues/5

- [ ] #97 Copy username. — https://github.com/guberm/gvault/issues/97
- [ ] #98 Copy password. — https://github.com/guberm/gvault/issues/98
- [ ] #99 Reveal/hide password. — https://github.com/guberm/gvault/issues/99
- [ ] #100 Re-auth before reveal/copy if configured. — https://github.com/guberm/gvault/issues/100
- [ ] #101 Auto-clear clipboard timer. — https://github.com/guberm/gvault/issues/101
- [ ] #102 Password generator panel. — https://github.com/guberm/gvault/issues/102
- [ ] #103 Use generated password in current item. — https://github.com/guberm/gvault/issues/103
- [ ] #104 Password strength indicator. — https://github.com/guberm/gvault/issues/104
- [ ] #105 Keyboard shortcut for search. — https://github.com/guberm/gvault/issues/105
- [ ] #106 Keyboard shortcut for new item. — https://github.com/guberm/gvault/issues/106
- [ ] #107 Keyboard shortcut for save. — https://github.com/guberm/gvault/issues/107
- [ ] #108 Settings modal/page. — https://github.com/guberm/gvault/issues/108
- [ ] #109 Account modal/page. — https://github.com/guberm/gvault/issues/109
- [ ] #110 Responsive mobile web layout. — https://github.com/guberm/gvault/issues/110
- [ ] #111 Dark/light theme consistency. — https://github.com/guberm/gvault/issues/111

## 3. Android client — 3.1 Auth and session

Parent issue: #6 — https://github.com/guberm/gvault/issues/6

- [x] #112 Clean install defaults to `https://gvault.guber.dev` without manual correction. — https://github.com/guberm/gvault/issues/112
- [x] #113 Registration through Android is verified. — https://github.com/guberm/gvault/issues/113
- [x] #114 Wrong-password error state. — https://github.com/guberm/gvault/issues/114
- [x] #115 Server-unavailable error state. — https://github.com/guberm/gvault/issues/115
- [x] #116 Loading state during login/register. — https://github.com/guberm/gvault/issues/116
- [x] #117 Logout. — https://github.com/guberm/gvault/issues/117
- [x] #118 App restart behavior is defined and verified. — https://github.com/guberm/gvault/issues/118
- [x] #119 Local token/session storage policy is implemented. — https://github.com/guberm/gvault/issues/119
- [ ] #120 PIN unlock, if chosen. — https://github.com/guberm/gvault/issues/120
- [ ] #121 Biometric unlock, if chosen. — https://github.com/guberm/gvault/issues/121

## 3. Android client — 3.2 Android vault UI

Parent issue: #7 — https://github.com/guberm/gvault/issues/7

- [x] #122 Full item list screen. — https://github.com/guberm/gvault/issues/122
- [x] #123 Item detail screen. — https://github.com/guberm/gvault/issues/123
- [x] #124 Create Login item. — https://github.com/guberm/gvault/issues/124
- [x] #125 Edit Login item. — https://github.com/guberm/gvault/issues/125
- [x] #126 Delete/trash item. — https://github.com/guberm/gvault/issues/126
- [x] #127 Search. — https://github.com/guberm/gvault/issues/127
- [x] #128 Type filters/categories. — https://github.com/guberm/gvault/issues/128
- [x] #129 Favorites. — https://github.com/guberm/gvault/issues/129
- [x] #130 Pull-to-refresh. — https://github.com/guberm/gvault/issues/130
- [x] #131 Sync status. — https://github.com/guberm/gvault/issues/131
- [x] #132 Empty state. — https://github.com/guberm/gvault/issues/132
- [x] #133 Loading state. — https://github.com/guberm/gvault/issues/133
- [x] #134 Copy username/password. — https://github.com/guberm/gvault/issues/134
- [x] #135 Reveal/hide password. — https://github.com/guberm/gvault/issues/135
- [x] #136 Password generator. — https://github.com/guberm/gvault/issues/136
- [x] #137 Settings screen. — https://github.com/guberm/gvault/issues/137
- [x] #138 Account screen. — https://github.com/guberm/gvault/issues/138
- [x] #139 Material-style polish. — https://github.com/guberm/gvault/issues/139

## 3. Android client — 3.3 Android Autofill

Parent issue: #8 — https://github.com/guberm/gvault/issues/8

- [x] #140 Autofill service uses server-backed Login records. — https://github.com/guberm/gvault/issues/140
- [x] #141 Credential picker shows matching records. — https://github.com/guberm/gvault/issues/141
- [x] #142 Fill username/password into apps/browsers. — https://github.com/guberm/gvault/issues/142
- [x] #143 Identity autofill for address/contact forms. — https://github.com/guberm/gvault/issues/143
- [x] #144 Card autofill where appropriate. — https://github.com/guberm/gvault/issues/144
- [x] #145 No blank placeholder dataset. — https://github.com/guberm/gvault/issues/145
- [x] #146 Autofill setup guidance. — https://github.com/guberm/gvault/issues/146
- [x] #147 Real-device autofill proof. — https://github.com/guberm/gvault/issues/147

## 4. Browser extension — 4.1 Extension auth

Parent issue: #9 — https://github.com/guberm/gvault/issues/9

- [ ] #148 Popup first screen is login/register. — https://github.com/guberm/gvault/issues/148
- [ ] #149 Default server URL is `https://gvault.guber.dev`. — https://github.com/guberm/gvault/issues/149
- [ ] #150 Register from popup. — https://github.com/guberm/gvault/issues/150
- [ ] #151 Login from popup. — https://github.com/guberm/gvault/issues/151
- [ ] #152 Token/session storage in extension storage. — https://github.com/guberm/gvault/issues/152
- [ ] #153 Logout. — https://github.com/guberm/gvault/issues/153
- [ ] #154 Locked/unlocked/connected status. — https://github.com/guberm/gvault/issues/154
- [ ] #155 Auth error states. — https://github.com/guberm/gvault/issues/155
- [ ] #156 Chrome proof. — https://github.com/guberm/gvault/issues/156
- [ ] #157 Edge proof. — https://github.com/guberm/gvault/issues/157

## 4. Browser extension — 4.2 Extension vault/fill UX

Parent issue: #10 — https://github.com/guberm/gvault/issues/10

- [ ] #158 Pull vault records from server. — https://github.com/guberm/gvault/issues/158
- [ ] #159 Detect current tab/domain. — https://github.com/guberm/gvault/issues/159
- [ ] #160 Show matching credentials for current domain. — https://github.com/guberm/gvault/issues/160
- [ ] #161 One-click fill selected credential. — https://github.com/guberm/gvault/issues/161
- [ ] #162 Copy username/password from popup. — https://github.com/guberm/gvault/issues/162
- [ ] #163 Search vault from popup. — https://github.com/guberm/gvault/issues/163
- [ ] #164 Open full web vault button. — https://github.com/guberm/gvault/issues/164
- [ ] #165 Badge shows locked/unlocked/match count. — https://github.com/guberm/gvault/issues/165
- [ ] #166 Save-new-login prompt. — https://github.com/guberm/gvault/issues/166
- [ ] #167 Update-existing-login prompt. — https://github.com/guberm/gvault/issues/167
- [ ] #168 Generated-password save prompt. — https://github.com/guberm/gvault/issues/168
- [ ] #169 Context menu fill/save/generate/search actions. — https://github.com/guberm/gvault/issues/169
- [ ] #170 Per-site disabled/autofill rules. — https://github.com/guberm/gvault/issues/170
- [ ] #171 Multiple credentials per domain. — https://github.com/guberm/gvault/issues/171
- [ ] #172 Equivalent domain matching. — https://github.com/guberm/gvault/issues/172

## 5. Windows desktop client

Parent issue: #11 — https://github.com/guberm/gvault/issues/11

- [ ] #173 Replace placeholder/stub copy. — https://github.com/guberm/gvault/issues/173
- [ ] #174 Login/register-first UI. — https://github.com/guberm/gvault/issues/174
- [ ] #175 Default server URL is `https://gvault.guber.dev`. — https://github.com/guberm/gvault/issues/175
- [ ] #176 Register via server API. — https://github.com/guberm/gvault/issues/176
- [ ] #177 Login via server API. — https://github.com/guberm/gvault/issues/177
- [ ] #178 Pull server-backed vault records. — https://github.com/guberm/gvault/issues/178
- [ ] #179 Vault list. — https://github.com/guberm/gvault/issues/179
- [ ] #180 Item detail. — https://github.com/guberm/gvault/issues/180
- [ ] #181 Create/edit/delete basic records. — https://github.com/guberm/gvault/issues/181
- [ ] #182 Search. — https://github.com/guberm/gvault/issues/182
- [ ] #183 Copy/reveal sensitive fields. — https://github.com/guberm/gvault/issues/183
- [ ] #184 Logout. — https://github.com/guberm/gvault/issues/184
- [ ] #185 Connected/sync/error status bar. — https://github.com/guberm/gvault/issues/185
- [ ] #186 Settings/preferences. — https://github.com/guberm/gvault/issues/186
- [ ] #187 Tray/taskbar icon. — https://github.com/guberm/gvault/issues/187
- [ ] #188 Tray quick search/recent/favorites. — https://github.com/guberm/gvault/issues/188
- [ ] #189 Build `.exe`. — https://github.com/guberm/gvault/issues/189
- [ ] #190 Windows smoke/login proof. — https://github.com/guberm/gvault/issues/190

## 6. Linux client

Parent issue: #12 — https://github.com/guberm/gvault/issues/12

- [ ] #191 Decide CLI vs GUI as first-class target. — https://github.com/guberm/gvault/issues/191
- [ ] #192 If CLI: `gvault login`. — https://github.com/guberm/gvault/issues/192
- [ ] #193 If CLI: `gvault register`. — https://github.com/guberm/gvault/issues/193
- [ ] #194 If CLI: `gvault list`. — https://github.com/guberm/gvault/issues/194
- [ ] #195 If CLI: `gvault get`. — https://github.com/guberm/gvault/issues/195
- [ ] #196 If CLI: `gvault create`. — https://github.com/guberm/gvault/issues/196
- [ ] #197 If CLI: `gvault edit`. — https://github.com/guberm/gvault/issues/197
- [ ] #198 If CLI: `gvault delete`. — https://github.com/guberm/gvault/issues/198
- [ ] #199 If GUI: login/register-first UI. — https://github.com/guberm/gvault/issues/199
- [ ] #200 If GUI: vault list/detail/editor. — https://github.com/guberm/gvault/issues/200
- [ ] #201 Default server URL is `https://gvault.guber.dev`. — https://github.com/guberm/gvault/issues/201
- [ ] #202 Remove preview-only GitHub message. — https://github.com/guberm/gvault/issues/202
- [ ] #203 Build/package Linux client. — https://github.com/guberm/gvault/issues/203
- [x] #204 Linux smoke/login proof. — https://github.com/guberm/gvault/issues/204

## 7. Data types and editors — 7.1 Login

Parent issue: #13 — https://github.com/guberm/gvault/issues/13

- [ ] #205 Title. — https://github.com/guberm/gvault/issues/205
- [ ] #206 Username/email. — https://github.com/guberm/gvault/issues/206
- [ ] #207 Password. — https://github.com/guberm/gvault/issues/207
- [ ] #208 Website/URL list. — https://github.com/guberm/gvault/issues/208
- [ ] #209 Notes. — https://github.com/guberm/gvault/issues/209
- [ ] #210 Favorite. — https://github.com/guberm/gvault/issues/210
- [ ] #211 Folder/tags. — https://github.com/guberm/gvault/issues/211
- [ ] #212 Match rules. — https://github.com/guberm/gvault/issues/212
- [ ] #213 Password history, if supported. — https://github.com/guberm/gvault/issues/213

## 7. Data types and editors — 7.2 Bookmark

Parent issue: #14 — https://github.com/guberm/gvault/issues/14

- [ ] #214 Title. — https://github.com/guberm/gvault/issues/214
- [ ] #215 URL. — https://github.com/guberm/gvault/issues/215
- [ ] #216 Notes. — https://github.com/guberm/gvault/issues/216
- [ ] #217 Open action. — https://github.com/guberm/gvault/issues/217
- [ ] #218 Favorite. — https://github.com/guberm/gvault/issues/218
- [ ] #219 Folder/tags. — https://github.com/guberm/gvault/issues/219

## 7. Data types and editors — 7.3 Safenote

Parent issue: #15 — https://github.com/guberm/gvault/issues/15

- [ ] #220 Title. — https://github.com/guberm/gvault/issues/220
- [ ] #221 Body. — https://github.com/guberm/gvault/issues/221
- [ ] #222 Notes. — https://github.com/guberm/gvault/issues/222
- [ ] #223 Copy action. — https://github.com/guberm/gvault/issues/223
- [ ] #224 Folder/tags. — https://github.com/guberm/gvault/issues/224

## 7. Data types and editors — 7.4 Identity

Parent issue: #16 — https://github.com/guberm/gvault/issues/16

- [ ] #225 Person section. — https://github.com/guberm/gvault/issues/225
- [ ] #226 Address section. — https://github.com/guberm/gvault/issues/226
- [ ] #227 Contact section. — https://github.com/guberm/gvault/issues/227
- [ ] #228 Business section. — https://github.com/guberm/gvault/issues/228
- [ ] #229 Passport/document section. — https://github.com/guberm/gvault/issues/229
- [ ] #230 Vehicle/car section, if desired. — https://github.com/guberm/gvault/issues/230
- [ ] #231 Custom fields. — https://github.com/guberm/gvault/issues/231
- [ ] #232 Use for form fill. — https://github.com/guberm/gvault/issues/232

## 7. Data types and editors — 7.5 Contact

Parent issue: #17 — https://github.com/guberm/gvault/issues/17

- [ ] #233 Name. — https://github.com/guberm/gvault/issues/233
- [ ] #234 Email. — https://github.com/guberm/gvault/issues/234
- [ ] #235 Phone. — https://github.com/guberm/gvault/issues/235
- [ ] #236 Address. — https://github.com/guberm/gvault/issues/236
- [ ] #237 Organization. — https://github.com/guberm/gvault/issues/237
- [ ] #238 Notes. — https://github.com/guberm/gvault/issues/238
- [ ] #239 Explicitly not default autofill source. — https://github.com/guberm/gvault/issues/239

## 7. Data types and editors — 7.6 Payment card

Parent issue: #18 — https://github.com/guberm/gvault/issues/18

- [ ] #240 Cardholder. — https://github.com/guberm/gvault/issues/240
- [ ] #241 Number. — https://github.com/guberm/gvault/issues/241
- [ ] #242 Expiry. — https://github.com/guberm/gvault/issues/242
- [ ] #243 CVV. — https://github.com/guberm/gvault/issues/243
- [ ] #244 Billing address. — https://github.com/guberm/gvault/issues/244
- [ ] #245 Reveal/copy protections. — https://github.com/guberm/gvault/issues/245
- [ ] #246 Form fill support. — https://github.com/guberm/gvault/issues/246

## 7. Data types and editors — 7.7 Bank account

Parent issue: #19 — https://github.com/guberm/gvault/issues/19

- [ ] #247 Bank name. — https://github.com/guberm/gvault/issues/247
- [ ] #248 Account number. — https://github.com/guberm/gvault/issues/248
- [ ] #249 Routing/IBAN/SWIFT fields as applicable. — https://github.com/guberm/gvault/issues/249
- [ ] #250 Notes. — https://github.com/guberm/gvault/issues/250
- [ ] #251 Reveal/copy protections. — https://github.com/guberm/gvault/issues/251

## 7. Data types and editors — 7.8 Application

Parent issue: #20 — https://github.com/guberm/gvault/issues/20

- [ ] #252 App name/path/identifier. — https://github.com/guberm/gvault/issues/252
- [ ] #253 Username/password if applicable. — https://github.com/guberm/gvault/issues/253
- [ ] #254 Launch/open action where supported. — https://github.com/guberm/gvault/issues/254
- [ ] #255 Fill semantics only if platform supports it. — https://github.com/guberm/gvault/issues/255

## 7. Data types and editors — 7.9 Authenticator/TOTP

Parent issue: #21 — https://github.com/guberm/gvault/issues/21

- [ ] #256 TOTP secret storage. — https://github.com/guberm/gvault/issues/256
- [ ] #257 Manual secret entry. — https://github.com/guberm/gvault/issues/257
- [ ] #258 QR add where platform supports it. — https://github.com/guberm/gvault/issues/258
- [ ] #259 Current code display. — https://github.com/guberm/gvault/issues/259
- [ ] #260 Countdown. — https://github.com/guberm/gvault/issues/260
- [ ] #261 Copy code. — https://github.com/guberm/gvault/issues/261
- [ ] #262 Link TOTP to Login. — https://github.com/guberm/gvault/issues/262

## 8. Organization

Parent issue: #22 — https://github.com/guberm/gvault/issues/22

- [ ] #263 Folders. — https://github.com/guberm/gvault/issues/263
- [ ] #264 Nested folders or collections. — https://github.com/guberm/gvault/issues/264
- [ ] #265 Tags. — https://github.com/guberm/gvault/issues/265
- [ ] #266 Favorites. — https://github.com/guberm/gvault/issues/266
- [ ] #267 Trash/archive. — https://github.com/guberm/gvault/issues/267
- [ ] #268 Restore from trash. — https://github.com/guberm/gvault/issues/268
- [ ] #269 Permanent delete. — https://github.com/guberm/gvault/issues/269
- [ ] #270 Bulk move. — https://github.com/guberm/gvault/issues/270
- [ ] #271 Bulk delete. — https://github.com/guberm/gvault/issues/271
- [ ] #272 Sort A-Z. — https://github.com/guberm/gvault/issues/272
- [ ] #273 Sort by recent. — https://github.com/guberm/gvault/issues/273
- [ ] #274 Sort by type. — https://github.com/guberm/gvault/issues/274
- [ ] #275 Sort by favorite. — https://github.com/guberm/gvault/issues/275

## 9. Form filling and autosave

Parent issue: #23 — https://github.com/guberm/gvault/issues/23

- [x] #276 Browser login form detection. — https://github.com/guberm/gvault/issues/276
- [x] #277 Browser identity/address form detection. — https://github.com/guberm/gvault/issues/277
- [x] #278 Browser card/payment form detection. — https://github.com/guberm/gvault/issues/278
- [x] #279 Android login form detection via Autofill. — https://github.com/guberm/gvault/issues/279
- [x] #280 Android identity/card fill via Autofill. — https://github.com/guberm/gvault/issues/280
- [x] #281 Save-new-login prompt. — https://github.com/guberm/gvault/issues/281
- [x] #282 Update-password prompt. — https://github.com/guberm/gvault/issues/282
- [x] #283 Autosave enable/disable setting. — https://github.com/guberm/gvault/issues/283
- [x] #284 Autofill enable/disable setting. — https://github.com/guberm/gvault/issues/284
- [x] #285 Per-domain disabled list. — https://github.com/guberm/gvault/issues/285
- [ ] #286 Fill prompt behavior setting. — https://github.com/guberm/gvault/issues/286
- [ ] #287 Multiple-match chooser. — https://github.com/guberm/gvault/issues/287
- [ ] #288 No-match state. — https://github.com/guberm/gvault/issues/288
- [ ] #289 Equivalent domains. — https://github.com/guberm/gvault/issues/289
- [ ] #290 Subdomain match rules. — https://github.com/guberm/gvault/issues/290
- [ ] #291 Per-item URL match controls. — https://github.com/guberm/gvault/issues/291

## 10. Generator and security tools — 10.1 Password generator

Parent issue: #24 — https://github.com/guberm/gvault/issues/24

- [ ] #292 Length control. — https://github.com/guberm/gvault/issues/292
- [ ] #293 Uppercase toggle. — https://github.com/guberm/gvault/issues/293
- [ ] #294 Lowercase toggle. — https://github.com/guberm/gvault/issues/294
- [ ] #295 Numbers toggle. — https://github.com/guberm/gvault/issues/295
- [ ] #296 Symbols toggle. — https://github.com/guberm/gvault/issues/296
- [ ] #297 Exclude ambiguous characters. — https://github.com/guberm/gvault/issues/297
- [ ] #298 Passphrase mode. — https://github.com/guberm/gvault/issues/298
- [ ] #299 Strength indicator. — https://github.com/guberm/gvault/issues/299
- [ ] #300 Copy generated password. — https://github.com/guberm/gvault/issues/300
- [ ] #301 Use generated password in editor. — https://github.com/guberm/gvault/issues/301
- [ ] #302 Fill generated password into browser form. — https://github.com/guberm/gvault/issues/302
- [ ] #303 Save generated password as Login. — https://github.com/guberm/gvault/issues/303

## 10. Generator and security tools — 10.2 Security Center

Parent issue: #25 — https://github.com/guberm/gvault/issues/25

- [ ] #304 Security score. — https://github.com/guberm/gvault/issues/304
- [ ] #305 Weak password detection. — https://github.com/guberm/gvault/issues/305
- [ ] #306 Reused password detection. — https://github.com/guberm/gvault/issues/306
- [ ] #307 Duplicate password detection. — https://github.com/guberm/gvault/issues/307
- [ ] #308 Old/stale password detection. — https://github.com/guberm/gvault/issues/308
- [ ] #309 Compromised password detection with real breach source only. — https://github.com/guberm/gvault/issues/309
- [ ] #310 Affected items list. — https://github.com/guberm/gvault/issues/310
- [ ] #311 Fix action: open item. — https://github.com/guberm/gvault/issues/311
- [ ] #312 Fix action: generate replacement. — https://github.com/guberm/gvault/issues/312
- [ ] #313 Fix action: update/save changed password. — https://github.com/guberm/gvault/issues/313

## 10. Generator and security tools — 10.3 Authenticator

Parent issue: #26 — https://github.com/guberm/gvault/issues/26

- [ ] #314 TOTP item type. — https://github.com/guberm/gvault/issues/314
- [ ] #315 Code display/copy. — https://github.com/guberm/gvault/issues/315
- [ ] #316 Countdown. — https://github.com/guberm/gvault/issues/316
- [ ] #317 Browser fill/copy current TOTP for matching login. — https://github.com/guberm/gvault/issues/317
- [ ] #318 Mobile TOTP display/copy. — https://github.com/guberm/gvault/issues/318

## 11. Sharing and recovery — 11.1 Sharing/Sending

Parent issue: #27 — https://github.com/guberm/gvault/issues/27

- [ ] #319 Sharing crypto design documented. — https://github.com/guberm/gvault/issues/319
- [ ] #320 Public/private key material support. — https://github.com/guberm/gvault/issues/320
- [ ] #321 Share item with another user. — https://github.com/guberm/gvault/issues/321
- [ ] #322 Send one-time item, if chosen. — https://github.com/guberm/gvault/issues/322
- [ ] #323 Permission levels. — https://github.com/guberm/gvault/issues/323
- [ ] #324 Accept share. — https://github.com/guberm/gvault/issues/324
- [ ] #325 Decline share. — https://github.com/guberm/gvault/issues/325
- [ ] #326 Revoke share. — https://github.com/guberm/gvault/issues/326
- [ ] #327 Shared with me view. — https://github.com/guberm/gvault/issues/327
- [ ] #328 Shared by me view. — https://github.com/guberm/gvault/issues/328
- [ ] #329 Shared indicators on items. — https://github.com/guberm/gvault/issues/329
- [ ] #330 Audit/status UI. — https://github.com/guberm/gvault/issues/330

## 11. Sharing and recovery — 11.2 Emergency Access

Parent issue: #28 — https://github.com/guberm/gvault/issues/28

- [ ] #331 Emergency access crypto/workflow design documented. — https://github.com/guberm/gvault/issues/331
- [ ] #332 Add trusted contact. — https://github.com/guberm/gvault/issues/332
- [ ] #333 Waiting period setting. — https://github.com/guberm/gvault/issues/333
- [ ] #334 Request emergency access. — https://github.com/guberm/gvault/issues/334
- [ ] #335 Approve request. — https://github.com/guberm/gvault/issues/335
- [ ] #336 Deny request. — https://github.com/guberm/gvault/issues/336
- [ ] #337 Cancel request. — https://github.com/guberm/gvault/issues/337
- [ ] #338 Notifications/status. — https://github.com/guberm/gvault/issues/338
- [ ] #339 Audit trail. — https://github.com/guberm/gvault/issues/339
- [ ] #340 Clear recovery limitations. — https://github.com/guberm/gvault/issues/340

## 12. Import/export/backup/restore

Parent issue: #29 — https://github.com/guberm/gvault/issues/29

- [x] #341 RoboForm import. — https://github.com/guberm/gvault/issues/341
- [x] #342 CSV import. — https://github.com/guberm/gvault/issues/342
- [x] #343 Bitwarden import. — https://github.com/guberm/gvault/issues/343
- [x] #344 1Password import. — https://github.com/guberm/gvault/issues/344
- [ ] #345 Field mapping preview. — https://github.com/guberm/gvault/issues/345
- [ ] #346 Duplicate handling. — https://github.com/guberm/gvault/issues/346
- [ ] #347 Import validation. — https://github.com/guberm/gvault/issues/347
- [ ] #348 Encrypted export. — https://github.com/guberm/gvault/issues/348
- [ ] #349 Plaintext export warning. — https://github.com/guberm/gvault/issues/349
- [ ] #350 Backup snapshot. — https://github.com/guberm/gvault/issues/350
- [ ] #351 Restore from backup. — https://github.com/guberm/gvault/issues/351
- [ ] #352 Restore validation. — https://github.com/guberm/gvault/issues/352
- [ ] #353 Master-password recovery/reset policy. — https://github.com/guberm/gvault/issues/353
- [ ] #354 No misleading claim that lost encrypted secrets can be decrypted. — https://github.com/guberm/gvault/issues/354

## 13. Settings — 13.1 General/account

Parent issue: #30 — https://github.com/guberm/gvault/issues/30

- [ ] #355 Server URL setting. — https://github.com/guberm/gvault/issues/355
- [ ] #356 Account email display. — https://github.com/guberm/gvault/issues/356
- [ ] #357 Theme setting. — https://github.com/guberm/gvault/issues/357
- [ ] #358 Startup behavior. — https://github.com/guberm/gvault/issues/358
- [ ] #359 Diagnostics. — https://github.com/guberm/gvault/issues/359
- [ ] #360 Version/build info. — https://github.com/guberm/gvault/issues/360
- [ ] #361 Logout. — https://github.com/guberm/gvault/issues/361
- [ ] #362 Delete local session/cache. — https://github.com/guberm/gvault/issues/362
- [ ] #363 Delete account, if supported. — https://github.com/guberm/gvault/issues/363

## 13. Settings — 13.2 Security

Parent issue: #31 — https://github.com/guberm/gvault/issues/31

- [ ] #364 Auto-lock. — https://github.com/guberm/gvault/issues/364
- [ ] #365 Lock timeout. — https://github.com/guberm/gvault/issues/365
- [ ] #366 Clipboard clear timeout. — https://github.com/guberm/gvault/issues/366
- [ ] #367 Require re-auth for sensitive actions. — https://github.com/guberm/gvault/issues/367
- [ ] #368 PIN unlock setting. — https://github.com/guberm/gvault/issues/368
- [ ] #369 Biometric unlock setting. — https://github.com/guberm/gvault/issues/369
- [ ] #370 Device/session management. — https://github.com/guberm/gvault/issues/370
- [ ] #371 Revoke device/session. — https://github.com/guberm/gvault/issues/371

## 13. Settings — 13.3 Browser/autofill/autosave

Parent issue: #32 — https://github.com/guberm/gvault/issues/32

- [ ] #372 Browser integration toggles. — https://github.com/guberm/gvault/issues/372
- [ ] #373 Toolbar/popup behavior. — https://github.com/guberm/gvault/issues/373
- [ ] #374 Autofill prompt setting. — https://github.com/guberm/gvault/issues/374
- [ ] #375 Autosave prompt setting. — https://github.com/guberm/gvault/issues/375
- [ ] #376 Context menu setting. — https://github.com/guberm/gvault/issues/376
- [ ] #377 Domain disabled list. — https://github.com/guberm/gvault/issues/377
- [ ] #378 Equivalent domains management. — https://github.com/guberm/gvault/issues/378

## 13. Settings — 13.4 Search/keyboard/advanced

Parent issue: #33 — https://github.com/guberm/gvault/issues/33

- [ ] #379 Search behavior settings. — https://github.com/guberm/gvault/issues/379
- [ ] #380 Keyboard shortcuts. — https://github.com/guberm/gvault/issues/380
- [ ] #381 Command palette. — https://github.com/guberm/gvault/issues/381
- [ ] #382 Advanced diagnostics. — https://github.com/guberm/gvault/issues/382
- [ ] #383 Reset local cache. — https://github.com/guberm/gvault/issues/383
- [ ] #384 Export logs without secrets. — https://github.com/guberm/gvault/issues/384

## 14. Security architecture and documentation

Parent issue: #34 — https://github.com/guberm/gvault/issues/34

- [x] #385 Encryption model documented. — https://github.com/guberm/gvault/issues/385
- [x] #386 Authentication model documented. — https://github.com/guberm/gvault/issues/386
- [ ] #387 Zero-knowledge boundary documented. — https://github.com/guberm/gvault/issues/387
- [ ] #388 Master password handling documented. — https://github.com/guberm/gvault/issues/388
- [ ] #389 Key derivation documented. — https://github.com/guberm/gvault/issues/389
- [ ] #390 Device/session token model documented. — https://github.com/guberm/gvault/issues/390
- [ ] #391 Secure sharing crypto documented. — https://github.com/guberm/gvault/issues/391
- [ ] #392 Backup/restore security documented. — https://github.com/guberm/gvault/issues/392
- [x] #393 Recovery limitations documented. — https://github.com/guberm/gvault/issues/393
- [x] #394 Threat model documented. — https://github.com/guberm/gvault/issues/394
- [x] #395 UI copy reviewed so it does not claim unimplemented security. — https://github.com/guberm/gvault/issues/395
- [x] #396 Tests for crypto envelope. — https://github.com/guberm/gvault/issues/396
- [x] #397 Tests for sync/auth boundaries. — https://github.com/guberm/gvault/issues/397

## 15. Proof and E2E

Parent issue: #35 — https://github.com/guberm/gvault/issues/35

- [x] #398 Web E2E through `https://gvault.guber.dev`. — https://github.com/guberm/gvault/issues/398
- [x] #399 Android real-device E2E through `https://gvault.guber.dev`. — https://github.com/guberm/gvault/issues/399
- [x] #400 Chrome extension E2E. — https://github.com/guberm/gvault/issues/400
- [x] #401 Edge extension E2E. — https://github.com/guberm/gvault/issues/401
- [x] #402 Windows desktop login smoke. — https://github.com/guberm/gvault/issues/402
- [x] #403 Linux client login smoke. — https://github.com/guberm/gvault/issues/403
- [x] #404 Server integration tests. — https://github.com/guberm/gvault/issues/404
- [x] #405 Import/export tests. — https://github.com/guberm/gvault/issues/405
- [x] #406 Autofill tests where feasible. — https://github.com/guberm/gvault/issues/406
- [x] #407 Final proof report separates passed/partial/blocked. — https://github.com/guberm/gvault/issues/407 — [`docs/roboform-parity-proof-report.md`](./roboform-parity-proof-report.md)
