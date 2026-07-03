import { readFile } from "node:fs/promises";

console.log(await readFile("RELEASE_NOTES.md", "utf8"));
