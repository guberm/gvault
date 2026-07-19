import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { GVaultApiClient } from "../packages/api-client/dist/index.js";

test("API client identifies the device when creating a login session", async () => {
  let received;
  const server = createServer(async (request, response) => {
    received = {
      method: request.method,
      path: request.url,
      body: JSON.parse(await readAll(request)),
    };
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ token: "test-token", userId: "test-user", sessionId: "ses_test", expiresAt: "2026-07-20T00:00:00.000Z" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const client = new GVaultApiClient(`http://127.0.0.1:${server.address().port}`);
    const session = await client.login("person@example.test", "account-password", "Web browser");

    assert.equal(session.sessionId, "ses_test");
    assert.deepEqual(received, {
      method: "POST",
      path: "/api/auth/login",
      body: { email: "person@example.test", password: "account-password", deviceName: "Web browser" },
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("API client lists, revokes, and logs out server sessions without retaining the token", async () => {
  const received = [];
  const server = createServer(async (request, response) => {
    received.push({
      method: request.method,
      path: request.url,
      authorization: request.headers.authorization,
      body: await readAll(request),
    });
    response.writeHead(200, { "content-type": "application/json" });
    if (request.url === "/api/auth/sessions") {
      response.end(JSON.stringify({ sessions: [{ id: "ses_web", deviceName: "Web browser", current: true }] }));
    } else if (request.url === "/api/sync/pull") {
      response.end(JSON.stringify({ records: [], conflicts: [], serverTime: "2026-07-19T00:00:00.000Z" }));
    } else {
      response.end(JSON.stringify({ revoked: true, loggedOut: true }));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const client = new GVaultApiClient(`http://127.0.0.1:${server.address().port}`, "session-token");
    const sessions = await client.listSessions();
    assert.equal(sessions.length, 1);
    await client.revokeSession("ses/phone");
    await client.logout();
    await client.pullSync({});

    assert.deepEqual(received, [
      { method: "GET", path: "/api/auth/sessions", authorization: "Bearer session-token", body: "" },
      { method: "DELETE", path: "/api/auth/sessions/ses%2Fphone", authorization: "Bearer session-token", body: "" },
      { method: "POST", path: "/api/auth/logout", authorization: "Bearer session-token", body: "{}" },
      { method: "POST", path: "/api/sync/pull", authorization: undefined, body: "{}" },
    ]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

async function readAll(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}
