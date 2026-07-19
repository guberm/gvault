import type { SyncPullRequest, SyncPushRequest, SyncResponse } from "@gvault/sync";

export interface AccountRecoveryMaterial {
  version: 1;
  verifier: string;
  envelope: {
    version: 1;
    kdf: "PBKDF2-SHA256";
    iterations: 210000;
    salt: string;
    nonce: string;
    ciphertext: string;
  };
}

export interface AccountSession {
  token: string;
  userId: string;
  sessionId: string;
  expiresAt: string;
}

export interface DeviceSession {
  id: string;
  deviceName: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
}

export class GVaultApiClient {
  constructor(private readonly baseUrl: string, private token?: string) {}

  setToken(token: string): void {
    this.token = token;
  }

  async health(): Promise<{ ok: boolean; product: string }> {
    return this.request("/healthz");
  }

  async register(email: string, password: string, recovery: AccountRecoveryMaterial, deviceName = "API client"): Promise<AccountSession> {
    return this.request("/api/auth/register", { method: "POST", body: { email, password, recovery, deviceName } });
  }

  async login(email: string, password: string, deviceName = "API client"): Promise<AccountSession> {
    return this.request("/api/auth/login", { method: "POST", body: { email, password, deviceName } });
  }

  async listSessions(): Promise<DeviceSession[]> {
    const response = await this.request<{ sessions: DeviceSession[] }>("/api/auth/sessions");
    return response.sessions;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.request(`/api/auth/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
  }

  async logout(): Promise<void> {
    try {
      await this.request("/api/auth/logout", { method: "POST", body: {} });
    } finally {
      this.token = undefined;
    }
  }

  async pullSync(request: SyncPullRequest): Promise<SyncResponse> {
    return this.request("/api/sync/pull", { method: "POST", body: request });
  }

  async pushSync(request: SyncPushRequest): Promise<SyncResponse> {
    return this.request("/api/sync/push", { method: "POST", body: request });
  }

  private async request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const response = await fetch(new URL(path, this.baseUrl), {
      method: init.method ?? "GET",
      headers: {
        "content-type": "application/json",
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {})
      },
      body: init.body ? JSON.stringify(init.body) : undefined
    });
    if (!response.ok) throw new Error(`GVault API error ${response.status}`);
    return response.json() as Promise<T>;
  }
}
