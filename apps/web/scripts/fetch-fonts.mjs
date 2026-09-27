// Die Grotesk C is licensed from Klim and stays out of this repo. The files live at the
// root of a private repo. This script copies Regular and Medium into
// public/fonts/die-grotesk/ (gitignored) before dev and build.
//
//   FONTS_TOKEN  a GitHub token that can read that repo
//   FONTS_REPO   owner/name (default sdh2222/fonts)
//
// With the files already in place it does nothing. Without a token it warns and the page
// falls back to system-ui. With a token, a failed download fails the build.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const FILES = ["die-grotesk-c-regular.woff2", "die-grotesk-c-medium.woff2"];
const DIR = new URL("../public/fonts/die-grotesk/", import.meta.url);
const REPO = process.env.FONTS_REPO || "sdh2222/fonts";
const TOKEN = process.env.FONTS_TOKEN;

const missing = FILES.filter((file) => !existsSync(new URL(file, DIR)));
if (missing.length === 0) process.exit(0);

if (!TOKEN) {
  console.warn(`fonts: ${missing.join(", ")} not found and FONTS_TOKEN is not set, so Die Grotesk falls back to system-ui.`);
  process.exit(0);
}

mkdirSync(DIR, { recursive: true });
for (const file of missing) {
  const response = await fetch(`https://api.github.com/repos/${REPO}/contents/${file}`, {
    headers: {
      Accept: "application/vnd.github.raw+json",
      Authorization: `Bearer ${TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    console.error(`fonts: could not fetch ${file} from ${REPO} (HTTP ${response.status}).`);
    process.exit(1);
  }
  writeFileSync(new URL(file, DIR), Buffer.from(await response.arrayBuffer()));
  console.log(`fonts: fetched ${file}`);
}
