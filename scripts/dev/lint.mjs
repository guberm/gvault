import { readFile } from "node:fs/promises";
import { glob } from "node:fs/promises";

const forbidden = [/RoboForm/g];
const allowedReferenceFiles = ["README.md", "NOTICE", "docs/roboform-parity-backlog.md", "docs/roboform-parity-checklist.md"];
let failed = false;

for await (const file of glob("**/*.{ts,js,json,md,html,css,yaml,conf}", { exclude: ["node_modules/**", "dist/**"] })) {
  const normalizedFile = file.replaceAll("\\", "/");
  const text = await readFile(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(text) && !allowedReferenceFiles.includes(normalizedFile)) {
      console.error(`Forbidden branding/reference in ${file}: ${pattern}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log("lint ok");
