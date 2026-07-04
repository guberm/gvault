import { nowIso, uid } from "@gvault/shared-utils";
import { normalizeUrlHost, type CustomField, type LoginItem, type VaultItem, type VaultItemType } from "@gvault/vault-models";

export interface PasswordGeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
}

export interface RoboFormImportResult {
  items: LoginItem[];
  skippedRows: number;
  warnings: string[];
}

export interface LoginCsvImportResult {
  source: "roboform" | "generic-csv" | "bitwarden";
  items: LoginItem[];
  skippedRows: number;
  warnings: string[];
}

const sets = {
  uppercase: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  lowercase: "abcdefghijkmnopqrstuvwxyz",
  numbers: "23456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?"
};

export function generatePassword(options: PasswordGeneratorOptions): string {
  const alphabet = [
    options.uppercase ? sets.uppercase : "",
    options.lowercase ? sets.lowercase : "",
    options.numbers ? sets.numbers : "",
    options.symbols ? sets.symbols : ""
  ].join("");
  if (options.length < 8 || alphabet.length === 0) throw new Error("Invalid password generator options");
  const random = new Uint32Array(options.length);
  globalThis.crypto.getRandomValues(random);
  return Array.from(random, (value) => alphabet[value % alphabet.length]).join("");
}

export function generatePassphrase(wordCount = 5): string {
  const words = ["river", "copper", "signal", "harbor", "matrix", "sierra", "orbit", "velvet", "cedar", "summit"];
  const random = new Uint32Array(wordCount);
  globalThis.crypto.getRandomValues(random);
  return Array.from(random, (value) => words[value % words.length]).join("-");
}

export function estimatePasswordStrength(password: string): "weak" | "fair" | "good" | "strong" {
  let score = password.length >= 12 ? 1 : 0;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (password.length >= 20) score += 1;
  return score >= 5 ? "strong" : score >= 4 ? "good" : score >= 3 ? "fair" : "weak";
}

export function createVaultItem<T extends VaultItemType>(type: T, title: string, values: Record<string, unknown>): VaultItem {
  const base = {
    id: uid("item"),
    type,
    title,
    tags: [],
    favorite: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    customFields: []
  };
  return { ...base, ...values } as unknown as VaultItem;
}

export function searchVault(items: VaultItem[], query: string): VaultItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((item) => JSON.stringify(safeSearchProjection(item)).toLowerCase().includes(needle));
}

export function findLoginsForUrl(items: VaultItem[], url: string): LoginItem[] {
  const host = normalizeUrlHost(url);
  return items.filter((item): item is LoginItem => {
    return item.type === "login" && item.urls.some((candidate) => host.endsWith(normalizeUrlHost(candidate)));
  });
}

export function parseRoboFormCsv(csvText: string, now = nowIso): RoboFormImportResult {
  const rows = parseCsvRows(csvText).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (rows.length === 0) return { items: [], skippedRows: 0, warnings: ["CSV is empty"] };

  const headers = rows[0].map((header) => header.trim());
  const lookup = new Map(headers.map((header, index) => [header.toLowerCase(), index]));
  const warnings: string[] = [];
  const required = ["name", "url", "login", "pwd"];
  const missing = required.filter((header) => !lookup.has(header));
  if (missing.length > 0) {
    throw new Error(`Unsupported RoboForm CSV: missing ${missing.join(", ")} column${missing.length === 1 ? "" : "s"}`);
  }

  const value = (row: string[], header: string): string => row[lookup.get(header.toLowerCase()) ?? -1]?.trim() ?? "";
  const items: LoginItem[] = [];
  let skippedRows = 0;

  for (const row of rows.slice(1)) {
    const title = value(row, "Name") || value(row, "Url") || value(row, "MatchUrl");
    const username = value(row, "Login");
    const password = value(row, "Pwd");
    const url = value(row, "Url");
    const matchUrl = value(row, "MatchUrl");
    const note = value(row, "Note");
    const folder = value(row, "Folder");
    const rfFields = value(row, "RfFieldsV2");

    if (!title && !username && !password && !url && !note) {
      skippedRows += 1;
      continue;
    }
    if (!title) warnings.push("Skipped one RoboForm row without a title or URL");

    const timestamp = now();
    const urls = uniqueStrings([url, matchUrl]);
    const item: LoginItem = {
      id: uid("item"),
      type: "login",
      title: title || `RoboForm import ${items.length + 1}`,
      folder: folder || undefined,
      tags: ["roboform-import"],
      favorite: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      customFields: parseRoboFormFields(rfFields),
      username,
      password,
      url,
      urls,
      notes: note || undefined
    };
    items.push(item);
  }

  return { items, skippedRows, warnings };
}

