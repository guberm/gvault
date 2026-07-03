import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { uid } from "@gvault/shared-utils";
import type { UserRow } from "./storage.js";

export interface Session {
  token: string;
  userId: string;
  createdAt: string;
}

export class SessionStore {
  private readonly sessions = new Map<string, Session>();

  create(userId: string): Session {
    const token = `gv_${randomBytes(32).toString("base64url")}`;
    const session = { token, userId, createdAt: new Date().toISOString() };
    this.sessions.set(token, session);
    return session;
  }

  get(token?: string): Session | undefined {
    if (!token?.startsWith("Bearer ")) return undefined;
    return this.sessions.get(token.slice("Bearer ".length));
  }
}

export function hashPassword(password: string, salt = randomBytes(16).toString("base64url")): Pick<UserRow, "passwordHash" | "passwordSalt"> {
  if (password.length < 12) throw new Error("Server account password must be at least 12 characters");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return { passwordSalt: salt, passwordHash: hash };
}

export function verifyPassword(password: string, user: Pick<UserRow, "passwordHash" | "passwordSalt">): boolean {
  const candidate = Buffer.from(scryptSync(password, user.passwordSalt, 64).toString("base64url"));
  const expected = Buffer.from(user.passwordHash);
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function makeUser(email: string, password: string): UserRow {
  return {
    id: uid("user"),
    email: email.trim().toLowerCase(),
    createdAt: new Date().toISOString(),
    ...hashPassword(password)
  };
}

export function redactForAudit(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}
