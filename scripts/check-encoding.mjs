import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT_DIR = process.cwd();

const TEXT_EXTENSIONS = new Set([
  ".astro",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".sql",
  ".ts",
  ".txt",
  ".yml",
  ".yaml",
]);

const TEXT_BASENAMES = new Set([".env", ".env.example"]);
const IGNORE_DIRS = new Set([".git", ".astro", ".worktrees", "dist", "node_modules"]);

const decoder = new TextDecoder("utf-8", { fatal: true });
const issues = [];

const toPosix = (relativePath) => relativePath.split(path.sep).join("/");

const isTextFile = (filePath) => {
  const baseName = path.basename(filePath);
  if (TEXT_BASENAMES.has(baseName)) {
    return true;
  }

  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
};

const collectFiles = async (dirPath, output = []) => {
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        await collectFiles(fullPath, output);
      }
      continue;
    }

    if (entry.isFile() && isTextFile(fullPath)) {
      output.push(fullPath);
    }
  }

  return output;
};

const checkFile = async (absolutePath) => {
  const relativePath = toPosix(path.relative(ROOT_DIR, absolutePath));
  const fileBuffer = await readFile(absolutePath);

  let content;
  try {
    content = decoder.decode(fileBuffer);
  } catch (error) {
    issues.push(`${relativePath}: not valid UTF-8 (${error.message})`);
    return;
  }

  if (content.includes("\uFFFD")) {
    issues.push(`${relativePath}: contains replacement character U+FFFD`);
  }
};

const main = async () => {
  const textFiles = await collectFiles(ROOT_DIR);
  await Promise.all(textFiles.map((filePath) => checkFile(filePath)));

  if (issues.length > 0) {
    console.error("Encoding check failed:\n");
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log(`Encoding check passed (${textFiles.length} files scanned).`);
};

await main();