export function parseLoginCsv(csvText: string, now = nowIso): LoginCsvImportResult {
  const rows = parseCsvRows(csvText).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (rows.length === 0) return { source: "generic-csv", items: [], skippedRows: 0, warnings: ["CSV is empty"] };
  const headers = rows[0].map((header) => header.trim());
  const lookup = new Map(headers.map((header, index) => [normalizeHeader(header), index]));

  if (["name", "url", "login", "pwd"].every((header) => lookup.has(header))) {
    const result = parseRoboFormCsv(csvText, now);
    return { source: "roboform", ...result };
  }
  if (["type", "name", "login_uri", "login_username", "login_password"].every((header) => lookup.has(header))) {
    return parseBitwardenCsv(csvText, now);
  }

  const titleHeader = firstHeader(lookup, ["title", "name", "label"]);
  const urlHeader = firstHeader(lookup, ["url", "website", "site", "login_url", "loginurl"]);
  const usernameHeader = firstHeader(lookup, ["username", "user", "login", "email"]);
  const passwordHeader = firstHeader(lookup, ["password", "pwd", "pass"]);
  const noteHeader = firstHeader(lookup, ["notes", "note", "comments", "comment"]);
  const folderHeader = firstHeader(lookup, ["folder", "group", "category"]);
  const missing = [
    titleHeader ? "" : "title/name",
    urlHeader ? "" : "url",
    usernameHeader ? "" : "username/login",
    passwordHeader ? "" : "password/pwd"
  ].filter(Boolean);
  if (missing.length > 0) throw new Error(`Unsupported login CSV: missing ${missing.join(", ")}`);

  const value = (row: string[], header: string): string => row[lookup.get(header) ?? -1]?.trim() ?? "";
  const items: LoginItem[] = [];
  let skippedRows = 0;
  for (const row of rows.slice(1)) {
    const title = value(row, titleHeader);
    const url = value(row, urlHeader);
    const username = value(row, usernameHeader);
    const password = value(row, passwordHeader);
    const notes = noteHeader ? value(row, noteHeader) : "";
    const folder = folderHeader ? value(row, folderHeader) : "";
    if (!title && !url && !username && !password && !notes) {
      skippedRows += 1;
      continue;
    }
    const timestamp = now();
    items.push({
      id: uid("item"),
      type: "login",
      title: title || url || `CSV import ${items.length + 1}`,
      folder: folder || undefined,
      tags: ["csv-import"],
      favorite: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      customFields: [],
      username,
      password,
      url,
      urls: uniqueStrings([url]),
      notes: notes || undefined
    });
  }
  return { source: "generic-csv", items, skippedRows, warnings: [] };
}

export function parseBitwardenCsv(csvText: string, now = nowIso): LoginCsvImportResult {
  const rows = parseCsvRows(csvText).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (rows.length === 0) return { source: "bitwarden", items: [], skippedRows: 0, warnings: ["CSV is empty"] };
  const headers = rows[0].map((header) => header.trim());
  const lookup = new Map(headers.map((header, index) => [normalizeHeader(header), index]));
  const required = ["type", "name", "login_uri", "login_username", "login_password"];
  const missing = required.filter((header) => !lookup.has(header));
  if (missing.length > 0) throw new Error(`Unsupported Bitwarden CSV: missing ${missing.join(", ")}`);
  const value = (row: string[], header: string): string => row[lookup.get(header) ?? -1]?.trim() ?? "";
  const items: LoginItem[] = [];
  let skippedRows = 0;
  for (const row of rows.slice(1)) {
    if (value(row, "type").toLowerCase() !== "login") {
      skippedRows += 1;
      continue;
    }
    const title = value(row, "name");
    const url = value(row, "login_uri");
    const username = value(row, "login_username");
    const password = value(row, "login_password");
    const notes = value(row, "notes");
    if (!title && !url && !username && !password && !notes) {
      skippedRows += 1;
      continue;
    }
    const timestamp = now();
    const customFields: CustomField[] = [];
    const totp = value(row, "login_totp");
    if (totp) customFields.push({ name: "totp", value: totp, concealed: true });
    const fields = value(row, "fields");
    if (fields) customFields.push({ name: "bitwarden fields", value: fields, concealed: false });
    items.push({
      id: uid("item"),
      type: "login",
      title: title || url || `Bitwarden import ${items.length + 1}`,
      folder: value(row, "folder") || undefined,
      tags: ["bitwarden-import"],
      favorite: ["1", "true", "yes"].includes(value(row, "favorite").toLowerCase()),
      createdAt: timestamp,
      updatedAt: timestamp,
      customFields,
      username,
      password,
      url,
      urls: uniqueStrings([url]),
      notes: notes || undefined
    });
  }
  return { source: "bitwarden", items, skippedRows, warnings: [] };
}

export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
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

function parseRoboFormFields(value: string): CustomField[] {
  if (!value.trim()) return [];
  const fields = parseCsvRows(value)[0] ?? [];
  const customFields: CustomField[] = [];
  for (let index = 0; index + 4 < fields.length; index += 5) {
    const rawName = fields[index] || fields[index + 2];
    const fieldType = fields[index + 3] || "txt";
    const fieldValue = fields[index + 4] || "";
    const name = rawName.trim();
    if (!name || fieldValue === "") continue;
    customFields.push({
      name,
      value: fieldValue,
      concealed: /pass|pwd|secret|card|cvv|pin/i.test(`${name} ${fieldType}`)
    });
  }
  return customFields;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function firstHeader(lookup: Map<string, number>, names: string[]): string {
  const found = names.find((name) => lookup.has(name));
  return found ?? "";
}

function safeSearchProjection(item: VaultItem): unknown {
  if (item.type === "login") {
    const { password: _password, ...rest } = item;
    return rest;
  }
  if (item.type === "payment-card") {
    const { number: _number, securityCode: _securityCode, ...rest } = item;
    return rest;
  }
  return item;
}
