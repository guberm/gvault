import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const root = join(process.cwd(), "apps/web/public");

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
]);

test("web auth rejects a blank account password without sending a fallback credential", async () => {
  const server = await startStaticServer();
  let browser;
  let authRequests = 0;

  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.route("**/api/auth/register", async (route) => {
      authRequests += 1;
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ token: "unexpected", userId: "unexpected" }) });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByLabel("Email").fill("blank-password@example.test");
    await page.getByLabel("Master password", { exact: true }).fill("local-master-password");
    await page.getByRole("button", { name: "Register" }).click();
    await expectText(page, "#status", "Account password is required");
    assert.equal(authRequests, 0, "blank account passwords never become a network credential");
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("web regular login uses account credentials without a master password", async () => {
  const server = await startStaticServer();
  let browser;
  let loginBody;

  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.route("**/api/auth/login", async (route) => {
      loginBody = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "test-session", userId: "test-user" }) });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByLabel("Email").fill("login-only@example.test");
    await page.getByLabel("Account password", { exact: true }).fill("account-password-only");
    await page.getByLabel("Master password", { exact: true }).fill("previous-local-master");
    await page.getByRole("button", { name: "Unlock vault" }).click();
    await expectText(page, "#lockState", "Unlocked");
    await page.evaluate(() => {
      document.querySelector("#masterPassword").value = "retained-master";
      document.querySelector("#confirmMasterPassword").value = "retained-confirmation";
    });
    await page.locator("#loginButton").click();
    await expectText(page, "#status", "Server session established");
    await expectText(page, "#lockState", "Locked");
    assert.equal(await page.getByLabel("Master password", { exact: true }).inputValue(), "", "regular login clears the previous local master password input");
    assert.equal(await page.getByLabel("Confirm master password").inputValue(), "", "regular login clears any master-password confirmation input");
    assert.deepEqual(loginBody, { email: "login-only@example.test", password: "account-password-only" });
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("web registration requires a confirmed master password without sending it to the server", async () => {
  const server = await startStaticServer();
  let browser;
  let registerRequests = 0;
  let registerBody;

  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.route("**/api/auth/register", async (route) => {
      registerRequests += 1;
      registerBody = route.request().postDataJSON();
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ token: "test-session", userId: "test-user" }) });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByLabel("Email").fill("register-master@example.test");
    await page.getByLabel("Account password", { exact: true }).fill("account-password-only");
    await page.getByRole("button", { name: "Register" }).click();
    await expectText(page, "#status", "Master password is required");
    assert.equal(registerRequests, 0);

    await page.getByLabel("Master password", { exact: true }).fill("12345678901");
    await page.getByLabel("Confirm master password").fill("12345678901");
    await page.getByRole("button", { name: "Register" }).click();
    await expectText(page, "#status", "Use at least 12 characters for the master password");
    assert.equal(registerRequests, 0);

    await page.getByLabel("Master password", { exact: true }).fill("registration-master-password");
    await page.getByLabel("Confirm master password").fill("registration-master-password");
    await page.getByRole("button", { name: "Register" }).click();
    await expectText(page, "#status", "Server session ready");
    assert.equal(registerRequests, 1);
    assert.equal(registerBody.email, "register-master@example.test");
    assert.equal(registerBody.password, "account-password-only");
    assert.equal(registerBody.masterPassword, undefined, "the master password is never sent as a registration credential");
    assert.equal(JSON.stringify(registerBody).includes("registration-master-password"), false, "the master password is absent from the complete request body");
    assert.equal(registerBody.recovery?.version, 1, "registration includes a versioned recovery enrollment");
    assert.equal(registerBody.recovery?.envelope?.kdf, "PBKDF2-SHA256");
    assert.equal(registerBody.recovery?.envelope?.iterations, 210000);
    assert.equal(typeof registerBody.recovery?.verifier, "string");
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("web restore rejects a wrong master password without pushing any records", async () => {
  const server = await startStaticServer();
  const record = await encryptedRecordFor({
    id: "restored-login",
    type: "login",
    title: "Server-backed login",
    username: "restore@example.test",
    password: "stored-password",
    updatedAt: "2026-07-18T12:00:00.000Z",
  }, "correct-master-password");
  let browser;
  let pushRequests = 0;

  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => {
      localStorage.setItem("gv.token", "restore-token");
      localStorage.setItem("gv.userId", "restore-user");
    });
    await page.route("**/api/sync/pull", (route) => route.fulfill({ json: { records: [record] } }));
    await page.route("**/api/sync/push", (route) => {
      pushRequests += 1;
      return route.fulfill({ json: { records: [] } });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);

    await page.getByLabel("Master password", { exact: true }).fill("incorrect-master-password");
    await page.getByRole("button", { name: "Unlock vault" }).click();

    await expectText(page, "#status", "Master password could not decrypt this vault");
    await expectText(page, "#lockState", "Locked");
    assert.equal(await page.getByLabel("Master password", { exact: true }).inputValue(), "", "failed candidate is cleared");
    assert.equal(pushRequests, 0, "restore never writes before the candidate master password is authenticated");
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("web restore authenticates the master password and decrypts records before unlocking", async () => {
  const server = await startStaticServer();
  const record = await encryptedRecordFor({
    id: "restored-login",
    type: "login",
    title: "Server-backed login",
    username: "restore@example.test",
    password: "stored-password",
    updatedAt: "2026-07-18T12:00:00.000Z",
  }, "correct-master-password");
  let browser;
  let pushRequests = 0;

  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => {
      localStorage.setItem("gv.token", "restore-token");
      localStorage.setItem("gv.userId", "restore-user");
    });
    await page.route("**/api/sync/pull", (route) => route.fulfill({ json: { records: [record] } }));
    await page.route("**/api/sync/push", (route) => {
      pushRequests += 1;
      return route.fulfill({ json: { records: [] } });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);

    await page.getByLabel("Master password", { exact: true }).fill("correct-master-password");
    await page.getByRole("button", { name: "Unlock vault" }).click();

    await expectText(page, "#lockState", "Unlocked");
    await expectText(page, "#items", "Server-backed login");
    assert.equal(pushRequests, 0, "authenticated restore is pull-only");
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("web create-card starts a fresh Login item editor and saves the Login record locally", async () => {
  const server = await startStaticServer();
  let browser;

  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    await page.goto(baseUrl);
    await page.getByLabel("Master password", { exact: true }).fill("local-master-password");
    await page.getByRole("button", { name: "Unlock vault" }).click();

    await page.locator("[name=title]").fill("Existing login");
    await page.locator("[name=url]").fill("https://old.example/login");
    await page.locator("[name=username]").fill("old@example.local");
    await page.locator("[name=password]").fill("old-password");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.locator(".item-row").filter({ hasText: "Existing login" }).click();

    await page.getByRole("button", { name: "Create Login item" }).click();

    await assertInputValue(page, "[name=type]", "login");
    await assertInputValue(page, "[name=title]", "");
    await assertInputValue(page, "[name=url]", "");
    await assertInputValue(page, "[name=username]", "");
    await assertInputValue(page, "[name=password]", "");
    await expectText(page, "#formTitle", "New login");
    await expectText(page, "#status", "Creating a new Login item");

    await page.locator("[name=title]").fill("GitHub Work");
    await page.locator("[name=url]").fill("https://github.com/login");
    await page.locator("[name=username]").fill("michael@guber.dev");
    await page.locator("#passwordLength").evaluate((input) => {
      input.value = "12";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await expectText(page, "#strengthLabel", "12 characters, 73 bits, good");
    await expectText(page, "#strengthRating", "Good");
    await page.locator("#passwordLength").evaluate((input) => {
      input.value = "28";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.locator("#useUpper").uncheck();
    await page.evaluate(() => {
      window.crypto.getRandomValues = (array) => {
        array[0] = 0;
        return array;
      };
    });
    await expectText(page, "#strengthLabel", "28 characters");
    await page.locator("#generateButton").click();
    const generatedPassword = await page.locator("#generatedPassword").inputValue();
    assert.equal(generatedPassword.length, 28, "generated password follows the selected length control");
    assert.doesNotMatch(generatedPassword, /[A-Z]/, "uppercase toggle removes uppercase letters from generated passwords");
    assert.equal((await page.locator("#generatedPassword").inputValue()).length, 28, "generator preview follows the selected length control");

    await page.locator("#useUpper").check();
    await page.locator("#useLower").uncheck();
    await expectText(page, "#strengthLabel", "28 characters, 150 bits, strong");
    await page.evaluate(() => {
      window.crypto.getRandomValues = (array) => {
        array[0] = 24;
        return array;
      };
    });
    await page.locator("#generateButton").click();
    const uppercaseOnlyPassword = await page.locator("#generatedPassword").inputValue();
    assert.equal(uppercaseOnlyPassword.length, 28, "lowercase toggle preserves generated length");
    assert.doesNotMatch(uppercaseOnlyPassword, /[a-z]/, "lowercase toggle removes lowercase letters from generated passwords");
    assert.equal((await page.locator("#generatedPassword").inputValue()).length, 28, "generator preview follows lowercase toggle length");

    await page.locator("#useNumbers").uncheck();
    await expectText(page, "#strengthLabel", "28 characters, 141 bits, strong");
    await page.evaluate(() => {
      window.crypto.getRandomValues = (array) => {
        array[0] = 24;
        return array;
      };
    });
    await page.locator("#generateButton").click();
    const numberFreePassword = await page.locator("#generatedPassword").inputValue();
    assert.equal(numberFreePassword.length, 28, "numbers toggle preserves generated length");
    assert.doesNotMatch(numberFreePassword, /[0-9]/, "numbers toggle removes digits from generated passwords");
    assert.equal((await page.locator("#generatedPassword").inputValue()).length, 28, "generator preview follows numbers toggle length");

    await page.locator("#useNumbers").check();
    await page.locator("#useSymbols").uncheck();
    await expectText(page, "#strengthLabel", "28 characters, 140 bits, strong");
    await page.evaluate(() => {
      window.crypto.getRandomValues = (array) => {
        array[0] = 32;
        return array;
      };
    });
    await page.locator("#generateButton").click();
    const symbolFreePassword = await page.locator("#generatedPassword").inputValue();
    assert.equal(symbolFreePassword.length, 28, "symbols toggle preserves generated length");
    assert.doesNotMatch(symbolFreePassword, /[!@#$%^&*?]/, "symbols toggle removes symbols from generated passwords");
    assert.equal((await page.locator("#generatedPassword").inputValue()).length, 28, "generator preview follows symbols toggle length");

    const excludeAmbiguous = page.locator("#excludeAmbiguous");
    assert.equal(await excludeAmbiguous.isChecked(), true, "ambiguous characters are excluded by default");
    await page.evaluate(() => {
      window.crypto.getRandomValues = (array) => {
        array[0] = 8;
        return array;
      };
    });
    await page.locator("#generateButton").click();
    const ambiguitySafePassword = await page.locator("#generatedPassword").inputValue();
    assert.doesNotMatch(ambiguitySafePassword, /[Il1O0]/, "exclude ambiguous removes confusing characters");

    await excludeAmbiguous.uncheck();
    await expectText(page, "#strengthLabel", "28 characters, 145 bits, strong");
    await page.locator("#generateButton").click();
    const fullAlphabetPassword = await page.locator("#generatedPassword").inputValue();
    assert.match(fullAlphabetPassword, /I/, "disabling exclude ambiguous restores the full alphabet");

    await page.locator("#usePassphrase").check();
    await page.evaluate(() => {
      window.crypto.getRandomValues = (array) => {
        array[0] = 0;
        return array;
      };
    });
    await page.locator("#generateButton").click();
    const generatedPassphrase = "cedar-cedar-cedar-cedar-10";
    assert.equal(await page.locator("[name=password]").inputValue(), "", "generation does not implicitly replace the Login password field");
    assert.equal(await page.locator("#generatedPassword").inputValue(), generatedPassphrase, "passphrase mode updates the generator preview");
    await expectText(page, "#strengthLabel", "4 words + 2 digits, 21 bits, weak");
    await expectText(page, "#strengthRating", "Weak");

    await page.locator("#usePassphrase").uncheck();
    await page.locator("#useUpper").uncheck();
    await page.locator("#useNumbers").uncheck();
    await expectText(page, "#strengthLabel", "No character sets selected, unavailable");
    await expectText(page, "#strengthRating", "Unavailable");
    await page.locator("#generateButton").click();
    assert.equal(await page.locator("[name=password]").inputValue(), "", "unavailable generator preserves the existing password");
    await expectText(page, "#status", "Select at least one character set");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expectText(page, "#detailTitle", "GitHub Work");
    await expectText(page, "#items", "GitHub Work");
    await expectText(page, "#items", "Existing login");
    assert.equal(await page.locator(".item-row").count(), 2, "new Login item is added without overwriting the existing item");
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("generated password is transferred to the Login editor only on explicit use and saves through the editor", async () => {
  const server = await startStaticServer();
  let browser;

  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByLabel("Master password", { exact: true }).fill("local-master-password");
    await page.getByRole("button", { name: "Unlock vault" }).click();

    await page.locator("[name=title]").fill("Generated password login");
    await page.locator("[name=password]").fill("existing-editor-password");
    const useButton = page.getByRole("button", { name: "Use generated password in editor" });
    assert.equal(await useButton.isDisabled(), true, "use action is unavailable while the preview is empty");

    await page.locator("#generateButton").click();
    const generatedPassword = await page.locator("#generatedPassword").inputValue();
    assert.notEqual(generatedPassword, "", "generation populates the preview");
    await assertInputValue(page, "[name=password]", "existing-editor-password");
    assert.equal(await useButton.isEnabled(), true, "use action becomes available for a non-empty preview in Login editor");

    await useButton.click();
    await assertInputValue(page, "[name=password]", generatedPassword);
    await expectText(page, "#status", "Generated password placed in the Login editor.");
    assert.equal(
      (await page.locator("#status").textContent()).includes(generatedPassword),
      false,
      "status does not reveal the generated password",
    );

    await page.getByRole("button", { name: "Save changes" }).click();
    await page.locator(".item-row").filter({ hasText: "Generated password login" }).click();
    await assertInputValue(page, "[name=password]", generatedPassword);

    await page.locator("[name=type]").selectOption("secure-note");
    await page.locator("[name=body]").fill("unrelated secure note body");
    assert.equal(await useButton.isDisabled(), true, "use action is unavailable outside a Login editor");
    await assertInputValue(page, "[name=body]", "unrelated secure note body");
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("generated password starts a fresh Login draft and persists only through explicit save and sync", async () => {
  const server = await startStaticServer();
  let browser;

  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const syncedRecords = new Map();
    const apiRequests = [];
    await page.addInitScript(() => {
      localStorage.setItem("gv.token", "integration-token");
      localStorage.setItem("gv.userId", "integration-user");
    });
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const body = request.postDataJSON();
      apiRequests.push({ path: new URL(request.url()).pathname, body });
      if (request.url().endsWith("/api/sync/push")) {
        for (const record of body.records) syncedRecords.set(record.id, record);
        await route.fulfill({ json: { records: body.records } });
        return;
      }
      await route.fulfill({ json: { records: [...syncedRecords.values()] } });
    });

    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByLabel("Master password", { exact: true }).fill("local-master-password");
    await page.getByRole("button", { name: "Unlock vault" }).click();

    await page.locator("[name=title]").fill("Existing selected login");
    await page.locator("[name=url]").fill("https://existing.example/login");
    await page.locator("[name=username]").fill("existing@example.local");
    await page.locator("[name=password]").fill("existing-login-password");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.locator(".item-row").filter({ hasText: "Existing selected login" }).click();

    const saveGeneratedButton = page.getByRole("button", { name: "Save generated password as new Login" });
    assert.equal(await saveGeneratedButton.isDisabled(), true, "save-as-Login is unavailable while the preview is empty");
    await page.locator("#generateButton").click();
    const generatedPassword = await page.locator("#generatedPassword").inputValue();
    assert.notEqual(generatedPassword, "", "generation provides a password to save");
    assert.equal(await saveGeneratedButton.isEnabled(), true, "save-as-Login becomes available after generation");

    await saveGeneratedButton.click();
    await assertInputValue(page, "[name=type]", "login");
    await assertInputValue(page, "[name=title]", "");
    await assertInputValue(page, "[name=folder]", "");
    await assertInputValue(page, "[name=tags]", "");
    await assertInputValue(page, "[name=url]", "");
    await assertInputValue(page, "[name=username]", "");
    await assertInputValue(page, "[name=password]", generatedPassword);
    await assertInputValue(page, "[name=notes]", "");
    await assertInputValue(page, "#generatedPassword", generatedPassword);
    await expectText(page, "#formTitle", "New login");
    await expectText(page, "#status", "New Login draft ready");
    assert.equal((await page.locator("#status").textContent()).includes(generatedPassword), false, "draft status does not reveal the password");
    assert.equal(await page.locator("[name=title]").evaluate((element) => element === document.activeElement), true, "fresh editor receives focus");
    assert.equal(apiRequests.filter(({ path }) => path === "/api/sync/push").length, 0, "starting the draft performs no network write");
    assert.equal(await page.locator(".item-row").count(), 1, "starting the draft performs no local save");

    await page.locator("[name=title]").fill("Generated saved login");
    await page.getByRole("button", { name: "Save changes" }).click();
    assert.equal(await page.locator(".item-row").count(), 2, "explicit Save creates a second Login");
    await page.locator(".item-row").filter({ hasText: "Existing selected login" }).click();
    await assertInputValue(page, "[name=password]", "existing-login-password");

    await page.getByRole("button", { name: "Sync", exact: true }).click();
    await expectText(page, "#status", "Sync complete");
    assert.equal(syncedRecords.size, 2, "both Login records reached the sync API");

    await page.reload();
    await page.getByLabel("Master password", { exact: true }).fill("local-master-password");
    await page.getByRole("button", { name: "Unlock vault" }).click();
    await page.getByRole("button", { name: "Sync", exact: true }).click();
    await expectText(page, "#items", "Generated saved login");
    await page.locator(".item-row").filter({ hasText: "Generated saved login" }).click();
    await assertInputValue(page, "[name=password]", generatedPassword);
    await page.locator(".item-row").filter({ hasText: "Existing selected login" }).click();
    await assertInputValue(page, "[name=password]", "existing-login-password");
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("password generator copies only the current preview and reports clipboard failures honestly", async () => {
  const server = await startStaticServer();
  let browser;

  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => {
      window.__clipboardWrites = [];
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value) => {
            window.__clipboardWrites.push(value);
          },
        },
      });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByLabel("Master password", { exact: true }).fill("local-master-password");
    await page.getByRole("button", { name: "Unlock vault" }).click();

    const copyButton = page.getByRole("button", { name: "Copy generated password" });
    await assertInputValue(page, "#generatedPassword", "");
    assert.equal(await copyButton.isDisabled(), true, "copy is unavailable while the preview is empty");

    await page.locator("#generateButton").click();
    const generatedPassword = await page.locator("#generatedPassword").inputValue();
    assert.notEqual(generatedPassword, "", "generation populates the password preview");
    assert.equal(await copyButton.isEnabled(), true, "copy becomes available after generation");

    await copyButton.click();
    assert.deepEqual(await page.evaluate(() => window.__clipboardWrites), [generatedPassword]);
    await expectText(page, "#status", "Generated password copied.");

    await page.evaluate(() => {
      navigator.clipboard.writeText = async () => {
        throw new Error("clipboard rejected");
      };
    });
    await copyButton.click();
    await expectText(page, "#status", "Could not copy generated password.");
    assert.equal(
      (await page.locator("#status").textContent()).includes(generatedPassword),
      false,
      "copy failure status does not reveal the generated password",
    );

    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    });
    await copyButton.click();
    await expectText(page, "#status", "Could not copy generated password.");
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("web folders group and filter vault items", async () => {
  const server = await startStaticServer();
  let browser;

  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByLabel("Master password", { exact: true }).fill("local-master-password");
    await page.getByRole("button", { name: "Unlock vault" }).click();

    await page.locator("[name=title]").fill("Work login");
    await page.locator("[name=folder]").fill("Work");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.locator("#newItemButton").click();
    await page.locator("[name=title]").fill("Personal login");
    await page.locator("[name=folder]").fill("Personal");
    await page.getByRole("button", { name: "Save changes" }).click();

    const folders = page.locator("#folderList button");
    assert.equal(await folders.count(), 2, "one navigation entry is shown for each folder");
    await expectText(page, "#folderList", "Personal");
    await expectText(page, "#folderList", "Work");

    await folders.filter({ hasText: "Work" }).click();
    assert.equal(await page.locator(".item-row").count(), 1, "folder navigation filters the vault list");
    await expectText(page, "#items", "Work login");
    assert.equal((await page.locator("#items").textContent()).includes("Personal login"), false);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("web nested folder paths form a filterable hierarchy", async () => {
  const server = await startStaticServer();
  let browser;

  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByLabel("Master password", { exact: true }).fill("local-master-password");
    await page.getByRole("button", { name: "Unlock vault" }).click();

    for (const [title, folder] of [["Client login", "Work/Clients"], ["Internal login", "Work/Internal"], ["Home login", "Home"]]) {
      if (await page.locator(".item-row").count()) await page.locator("#newItemButton").click();
      await page.locator("[name=title]").fill(title);
      await page.locator("[name=folder]").fill(folder);
      await page.getByRole("button", { name: "Save changes" }).click();
    }

    const folders = page.locator("#folderList button");
    assert.deepEqual(await folders.evaluateAll((buttons) => buttons.map((button) => button.dataset.filter)), [
      "folder:Home",
      "folder:Work",
      "folder:Work/Clients",
      "folder:Work/Internal",
    ]);
    assert.equal(await page.locator("#folderList").getAttribute("role"), null);
    assert.equal(await page.locator('[data-filter="folder:Work/Clients"]').getAttribute("role"), null);
    assert.equal(await page.locator('[data-filter="folder:Work/Clients"]').getAttribute("aria-level"), null);
    assert.equal(await page.locator('[data-filter="folder:Work/Clients"]').getAttribute("aria-label"), "Work/Clients (1)");
    assert.equal(await page.locator('[data-filter="folder:Work/Clients"]').textContent(), "Clients1");

    await page.locator('[data-filter="folder:Work"]').click();
    assert.equal(await page.locator(".item-row").count(), 2, "a parent folder includes descendant items");
    assert.equal((await page.locator("#items").textContent()).includes("Home login"), false);

    await page.locator('[data-filter="folder:Work/Clients"]').click();
    assert.deepEqual(await page.locator(".item-row strong").allTextContents(), ["Client login"]);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("web tags group and filter vault items", async () => {
  const server = await startStaticServer();
  let browser;

  try {
    browser = await chromium.launch(chromeLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByLabel("Master password", { exact: true }).fill("local-master-password");
    await page.getByRole("button", { name: "Unlock vault" }).click();

    for (const [title, tags] of [["Shared work login", "Shared, Work"], ["Shared home login", "Shared, Home, Shared"], ["Untagged login", ""]]) {
      if (await page.locator(".item-row").count()) await page.locator("#newItemButton").click();
      await page.locator("[name=title]").fill(title);
      await page.locator("[name=tags]").fill(tags);
      await page.getByRole("button", { name: "Save changes" }).click();
    }

    const tags = page.locator("#tagList button");
    assert.deepEqual(await tags.evaluateAll((buttons) => buttons.map((button) => button.dataset.filter)), [
      "tag:Home",
      "tag:Shared",
      "tag:Work",
    ]);
    assert.equal(await page.locator('[data-filter="tag:Shared"]').getAttribute("aria-label"), "Shared (2)");
    assert.equal(await page.locator('[data-filter="tag:Shared"]').textContent(), "Shared2");

    await page.locator('[data-filter="tag:Shared"]').click();
    assert.deepEqual(await page.locator(".item-row strong").allTextContents(), ["Shared home login", "Shared work login"]);

    await page.locator('[data-filter="tag:Work"]').click();
    assert.deepEqual(await page.locator(".item-row strong").allTextContents(), ["Shared work login"]);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

function chromeLaunchOptions() {
  const executablePath = chromeExecutable();
  return executablePath ? { executablePath } : {};
}

function chromeExecutable() {
  if (process.env.GV_CHROME_EXECUTABLE) return process.env.GV_CHROME_EXECUTABLE;
  const candidates = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  return candidates.find((candidate) => existsSync(candidate));
}

async function startStaticServer() {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const safePath = pathname.replace(/^\/+/, "");
    try {
      const file = await readFile(join(root, safePath));
      response.writeHead(200, { "content-type": contentTypes.get(extname(safePath)) || "application/octet-stream" });
      response.end(file);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

async function assertInputValue(page, selector, expected) {
  const actual = await page.locator(selector).inputValue();
  assert.equal(actual, expected);
}

async function expectText(page, selector, text) {
  await waitUntil(async () => ((await page.locator(selector).textContent()) || "").includes(text), `text ${text}`);
}

async function encryptedRecordFor(item, masterPassword, deleted = false) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const nonce = webcrypto.getRandomValues(new Uint8Array(12));
  const material = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(masterPassword), "PBKDF2", false, ["deriveKey"]);
  const key = await webcrypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const ciphertext = await webcrypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, new TextEncoder().encode(JSON.stringify(item)));
  return {
    id: item.id,
    ownerId: "restore-user",
    deviceId: "restore-device",
    collection: "vault-items",
    ciphertext: Buffer.from(ciphertext).toString("base64"),
    nonce: Buffer.from(nonce).toString("base64"),
    salt: Buffer.from(salt).toString("base64"),
    schemaVersion: 1,
    deleted,
    updatedAt: item.updatedAt,
    revision: Date.parse(item.updatedAt),
  };
}

async function waitUntil(predicate, label) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting ${label}`);
}
