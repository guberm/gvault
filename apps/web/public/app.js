import { currentTotpCode, totpSecondsRemaining } from "./totp.js";

const deviceId = localStorage.getItem("gv.deviceId") || crypto.randomUUID();
localStorage.setItem("gv.deviceId", deviceId);
const savedTheme = localStorage.getItem("gv.theme") || "light";

const state = {
  token: localStorage.getItem("gv.token") || "",
  userId: localStorage.getItem("gv.userId") || "",
  masterPassword: "",
  items: [],
  encryptedRecords: new Map(),
  filter: "all",
  selectedId: "",
  editingId: "",
};

const typeLabels = {
  login: "Login",
  "secure-note": "Secure note",
  identity: "Identity",
  "payment-card": "Payment card",
  address: "Address",
  authenticator: "Authenticator",
};

const typeFields = {
  login: [
    ["url", "URL", "url", "https://example.com/login"],
    ["username", "Username", "text", "user@example.com"],
    ["password", "Password", "password", "Generated or existing password"],
    ["notes", "Notes", "textarea", "Recovery instructions, account notes"],
  ],
  "secure-note": [["body", "Secure note", "textarea", "Private note body"]],
  identity: [
    ["fullName", "Full name", "text", "Jane Smith"],
    ["email", "Email", "email", "jane@example.com"],
    ["phone", "Phone", "tel", "+1 555 0100"],
    ["organization", "Organization", "text", "Company or family"],
  ],
  "payment-card": [
    ["cardholderName", "Cardholder name", "text", "Jane Smith"],
    ["number", "Card number", "text", "4111 1111 1111 1111"],
    ["expiryMonth", "Expiry month", "text", "08"],
    ["expiryYear", "Expiry year", "text", "2030"],
    ["securityCode", "Security code", "password", "123"],
  ],
  address: [
    ["line1", "Address line 1", "text", "100 Main Street"],
    ["line2", "Address line 2", "text", "Apt 12"],
    ["city", "City", "text", "New York"],
    ["region", "State / region", "text", "NY"],
    ["postalCode", "Postal code", "text", "10001"],
    ["country", "Country", "text", "United States"],
  ],
  authenticator: [["secret", "TOTP secret", "password", "Base32 secret"]],
};

const passphraseWords = ["cedar", "harbor", "signal", "matrix", "orbit", "ember", "forest", "summit", "anchor", "cobalt", "vector", "meadow"];

const $ = (id) => document.getElementById(id);

let qrCodeScanningSupported = false;

async function detectQrCodeScanningSupport() {
  if (typeof globalThis.BarcodeDetector !== "function" || typeof globalThis.BarcodeDetector.getSupportedFormats !== "function") return;
  try {
    const formats = await globalThis.BarcodeDetector.getSupportedFormats();
    qrCodeScanningSupported = formats.includes("qr_code");
    appendQrScanControl();
  } catch {
    qrCodeScanningSupported = false;
  }
}

void detectQrCodeScanningSupport();

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("gv.theme", theme);
  $("themeButton").textContent = theme === "dark" ? "Light mode" : "Dark mode";
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function setStatus(message, tone = "neutral") {
  $("status").textContent = message;
  $("status").dataset.tone = tone;
}

function requireUnlocked() {
  if (!state.masterPassword) {
    setStatus("Unlock the local vault first.", "warning");
    return false;
  }
  return true;
}

let totpTimer;
let totpRequest = 0;

function linkedAuthenticatorForLogin(loginId) {
  const matches = state.items.filter((candidate) => candidate.type === "authenticator" && candidate.loginId === loginId);
  return matches.length === 1 ? matches[0] : undefined;
}

function clearTotpDisplay() {
  clearTimeout(totpTimer);
  totpTimer = undefined;
  totpRequest += 1;
  $("totpResult").replaceChildren();
  $("totpAnnouncement").textContent = "";
}

async function updateTotpDisplay() {
  clearTimeout(totpTimer);
  const selected = state.items.find((candidate) => candidate.id === state.selectedId);
  const item = selected?.type === "authenticator"
    ? selected
    : linkedAuthenticatorForLogin(selected?.id);
  const secret = item?.secret || "";
  const selectedId = selected?.id || "";
  const authenticatorId = item?.id || "";
  const request = ++totpRequest;
  $("totpResult").replaceChildren();
  if (!state.masterPassword || !secret) return;
  try {
    const now = Date.now();
    const code = await currentTotpCode(secret, now);
    const secondsRemaining = totpSecondsRemaining(now);
    const currentSelected = state.items.find((candidate) => candidate.id === state.selectedId);
    const currentAuthenticator = currentSelected?.type === "authenticator"
      ? currentSelected
      : linkedAuthenticatorForLogin(currentSelected?.id);
    if (request !== totpRequest || !state.masterPassword || currentSelected?.id !== selectedId || currentAuthenticator?.id !== authenticatorId || currentAuthenticator?.secret !== secret) return;
    const output = document.createElement("output");
    output.className = "totp-code";
    output.setAttribute("aria-label", "Current TOTP code");
    output.setAttribute("inputmode", "numeric");
    output.textContent = code;
    const progress = document.createElement("progress");
    progress.className = "totp-countdown";
    progress.setAttribute("aria-label", "TOTP code time remaining");
    progress.setAttribute("aria-valuemin", "0");
    progress.setAttribute("aria-valuemax", "30");
    progress.setAttribute("aria-valuenow", String(secondsRemaining));
    progress.setAttribute("aria-valuetext", `${secondsRemaining} seconds remaining`);
    progress.max = 30;
    progress.value = secondsRemaining;
    const copyButton = document.createElement("button");
    copyButton.className = "secondary-button";
    copyButton.type = "button";
    copyButton.textContent = "Copy current TOTP code";
    copyButton.addEventListener("click", async () => {
      if (!copyButton.isConnected || !output.isConnected || !$("totpResult").contains(output)) return;
      try {
        await navigator.clipboard.writeText(output.textContent);
        setStatus("Current TOTP code copied.", "success");
      } catch {
        setStatus("Could not copy current TOTP code.", "warning");
      }
    });
    $("totpResult").replaceChildren(output, progress, copyButton);
    const announcement = `Current TOTP code ${code}`;
    if ($("totpAnnouncement").textContent !== announcement) $("totpAnnouncement").textContent = announcement;
    const delay = 1_000 - (Date.now() % 1_000);
    totpTimer = setTimeout(updateTotpDisplay, delay);
  } catch {
    if (request !== totpRequest) return;
    $("totpAnnouncement").textContent = "";
    const error = document.createElement("p");
    error.className = "totp-error";
    error.setAttribute("role", "alert");
    error.textContent = "This authenticator has an invalid Base32 TOTP secret.";
    $("totpResult").replaceChildren(error);
  }
}

