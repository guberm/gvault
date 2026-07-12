export type VaultItemType = "login" | "secure-note" | "identity" | "payment-card" | "address" | "authenticator" | "custom";

export interface CustomField {
  name: string;
  value: string;
  concealed?: boolean;
}

export interface VaultItemBase {
  id: string;
  type: VaultItemType;
  title: string;
  folder?: string;
  tags: string[];
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  customFields: CustomField[];
}

export interface LoginItem extends VaultItemBase {
  type: "login";
  username: string;
  password: string;
  /** Primary URL kept for simple clients; urls stores every match/open URL. */
  url?: string;
  urls: string[];
  notes?: string;
}

export interface SecureNoteItem extends VaultItemBase {
  type: "secure-note";
  body: string;
}

export interface IdentityItem extends VaultItemBase {
  type: "identity";
  fullName: string;
  email?: string;
  phone?: string;
  organization?: string;
}

export interface PaymentCardItem extends VaultItemBase {
  type: "payment-card";
  cardholderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  securityCode?: string;
}

export interface AddressItem extends VaultItemBase {
  type: "address";
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
}

export interface AuthenticatorItem extends VaultItemBase {
  type: "authenticator";
  /** Base32-encoded TOTP seed. It must remain inside the encrypted item payload. */
  secret: string;
}

export interface CustomItem extends VaultItemBase {
  type: "custom";
  fields: CustomField[];
}

export type VaultItem = LoginItem | SecureNoteItem | IdentityItem | PaymentCardItem | AddressItem | AuthenticatorItem | CustomItem;

export interface EncryptedVaultRecord {
  id: string;
  ownerId: string;
  deviceId: string;
  collection: "vault-items" | "attachments" | "metadata";
  ciphertext: string;
  nonce: string;
  salt?: string;
  schemaVersion: number;
  deleted: boolean;
  updatedAt: string;
  revision: number;
}

export function normalizeUrlHost(input: string): string {
  try {
    return new URL(input).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return input.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
  }
}

export function isVaultItem(value: unknown): value is VaultItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.title !== "string" || !Array.isArray(item.tags)
    || typeof item.favorite !== "boolean" || typeof item.createdAt !== "string"
    || typeof item.updatedAt !== "string" || !Array.isArray(item.customFields)) return false;
  switch (item.type) {
    case "login": return typeof item.username === "string" && typeof item.password === "string" && Array.isArray(item.urls);
    case "secure-note": return typeof item.body === "string";
    case "identity": return typeof item.fullName === "string";
    case "payment-card": return typeof item.cardholderName === "string" && typeof item.number === "string"
      && typeof item.expiryMonth === "string" && typeof item.expiryYear === "string";
    case "address": return typeof item.line1 === "string" && typeof item.city === "string" && typeof item.country === "string";
    case "authenticator": return typeof item.secret === "string";
    case "custom": return Array.isArray(item.fields);
    default: return false;
  }
}
