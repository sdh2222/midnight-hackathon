import { access, cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const managed = resolve(webRoot, "../../contract/src/managed/intent");
const publicDir = resolve(webRoot, "public");

const sources = ["keys", "zkir"].map((directory) => resolve(managed, directory));
const available = await Promise.all(sources.map((source) => access(source).then(
  () => true,
  (error) => {
    if (error?.code === "ENOENT") return false;
    throw error;
  },
)));
if (available.some((exists) => !exists)) {
  console.warn("Intent proving assets are not compiled; skipping copy. Demo mode can run without them.");
  process.exit(0);
}

for (const directory of ["keys", "zkir"]) {
  const target = resolve(publicDir, directory);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp(resolve(managed, directory), target, { recursive: true });
}

console.log("Copied intent proving keys and ZKIR into apps/web/public.");
