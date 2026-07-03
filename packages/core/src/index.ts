import { nowIso, uid } from "@gvault/shared-utils";
import { normalizeUrlHost, type LoginItem, type VaultItem, type VaultItemType } from "@gvault/vault-models";

export interface PasswordGeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
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
