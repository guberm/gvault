const state = {
  token: localStorage.getItem("gv.token") || "",
  userId: "",
  masterPassword: "",
  items: [],
  filter: "all"
};

const $ = (id) => document.getElementById(id);

function setStatus(message) {
  $("status").textContent = message;
}

function password(length = 20) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const random = new Uint32Array(length);
  crypto.getRandomValues(random);
  return Array.from(random, (value) => alphabet[value % alphabet.length]).join("");
}

function filteredItems() {
  const query = $("search").value.toLowerCase();
  return state.items.filter((item) => {
    const matchesFilter = state.filter === "all" || item.type === state.filter || (state.filter === "favorite" && item.favorite);
    const searchable = [item.title, item.username, ...(item.urls || []), ...(item.tags || [])].join(" ").toLowerCase();
    return matchesFilter && searchable.includes(query);
  });
}

function render() {
  $("unlockPanel").classList.toggle("hidden", Boolean(state.masterPassword));
  $("vaultPanel").classList.toggle("hidden", !state.masterPassword);
  const items = $("items");
  items.innerHTML = "";
  if (!state.masterPassword) return;
  for (const item of filteredItems()) {
    const row = document.createElement("article");
    row.className = "item";
    row.innerHTML = `<strong>${escapeHtml(item.title)}</strong><span class="muted">${escapeHtml(item.username || item.type)} ${escapeHtml((item.urls || []).join(", "))}</span>`;
    items.append(row);
  }
  if (items.childElementCount === 0) {
    items.innerHTML = `<div class="muted">No matching vault items.</div>`;
  }
  setStatus(`${state.items.length} local items. ${state.token ? "Server session ready." : "Server session not connected."}`);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

async function api(path, body) {
  const response = await fetch(new URL(path, $("serverUrl").value), {
    method: body ? "POST" : "GET",
    headers: {
      "content-type": "application/json",
      ...(state.token ? { authorization: `Bearer ${state.token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json();
}

async function auth(path) {
  const result = await api(path, { email: $("email").value, password: $("accountPassword").value });
  state.token = result.token;
  state.userId = result.userId;
  localStorage.setItem("gv.token", state.token);
  render();
}

$("unlockButton").addEventListener("click", () => {
  state.masterPassword = $("masterPassword").value;
  if (state.masterPassword.length < 12) {
    alert("Master password must be at least 12 characters.");
    state.masterPassword = "";
  }
  render();
});

$("lockButton").addEventListener("click", () => {
  state.masterPassword = "";
  $("masterPassword").value = "";
  render();
});

$("generateButton").addEventListener("click", () => {
  document.querySelector("[name=password]").value = password();
});

$("itemForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.items.unshift({
    id: crypto.randomUUID(),
    type: "login",
    title: form.get("title"),
    username: form.get("username"),
    password: form.get("password"),
    urls: [form.get("url")].filter(Boolean),
    tags: [],
    favorite: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customFields: []
  });
  event.currentTarget.reset();
  render();
});

$("registerButton").addEventListener("click", () => auth("/api/auth/register").catch((error) => alert(error.message)));
$("loginButton").addEventListener("click", () => auth("/api/auth/login").catch((error) => alert(error.message)));
$("syncButton").addEventListener("click", async () => {
  await api("/api/sync/pull", { deviceId: "web-local" });
  setStatus("Sync endpoint reachable. Local encryption bundle integration is next.");
});
$("search").addEventListener("input", render);
document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  state.filter = button.dataset.filter;
  render();
}));

render();