function passwordAlphabet() {
  let alphabet = "";
  if ($("useUpper").checked) alphabet += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if ($("useLower").checked) alphabet += "abcdefghijklmnopqrstuvwxyz";
  if ($("useNumbers").checked) alphabet += "0123456789";
  if ($("useSymbols").checked) alphabet += "!@#$%^&*?";
  if ($("excludeAmbiguous").checked) alphabet = alphabet.replace(/[Il1O0]/g, "");
  return alphabet;
}

function strengthRating(bits) {
  if (bits >= 80) return "strong";
  if (bits >= 50) return "good";
  return "weak";
}

function passwordStrength() {
  if ($("usePassphrase").checked) {
    const bits = Math.round((4 * Math.log2(passphraseWords.length)) + Math.log2(90));
    const rating = strengthRating(bits);
    return { detail: `4 words + 2 digits, ${bits} bits, ${rating}`, rating };
  }
  const length = Number($("passwordLength").value);
  const alphabet = passwordAlphabet();
  if (!alphabet) return { detail: "No character sets selected, unavailable", rating: "unavailable" };
  const bits = Math.round(length * Math.log2(alphabet.length));
  const rating = strengthRating(bits);
  return { detail: `${length} characters, ${bits} bits, ${rating}`, rating };
}

function updateStrengthIndicator() {
  const strength = passwordStrength();
  $("strengthLabel").textContent = strength.detail;
  $("strengthRating").textContent = strength.rating[0].toUpperCase() + strength.rating.slice(1);
  $("strengthRating").dataset.rating = strength.rating;
}

function generatePassword() {
  const length = Number($("passwordLength").value);
  if ($("usePassphrase").checked) {
    const words = Array.from({ length: 4 }, () => passphraseWords[randomInt(passphraseWords.length)]);
    return `${words.join("-")}-${randomInt(90) + 10}`;
  }
  const alphabet = passwordAlphabet();
  if (!alphabet) return "";
  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join("");
}

function randomInt(max) {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return random[0] % max;
}

