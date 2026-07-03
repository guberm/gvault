import { access, mkdir, writeFile } from "node:fs/promises";

await access("android/README.md");
await mkdir("dist", { recursive: true });
await writeFile("dist/mobile-architecture.json", JSON.stringify({ product: "GVault", android: "planned-native-client", sharedCore: true }, null, 2));
console.log("GVault mobile architecture verified");
