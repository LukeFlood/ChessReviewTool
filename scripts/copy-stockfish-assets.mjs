import { mkdir, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, "..");

const sourceDir = join(root, "node_modules", "stockfish", "src");
const targetDir = join(root, "public", "stockfish");

const files = [
  "stockfish-nnue-16-single.js",
  "stockfish-nnue-16-single.wasm"
];

await mkdir(targetDir, { recursive: true });

for (const file of files) {
  await copyFile(join(sourceDir, file), join(targetDir, file));
}

console.log("Stockfish assets copied to public/stockfish");
