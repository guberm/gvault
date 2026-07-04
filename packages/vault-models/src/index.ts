export type VaultItemType = "login" | "secure-note" | "identity" | "payment-card" | "address" | "custom";

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

export interface CustomItem extends VaultItemBase {
  type: "custom";
  fields: CustomField[];
}

export type VaultItem = LoginItem | SecureNoteItem | IdentityItem | PaymentCardItem | AddressItem | CustomItem;

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
  return typeof item.id === "string" && typeof item.title === "string" && typeof item.type === "string";
}
