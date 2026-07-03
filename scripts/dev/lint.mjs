import { readFile } from "node:fs/promises";
import { glob } from "node:fs/promises";

const forbidden = [/RoboForm/g, /2FAS Pass Server acts/g];
let failed = false;

for await (const file of glob("**/*.{ts,js,json,md,html,css,yaml,conf}", { exclude: ["node_modules/**", "dist/**"] })) {
  const text = await readFile(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(text) && !["README.md", "NOTICE", "docs/architecture/twofas-assessment.md"].includes(file)) {
      console.error(`Forbidden branding/reference in ${file}: ${pattern}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log("lint ok");
