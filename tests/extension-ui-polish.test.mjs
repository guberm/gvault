import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const popupHtml = await readFile("apps/browser-extension/src/popup.html", "utf8");
const optionsHtml = await readFile("apps/browser-extension/src/options.html", "utf8");

test("browser extension clean-install UI uses the public server and coherent responsive surfaces", async () => {
  assert.doesNotMatch(popupHtml, /http:\/\/127\.0\.0\.1:8080/);
  assert.doesNotMatch(optionsHtml, /http:\/\/127\.0\.0\.1:8080/);

  const browser = await chromium.launch(chromeLaunchOptions());
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
    await page.setContent(popupHtml.replace('<script src="popup.js"></script>', ""));
    const popupLayout = await page.evaluate(() => ({
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      contentDisplay: getComputedStyle(document.querySelector("#contentSurface")).display,
      contentGap: parseFloat(getComputedStyle(document.querySelector("#contentSurface")).gap),
      selectWidth: document.querySelector("#sessionMatchMode").getBoundingClientRect().width,
      selectMinHeight: parseFloat(getComputedStyle(document.querySelector("#sessionMatchMode")).minHeight),
    }));
    assert.ok(popupLayout.scrollWidth <= popupLayout.innerWidth, "popup stays inside its viewport");
    assert.equal(popupLayout.contentDisplay, "grid", "popup sections have a deliberate layout surface");
    assert.ok(popupLayout.contentGap >= 12, "popup sections have readable separation");
    assert.ok(popupLayout.selectWidth > 300 && popupLayout.selectMinHeight >= 36, "select controls match the form system");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.setContent(optionsHtml.replace('<script src="options.js"></script>', ""));
    const optionsLayout = await page.evaluate(() => ({
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      shellCount: document.querySelectorAll("main.options-shell").length,
      sectionCount: document.querySelectorAll("main.options-shell section").length,
      checkWidth: document.querySelector(".check input").getBoundingClientRect().width,
    }));
    assert.ok(optionsLayout.scrollWidth <= optionsLayout.innerWidth, "options stay inside a phone-sized viewport");
    assert.equal(optionsLayout.shellCount, 1, "options use one readable content shell");
    assert.ok(optionsLayout.sectionCount >= 3, "options are grouped into scannable sections");
    assert.ok(optionsLayout.checkWidth < 24, "option checkboxes stay beside their labels");
  } finally {
    await browser.close();
  }
});

function chromeLaunchOptions() {
  const executablePath = chromeExecutable();
  return executablePath ? { executablePath } : {};
}

function chromeExecutable() {
  if (process.env.GV_CHROME_EXECUTABLE) return process.env.GV_CHROME_EXECUTABLE;
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  return candidates.find((candidate) => existsSync(candidate));
}