function renderTypeFields() {
  const type = $("itemType").value;
  $("formTitle").textContent = state.editingId ? `Edit ${typeLabels[type]}` : `New ${typeLabels[type].toLowerCase()}`;
  $("typeFields").innerHTML = typeFields[type].map(([name, label, inputType, placeholder]) => {
    if (inputType === "textarea") {
      return `<label class="field wide"><span>${label}</span><textarea name="${name}" placeholder="${placeholder}"></textarea></label>`;
    }
    return `<label class="field"><span>${label}</span><input name="${name}" type="${inputType}" placeholder="${placeholder}" /></label>`;
  }).join("") + (type === "authenticator" ? `
    <label class="field"><span>Linked Login</span><select name="loginId">
      <option value="">Not linked</option>
      ${state.items.filter((item) => item.type === "login").map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(`${item.title} — ${item.username || item.url || item.id} — ${item.id}`)}</option>`).join("")}
    </select></label>
  ` : "");
  appendQrScanControl();
  updateUseGeneratedPasswordButton();
}

function appendQrScanControl() {
  if (!qrCodeScanningSupported || $("itemType").value !== "authenticator" || $("typeFields").querySelector('[name="authenticatorQrImage"]')) return;
  const label = document.createElement("label");
  label.className = "field";
  const text = document.createElement("span");
  text.textContent = "Scan authenticator QR code";
  const input = document.createElement("input");
  input.name = "authenticatorQrImage";
  input.type = "file";
  input.accept = "image/*";
  input.setAttribute("capture", "environment");
  label.append(text, input);
  $("typeFields").append(label);
}

function isValidBase32Secret(secret) {
  const normalized = String(secret).toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
  if (!normalized || /[^A-Z2-7]/.test(normalized)) return false;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let bitCount = 0;
  let byteCount = 0;
  for (const character of normalized) {
    bits = (bits << 5) | alphabet.indexOf(character);
    bitCount += 5;
    if (bitCount >= 8) {
      bitCount -= 8;
      byteCount += 1;
    }
  }
  return byteCount > 0 && (bitCount === 0 || (bits & ((1 << bitCount) - 1)) === 0);
}

function parseTotpQrPayload(rawValue) {
  let url;
  try {
    url = new URL(rawValue);
  } catch {
    throw new Error("The selected image does not contain a valid authenticator QR code.");
  }
  if (url.protocol !== "otpauth:") throw new Error("The selected image does not contain a valid authenticator QR code.");
  if (url.hostname.toLowerCase() !== "totp") throw new Error("Only TOTP authenticator QR codes are supported.");

  const supportedParameters = new Set(["secret", "issuer", "algorithm", "digits", "period"]);
  const hasUnknownParameter = [...url.searchParams.keys()].some((name) => !supportedParameters.has(name));
  const hasDuplicateParameter = [...supportedParameters].some((name) => url.searchParams.getAll(name).length > 1);
  const algorithm = (url.searchParams.get("algorithm") || "SHA1").toUpperCase();
  const digits = url.searchParams.get("digits") || "6";
  const period = url.searchParams.get("period") || "30";
  if (hasUnknownParameter || hasDuplicateParameter || algorithm !== "SHA1" || digits !== "6" || period !== "30") {
    throw new Error("This authenticator QR code uses unsupported settings.");
  }

  const secret = (url.searchParams.get("secret") || "").trim();
  let label = "";
  try {
    label = decodeURIComponent(url.pathname.replace(/^\/+/, "")).trim();
  } catch {
    throw new Error("The selected image does not contain a valid authenticator QR code.");
  }
  const issuer = (url.searchParams.get("issuer") || "").trim();
  if (!isValidBase32Secret(secret) || (!label && !issuer)) throw new Error("The selected image does not contain a valid authenticator QR code.");
  return { secret, title: label || issuer };
}

async function scanAuthenticatorQr(file, sourceInput, scanRequest) {
  let image;
  try {
    image = await createImageBitmap(file);
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const detected = await detector.detect(image);
    const rawValue = detected.find((result) => typeof result.rawValue === "string" && result.rawValue)?.rawValue || "";
    const parsed = parseTotpQrPayload(rawValue);
    if (!sourceInput.isConnected || $("itemType").value !== "authenticator" || sourceInput.qrScanRequest !== scanRequest) return;
    $("itemForm").elements.namedItem("title").value = parsed.title;
    $("itemForm").elements.namedItem("secret").value = parsed.secret;
    setStatus("Authenticator QR code added to the editor. Review it and save changes.", "success");
  } catch (error) {
    if (!sourceInput.isConnected || $("itemType").value !== "authenticator" || sourceInput.qrScanRequest !== scanRequest) return;
    const safeMessages = new Set([
      "The selected image does not contain a valid authenticator QR code.",
      "Only TOTP authenticator QR codes are supported.",
      "This authenticator QR code uses unsupported settings.",
    ]);
    setStatus(safeMessages.has(error?.message) ? error.message : "The selected image could not be scanned as an authenticator QR code.", "warning");
  } finally {
    image?.close?.();
  }
}

function updateUseGeneratedPasswordButton() {
  $("useGeneratedPasswordButton").disabled = !$("generatedPassword").value || $("itemType").value !== "login";
}

function getSearchText(item) {
  return [
    item.title,
    item.type,
    item.folder,
    ...(item.tags || []),
    item.username,
    item.url,
    item.fullName,
    item.email,
    item.cardholderName,
    item.city,
    item.country,
  ].filter(Boolean).join(" ").toLowerCase();
}

function folderPath(folder) {
  return String(folder || "").split("/").map((part) => part.trim()).filter(Boolean).join("/");
}

function itemTags(item) {
  return [...new Set((item.tags || []).map((tag) => String(tag).trim()).filter(Boolean))];
}

function filteredItems() {
  const query = $("search").value.trim().toLowerCase();
  return state.items.filter((item) => {
    const selectedFolder = state.filter.startsWith("folder:") ? state.filter.slice(7) : "";
    const selectedTag = state.filter.startsWith("tag:") ? state.filter.slice(4) : "";
    const itemFolder = folderPath(item.folder);
    const matchesFilter = selectedFolder
      ? itemFolder === selectedFolder || itemFolder.startsWith(`${selectedFolder}/`)
      : selectedTag
        ? itemTags(item).includes(selectedTag)
      : state.filter === "all" || item.type === state.filter || (state.filter === "favorite" && item.favorite);
    return matchesFilter && (!query || getSearchText(item).includes(query));
  });
}

function renderFolders() {
  const counts = new Map();
  for (const item of state.items) {
    const parts = folderPath(item.folder).split("/").filter(Boolean);
    for (let depth = 1; depth <= parts.length; depth += 1) {
      const path = parts.slice(0, depth).join("/");
      counts.set(path, (counts.get(path) || 0) + 1);
    }
  }
  if (state.filter.startsWith("folder:") && !counts.has(state.filter.slice(7))) state.filter = "all";
  $("folderList").replaceChildren(...[...counts].sort(([a], [b]) => a.localeCompare(b)).map(([folder, count]) => {
    const button = document.createElement("button");
    const parts = folder.split("/");
    button.type = "button";
    button.dataset.filter = `folder:${folder}`;
    button.setAttribute("aria-label", `${folder} (${count})`);
    button.title = folder;
    button.style.paddingInlineStart = `${10 + ((parts.length - 1) * 16)}px`;
    button.append(parts.at(-1), Object.assign(document.createElement("span"), { textContent: count }));
    return button;
  }));
  document.querySelectorAll("[data-filter]").forEach((button) => button.classList.toggle("active", button.dataset.filter === state.filter));
}

function renderTags() {
  const counts = new Map();
  for (const item of state.items) {
    for (const tag of itemTags(item)) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  if (state.filter.startsWith("tag:") && !counts.has(state.filter.slice(4))) state.filter = "all";
  $("tagList").replaceChildren(...[...counts].sort(([a], [b]) => a.localeCompare(b)).map(([tag, count]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.filter = `tag:${tag}`;
    button.setAttribute("aria-label", `${tag} (${count})`);
    button.append(tag, Object.assign(document.createElement("span"), { textContent: count }));
    return button;
  }));
  document.querySelectorAll("[data-filter]").forEach((button) => button.classList.toggle("active", button.dataset.filter === state.filter));
}

function renderCounts() {
  const counts = {
    all: state.items.length,
    login: state.items.filter((item) => item.type === "login").length,
    "secure-note": state.items.filter((item) => item.type === "secure-note").length,
    identity: state.items.filter((item) => item.type === "identity").length,
    "payment-card": state.items.filter((item) => item.type === "payment-card").length,
    address: state.items.filter((item) => item.type === "address").length,
    authenticator: state.items.filter((item) => item.type === "authenticator").length,
    favorite: state.items.filter((item) => item.favorite).length,
  };
  $("countAll").textContent = counts.all;
  $("countLogin").textContent = counts.login;
  $("countNote").textContent = counts["secure-note"];
  $("countIdentity").textContent = counts.identity;
  $("countCard").textContent = counts["payment-card"];
  $("countAddress").textContent = counts.address;
  $("countAuthenticator").textContent = counts.authenticator;
  $("countFavorite").textContent = counts.favorite;
}

function renderItems() {
  const list = filteredItems();
  $("listSummary").textContent = `${list.length} shown of ${state.items.length} unlocked item${state.items.length === 1 ? "" : "s"}.`;
  const itemsEl = $("items");
  itemsEl.innerHTML = "";
  if (list.length === 0) {
    itemsEl.innerHTML = `<div class="empty-state"><strong>No matching items</strong><span>Adjust search, change category, or add a new vault item.</span></div>`;
    return;
  }
  for (const item of list) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `item-row${item.id === state.selectedId ? " active" : ""}`;
    row.dataset.id = item.id;
    row.innerHTML = `
      <span class="item-icon">${item.favorite ? "*" : typeLabels[item.type][0]}</span>
      <span class="item-copy">
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(itemSummary(item))}</small>
      </span>
      <span class="item-type">${escapeHtml(typeLabels[item.type])}</span>
    `;
    itemsEl.append(row);
  }
}

function itemSummary(item) {
  if (item.type === "login") return `${item.username || "No username"} ${item.url ? "- " + item.url : ""}`;
  if (item.type === "secure-note") return item.body ? `${item.body.slice(0, 52)}${item.body.length > 52 ? "..." : ""}` : "Secure note";
  if (item.type === "identity") return [item.fullName, item.email].filter(Boolean).join(" - ") || "Identity";
  if (item.type === "payment-card") return `${item.cardholderName || "Card"} ${item.number ? "- **** " + item.number.slice(-4) : ""}`;
  if (item.type === "address") return [item.city, item.region, item.country].filter(Boolean).join(", ") || "Address";
  if (item.type === "authenticator") return "Authenticator";
  return item.type;
}

function renderDetail() {
  const item = state.items.find((candidate) => candidate.id === state.selectedId);
  const linkedAuthenticator = item?.type === "login"
    ? linkedAuthenticatorForLogin(item.id)
    : undefined;
  $("favoriteButton").disabled = !item;
  clearTotpDisplay();
  $("authenticatorCard").classList.toggle("hidden", item?.type !== "authenticator" && !linkedAuthenticator);
  if (!item) {
    $("detailTitle").textContent = "No item selected";
    $("detailSubtitle").textContent = "Create or select a vault item.";
    $("detailBody").className = "detail-body empty-state";
    $("detailBody").innerHTML = `<strong>Ready for your first record</strong><span>Add a login, secure note, identity, payment card, or address. Then sync encrypted records to your server.</span>`;
    return;
  }
  $("detailTitle").textContent = item.title;
  $("detailSubtitle").textContent = `${typeLabels[item.type]}${item.folder ? " in " + item.folder : ""}`;
  $("favoriteButton").textContent = item.favorite ? "Unfavorite" : "Favorite";
  $("detailBody").className = "detail-body";
  $("detailBody").innerHTML = detailRows(item).map(([label, value, concealed]) => `
    <div class="detail-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(concealed && value ? "••••••••" : value || "Not set")}</strong>
      <button type="button" aria-label="Copy ${escapeHtml(label)}">▣</button>
    </div>
  `).join("") + `
    <div class="detail-meta">
      <span>Tags: ${escapeHtml((item.tags || []).join(", ") || "none")}</span>
      <span>Updated ${new Date(item.updatedAt).toLocaleString()}</span>
    </div>
  `;
  if (item.type === "authenticator" || linkedAuthenticator) void updateTotpDisplay();
}

function detailRows(item) {
  if (item.type === "login") return [["URL", item.url], ["Username", item.username], ["Password", item.password, true], ["Notes", item.notes]];
  if (item.type === "secure-note") return [["Body", item.body]];
  if (item.type === "identity") return [["Full name", item.fullName], ["Email", item.email], ["Phone", item.phone], ["Organization", item.organization]];
  if (item.type === "payment-card") return [["Cardholder", item.cardholderName], ["Number", item.number ? "**** " + item.number.slice(-4) : ""], ["Expiry", [item.expiryMonth, item.expiryYear].filter(Boolean).join("/")], ["Security code", item.securityCode, true]];
  if (item.type === "address") return [["Line 1", item.line1], ["Line 2", item.line2], ["City", item.city], ["Region", item.region], ["Postal code", item.postalCode], ["Country", item.country]];
  if (item.type === "authenticator") return [["Secret", item.secret, true]];
  return [];
}

function render() {
  const unlocked = Boolean(state.masterPassword);
  $("unlockPanel").classList.toggle("hidden", unlocked);
  $("vaultPanel").classList.toggle("hidden", !unlocked);
  $("vaultNavigation").classList.toggle("hidden", !unlocked);
  $("lockState").textContent = unlocked ? "Unlocked" : "Locked";
  $("lockState").nextElementSibling.textContent = unlocked ? "Vault is unlocked" : "Vault is locked";
  $("lockButton").disabled = !unlocked;
  renderCounts();
  renderFolders();
  renderTags();
  renderItems();
  renderDetail();
  if (unlocked) {
    setStatus(`${state.items.length} item${state.items.length === 1 ? "" : "s"} unlocked. ${state.token ? "Server session ready." : "Server login optional until sync."}`, state.token ? "success" : "neutral");
  }
}

function formToItem(form) {
  const data = new FormData(form);
  const type = data.get("type");
  const now = new Date().toISOString();
  const base = {
    id: state.editingId || crypto.randomUUID(),
    type,
    title: String(data.get("title") || "").trim(),
    folder: String(data.get("folder") || "").trim(),
    tags: String(data.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean),
    favorite: state.items.find((item) => item.id === state.editingId)?.favorite || false,
    createdAt: state.items.find((item) => item.id === state.editingId)?.createdAt || now,
    updatedAt: now,
    customFields: [],
  };
  if (!base.title) throw new Error("Title is required.");
  if (type === "login") return { ...base, username: String(data.get("username") || ""), password: String(data.get("password") || ""), url: String(data.get("url") || ""), urls: [String(data.get("url") || "")].filter(Boolean), notes: String(data.get("notes") || "") };
  if (type === "secure-note") return { ...base, body: String(data.get("body") || "") };
  if (type === "identity") return { ...base, fullName: String(data.get("fullName") || ""), email: String(data.get("email") || ""), phone: String(data.get("phone") || ""), organization: String(data.get("organization") || "") };
  if (type === "payment-card") return { ...base, cardholderName: String(data.get("cardholderName") || ""), number: String(data.get("number") || ""), expiryMonth: String(data.get("expiryMonth") || ""), expiryYear: String(data.get("expiryYear") || ""), securityCode: String(data.get("securityCode") || "") };
  if (type === "authenticator") return { ...base, secret: String(data.get("secret") || "").trim(), loginId: String(data.get("loginId") || "") };
  return { ...base, line1: String(data.get("line1") || ""), line2: String(data.get("line2") || ""), city: String(data.get("city") || ""), region: String(data.get("region") || ""), postalCode: String(data.get("postalCode") || ""), country: String(data.get("country") || "") };
}

function fillForm(item) {
  state.editingId = item?.id || "";
  $("itemForm").reset();
  $("itemType").value = item?.type || "login";
  renderTypeFields();
  if (!item) return;
  for (const [key, value] of Object.entries(item)) {
    const field = $("itemForm").elements.namedItem(key);
    if (field && typeof value !== "object") field.value = value || "";
  }
  $("itemForm").elements.namedItem("tags").value = (item.tags || []).join(", ");
}

function startLoginCreate() {
  state.selectedId = "";
  fillForm();
  render();
  setStatus("Creating a new Login item. Fill the fields and save changes.", "neutral");
  $("itemForm").elements.namedItem("title").focus();
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.replace(/\r$/, ""));
  rows.push(row);
  return rows;
}

function parseRoboFormFields(value = "") {
  if (!value.trim()) return [];
  const fields = parseCsvRows(value)[0] || [];
  const customFields = [];
  for (let index = 0; index + 4 < fields.length; index += 5) {
    const rawName = fields[index] || fields[index + 2];
    const fieldType = fields[index + 3] || "txt";
    const fieldValue = fields[index + 4] || "";
    const name = rawName.trim();
    if (!name || fieldValue === "") continue;
    customFields.push({
      name,
      value: fieldValue,
      concealed: /pass|pwd|secret|card|cvv|pin/i.test(`${name} ${fieldType}`),
    });
  }
  return customFields;
}

function parseRoboFormCsv(text) {
  const rows = parseCsvRows(text).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (rows.length === 0) throw new Error("RoboForm CSV is empty.");
  const headers = rows[0].map((header) => header.trim());
  const headerIndex = new Map(headers.map((header, index) => [header.toLowerCase(), index]));
  const required = ["name", "url", "login", "pwd"];
  const missing = required.filter((header) => !headerIndex.has(header));
  if (missing.length > 0) throw new Error(`Unsupported RoboForm CSV. Missing: ${missing.join(", ")}.`);
  const value = (row, header) => (row[headerIndex.get(header.toLowerCase())] || "").trim();
  const imported = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const title = value(row, "Name") || value(row, "Url") || value(row, "MatchUrl");
    const username = value(row, "Login");
    const password = value(row, "Pwd");
    const url = value(row, "Url");
    const matchUrl = value(row, "MatchUrl");
    const notes = value(row, "Note");
    const folder = value(row, "Folder");
    const rfFields = value(row, "RfFieldsV2");
    if (!title && !username && !password && !url && !notes) {
      skipped += 1;
      continue;
    }
    const now = new Date().toISOString();
    imported.push({
      id: crypto.randomUUID(),
      type: "login",
      title: title || `RoboForm import ${imported.length + 1}`,
      folder,
      tags: ["roboform-import"],
      favorite: false,
      createdAt: now,
      updatedAt: now,
      customFields: parseRoboFormFields(rfFields),
      username,
      password,
      url,
      urls: [...new Set([url, matchUrl].map((candidate) => candidate.trim()).filter(Boolean))],
      notes,
    });
  }
  return { source: "roboform", items: imported, skipped };
}

function normalizeCsvHeader(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function firstCsvHeader(headerIndex, names) {
  return names.find((name) => headerIndex.has(name)) || "";
}

function parseGenericLoginCsv(text) {
  const rows = parseCsvRows(text).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (rows.length === 0) throw new Error("CSV is empty.");
  const headers = rows[0].map((header) => header.trim());
  const headerIndex = new Map(headers.map((header, index) => [normalizeCsvHeader(header), index]));
  const titleHeader = firstCsvHeader(headerIndex, ["title", "name", "label"]);
  const urlHeader = firstCsvHeader(headerIndex, ["url", "website", "site", "login_url", "loginurl"]);
  const usernameHeader = firstCsvHeader(headerIndex, ["username", "user", "login", "email"]);
  const passwordHeader = firstCsvHeader(headerIndex, ["password", "pwd", "pass"]);
  const noteHeader = firstCsvHeader(headerIndex, ["notes", "note", "comments", "comment"]);
  const folderHeader = firstCsvHeader(headerIndex, ["folder", "group", "category"]);
  const missing = [titleHeader ? "" : "title/name", urlHeader ? "" : "url", usernameHeader ? "" : "username/login", passwordHeader ? "" : "password/pwd"].filter(Boolean);
  if (missing.length > 0) throw new Error(`Unsupported login CSV. Missing: ${missing.join(", ")}.`);
  const value = (row, header) => (row[headerIndex.get(header)] || "").trim();
  const imported = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const title = value(row, titleHeader);
    const url = value(row, urlHeader);
    const username = value(row, usernameHeader);
    const password = value(row, passwordHeader);
    const notes = noteHeader ? value(row, noteHeader) : "";
    const folder = folderHeader ? value(row, folderHeader) : "";
    if (!title && !url && !username && !password && !notes) {
      skipped += 1;
      continue;
    }
    const now = new Date().toISOString();
    imported.push({
      id: crypto.randomUUID(),
      type: "login",
      title: title || url || `CSV import ${imported.length + 1}`,
      folder,
      tags: ["csv-import"],
      favorite: false,
      createdAt: now,
      updatedAt: now,
      customFields: [],
      username,
      password,
      url,
      urls: [url].filter(Boolean),
      notes,
    });
  }
  return { source: "generic-csv", items: imported, skipped };
}

function parseLoginCsv(text) {
  const headerRow = parseCsvRows(text).find((row) => row.some((cell) => cell.trim() !== "")) || [];
  const headers = new Set(headerRow.map((header) => normalizeCsvHeader(header)));
  if (["name", "url", "login", "pwd"].every((header) => headers.has(header))) return parseRoboFormCsv(text);
  if (["type", "name", "login_uri", "login_username", "login_password"].every((header) => headers.has(header))) return parseBitwardenCsv(text);
  if (["title", "website", "username", "password"].every((header) => headers.has(header))) return parseOnePasswordCsv(text);
  return parseGenericLoginCsv(text);
}

function parseBitwardenCsv(text) {
  const rows = parseCsvRows(text).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (rows.length === 0) throw new Error("Bitwarden CSV is empty.");
  const headers = rows[0].map((header) => header.trim());
  const headerIndex = new Map(headers.map((header, index) => [normalizeCsvHeader(header), index]));
  const required = ["type", "name", "login_uri", "login_username", "login_password"];
  const missing = required.filter((header) => !headerIndex.has(header));
  if (missing.length > 0) throw new Error(`Unsupported Bitwarden CSV. Missing: ${missing.join(", ")}.`);
  const value = (row, header) => (row[headerIndex.get(header)] || "").trim();
  const imported = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    if (value(row, "type").toLowerCase() !== "login") {
      skipped += 1;
      continue;
    }
    const title = value(row, "name");
    const url = value(row, "login_uri");
    const username = value(row, "login_username");
    const password = value(row, "login_password");
    const notes = value(row, "notes");
    if (!title && !url && !username && !password && !notes) {
      skipped += 1;
      continue;
    }
    const customFields = [];
    const totp = value(row, "login_totp");
    if (totp) customFields.push({ name: "totp", value: totp, concealed: true });
    const fields = value(row, "fields");
    if (fields) customFields.push({ name: "bitwarden fields", value: fields, concealed: false });
    const now = new Date().toISOString();
    imported.push({
      id: crypto.randomUUID(),
      type: "login",
      title: title || url || `Bitwarden import ${imported.length + 1}`,
      folder: value(row, "folder"),
      tags: ["bitwarden-import"],
      favorite: ["1", "true", "yes"].includes(value(row, "favorite").toLowerCase()),
      createdAt: now,
      updatedAt: now,
      customFields,
      username,
      password,
      url,
      urls: [url].filter(Boolean),
      notes,
    });
  }
  return { source: "bitwarden", items: imported, skipped };
}

function parseOnePasswordCsv(text) {
  const rows = parseCsvRows(text).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (rows.length === 0) throw new Error("1Password CSV is empty.");
  const headers = rows[0].map((header) => header.trim());
  const headerIndex = new Map(headers.map((header, index) => [normalizeCsvHeader(header), index]));
  const required = ["title", "website", "username", "password"];
  const missing = required.filter((header) => !headerIndex.has(header));
  if (missing.length > 0) throw new Error(`Unsupported 1Password CSV. Missing: ${missing.join(", ")}.`);
  const value = (row, header) => (row[headerIndex.get(header)] || "").trim();
  const imported = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const title = value(row, "title");
    const url = value(row, "website");
    const username = value(row, "username");
    const password = value(row, "password");
    const notes = value(row, "notes");
    if (!title && !url && !username && !password && !notes) {
      skipped += 1;
      continue;
    }
    const customFields = [];
    const totp = value(row, "one_time_password");
    if (totp) customFields.push({ name: "totp", value: totp, concealed: true });
    const now = new Date().toISOString();
    imported.push({
      id: crypto.randomUUID(),
      type: "login",
      title: title || url || `1Password import ${imported.length + 1}`,
      folder: "",
      tags: ["1password-import"],
      favorite: false,
      createdAt: now,
      updatedAt: now,
      customFields,
      username,
      password,
      url,
      urls: [url].filter(Boolean),
      notes,
    });
  }
  return { source: "1password", items: imported, skipped };
}

function importKey(item) {
  return [item.type, item.title, item.username || "", item.url || item.urls?.[0] || ""].join("\u0000").toLowerCase();
}

async function importCsvFile(file) {
  if (!requireUnlocked()) return;
  const text = await file.text();
  const result = parseLoginCsv(text);
  const existing = new Set(state.items.map(importKey));
  const imported = result.items.filter((item) => !existing.has(importKey(item)));
  const duplicates = result.items.length - imported.length;
  state.items = [...imported, ...state.items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  state.selectedId = imported[0]?.id || state.selectedId;
  fillForm(state.items.find((item) => item.id === state.selectedId));
  render();
  const label = result.source === "roboform" ? "RoboForm login" : result.source === "bitwarden" ? "Bitwarden login" : result.source === "1password" ? "1Password login" : "CSV login";
  const summary = `Imported ${imported.length} ${label}${imported.length === 1 ? "" : "s"}${duplicates ? `, skipped ${duplicates} duplicate${duplicates === 1 ? "" : "s"}` : ""}${result.skipped ? `, ignored ${result.skipped} empty row${result.skipped === 1 ? "" : "s"}` : ""}.`;
  setStatus(state.token ? `${summary} Syncing encrypted records...` : `${summary} Login and sync to upload encrypted records.`, "success");
  if (state.token && imported.length > 0) await syncVault();
}

async function api(path, body, method = "POST") {
  const response = await fetch(new URL(path, $("serverUrl").value), {
    method,
    headers: {
      "content-type": "application/json",
      ...(state.token ? { authorization: `Bearer ${state.token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `API ${response.status}`);
  return payload;
}

