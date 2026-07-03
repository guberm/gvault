import { cp, mkdir, readFile, writeFile } from "node:fs/promises";

for (const target of ["chrome", "edge", "firefox"]) {
  const out = `dist/${target}`;
  await mkdir(out, { recursive: true });
  await cp("src", out, { recursive: true });
  const manifest = JSON.parse(await readFile(`${out}/manifest.json`, "utf8"));
  manifest.name = target === "edge" ? "GVault for Edge" : target === "firefox" ? "GVault for Firefox" : "GVault";
  if (target === "firefox") {
    manifest.browser_specific_settings = { gecko: { id: "extension@gvault.local" } };
  }
  await writeFile(`${out}/manifest.json`, JSON.stringify(manifest, null, 2));
}
console.log("GVault browser extensions built for Chrome, Firefox, and Edge");
