import { cp, mkdir } from "node:fs/promises";

await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });
console.log("GVault web built to apps/web/dist");