async function auth(path) {
  const password = $("accountPassword").value;
  if (!password.trim()) {
    setStatus("Account password is required.", "warning");
    $("accountPassword").focus();
    return;
  }
  const result = await api(path, { email: $("email").value, password });
  state.token = result.token;
  state.userId = result.userId;
  localStorage.setItem("gv.token", state.token);
  localStorage.setItem("gv.userId", state.userId);
  $("emailLabel").textContent = $("email").value.split("@")[0] || "admin";
  setStatus("Server session established.", "success");
  render();
}

async function syncVault() {
  if (!requireUnlocked()) return;
  if (!state.token) {
    setStatus("Login or register before sync.", "warning");
    return;
  }
  const records = await Promise.all(state.items.map(itemToEncryptedRecord));
  const pushed = await api("/api/sync/push", { deviceId, records });
  for (const record of pushed.records || []) {
    state.encryptedRecords.set(record.id, record);
  }
  const pulled = await api("/api/sync/pull", { deviceId });
  const imported = [];
  for (const record of pulled.records || []) {
    if (state.items.some((item) => item.id === record.id)) continue;
    try {
      imported.push(await encryptedRecordToItem(record));
    } catch {
      setStatus("One synced record could not be decrypted with this master password.", "warning");
    }
  }
  state.items = [...imported, ...state.items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  render();
  setStatus(`Sync complete: ${records.length} pushed, ${imported.length} imported.`, "success");
}

async function itemToEncryptedRecord(item) {
  const encrypted = await encryptJson(item);
  return {
    id: item.id,
    ownerId: state.userId,
    deviceId,
    collection: "vault-items",
    ciphertext: encrypted.ciphertext,
    nonce: encrypted.nonce,
    salt: encrypted.salt,
    schemaVersion: 1,
    deleted: false,
    updatedAt: item.updatedAt,
    revision: Date.parse(item.updatedAt),
  };
}

async function encryptedRecordToItem(record) {
  return decryptJson({ ciphertext: record.ciphertext, nonce: record.nonce, salt: record.salt });
}

async function deriveKey(salt) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(state.masterPassword), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptJson(value) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(salt);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(value)));
  return { ciphertext: toBase64(ciphertext), nonce: toBase64(iv), salt: toBase64(salt) };
}

