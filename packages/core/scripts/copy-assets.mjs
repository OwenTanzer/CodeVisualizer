#!/usr/bin/env node
// tsc only compiles .ts -> .js; the tree-sitter-python.wasm binary asset
// needs to be copied into dist/ alongside the compiled output so a
// consumer resolving a path relative to the built package (not the
// package's own src/) can find it. A full runtime-independent WASM
// loading story (a proper exported path/loader) is MOO-71 Commit 3's
// job -- this is just enough for Commit 2 to produce a usable dist/.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const relPath = join("core", "language-services", "python", "tree-sitter-python.wasm");
const src = join(packageRoot, "src", relPath);
const dest = join(packageRoot, "dist", relPath);

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log(`Copied ${relPath} -> dist/`);