async function decryptJson(record) {
  const salt = fromBase64(record.salt);
  const iv = fromBase64(record.nonce);
  const key = await deriveKey(salt);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, fromBase64(record.ciphertext));
  return JSON.parse(new TextDecoder().decode(plaintext));
}

function toBase64(value) {
  return btoa(String.fromCharCode(...new Uint8Array(value)));
}

function fromBase64(value = "") {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

$("unlockButton").addEventListener("click", () => {
  const master = $("masterPassword").value;
  if (master.length < 12) {
    setStatus("Use at least 12 characters for the master password.", "warning");
    return;
  }
  state.masterPassword = master;
  $("masterPassword").value = "";
  fillForm();
  setStatus("Vault unlocked.", "success");
  render();
});

$("lockButton").addEventListener("click", () => {
  state.masterPassword = "";
  state.items = [];
  state.selectedId = "";
  state.editingId = "";
  clearTotpDisplay();
  fillForm();
  render();
  setStatus("Vault locked. Decrypted session data cleared.", "success");
});

$("itemType").addEventListener("change", renderTypeFields);
$("typeFields").addEventListener("change", (event) => {
  const input = event.target.closest('input[name="authenticatorQrImage"]');
  const file = input?.files?.[0];
  if (!file) return;
  const scanRequest = Symbol();
  input.qrScanRequest = scanRequest;
  void scanAuthenticatorQr(file, input, scanRequest).finally(() => { input.value = ""; });
});
[
  "passwordLength",
  "useUpper",
  "useLower",
  "useNumbers",
  "useSymbols",
  "excludeAmbiguous",
  "usePassphrase",
].forEach((id) => $(id).addEventListener("input", updateStrengthIndicator));
updateStrengthIndicator();

$("generateButton").addEventListener("click", () => {
  const password = generatePassword();
  if (!password) {
    setStatus("Select at least one character set.", "warning");
    return;
  }
  $("generatedPassword").value = password;
  $("copyGeneratedPasswordButton").disabled = false;
  $("saveGeneratedLoginButton").disabled = false;
  updateUseGeneratedPasswordButton();
  setStatus("Generated password ready.", "success");
});

$("useGeneratedPasswordButton").addEventListener("click", () => {
  const password = $("generatedPassword").value;
  const passwordField = $("itemForm").elements.namedItem("password");
  if (!password || !passwordField) {
    updateUseGeneratedPasswordButton();
    setStatus("Switch to Login type to use the generated password.", "warning");
    return;
  }
  passwordField.value = password;
  setStatus("Generated password placed in the Login editor.", "success");
});

$("saveGeneratedLoginButton").addEventListener("click", () => {
  const password = $("generatedPassword").value;
  if (!password) {
    $("saveGeneratedLoginButton").disabled = true;
    return;
  }
  state.selectedId = "";
  fillForm();
  $("itemForm").elements.namedItem("password").value = password;
  render();
  setStatus("New Login draft ready. Add a name and save changes to keep it.", "success");
  $("itemForm").scrollIntoView({ block: "start" });
  $("itemForm").elements.namedItem("title").focus();
});

$("copyGeneratedPasswordButton").addEventListener("click", async () => {
  const password = $("generatedPassword").value;
  if (!password) return;
  try {
    await navigator.clipboard.writeText(password);
    setStatus("Generated password copied.", "success");
  } catch {
    setStatus("Could not copy generated password.", "warning");
  }
});

$("itemForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireUnlocked()) return;
  try {
    const item = formToItem(event.currentTarget);
    state.items = [item, ...state.items.filter((candidate) => candidate.id !== item.id)];
    state.selectedId = item.id;
    fillForm();
    setStatus("Item saved locally. Sync when ready.", "success");
    render();
  } catch (error) {
    setStatus(error.message, "warning");
  }
});

$("clearFormButton").addEventListener("click", () => {
  fillForm();
  setStatus("Editor cleared.", "neutral");
});

$("newItemButton").addEventListener("click", () => {
  startLoginCreate();
});

$("createLoginButton").addEventListener("click", startLoginCreate);

$("favoriteButton").addEventListener("click", () => {
  const item = state.items.find((candidate) => candidate.id === state.selectedId);
  if (!item) return;
  item.favorite = !item.favorite;
  item.updatedAt = new Date().toISOString();
  render();
});

$("items").addEventListener("click", (event) => {
  const row = event.target.closest("[data-id]");
  if (!row) return;
  const item = state.items.find((candidate) => candidate.id === row.dataset.id);
  state.selectedId = row.dataset.id;
  fillForm(item);
  render();
});

$("registerButton").addEventListener("click", () => auth("/api/auth/register").catch((error) => setStatus(error.message, "warning")));
$("loginButton").addEventListener("click", () => auth("/api/auth/login").catch((error) => setStatus(error.message, "warning")));
$("syncButton").addEventListener("click", () => syncVault().catch((error) => setStatus(error.message, "warning")));
$("generatorNavButton").addEventListener("click", () => {
  document.querySelector(".generator").scrollIntoView({ block: "start", behavior: "smooth" });
  $("generateButton").focus({ preventScroll: true });
});
$("healthCheckButton").addEventListener("click", async () => {
  try {
    setStatus("Checking server health...", "neutral");
    const response = await fetch(new URL("/healthz", $("serverUrl").value));
    const health = await response.json();
    if (!response.ok || health?.ok !== true) throw new Error("Server health check failed.");
    setStatus(`Server healthy${health.product ? `: ${health.product}` : ""}.`, "success");
  } catch {
    setStatus("Server health check failed.", "warning");
  }
});
$("importRoboFormButton").addEventListener("click", () => {
  if (!requireUnlocked()) return;
  $("roboFormImportFile").click();
});
$("roboFormImportFile").addEventListener("change", (event) => {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;
  importCsvFile(file)
    .catch((error) => setStatus(error.message, "warning"))
    .finally(() => {
      input.value = "";
    });
});
$("search").addEventListener("input", render);
$("themeButton").addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    render();
  });
});

$("folderList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter;
  render();
});

$("tagList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter;
  render();
});

applyTheme(savedTheme);
renderTypeFields();
render();
