import { spawnSync } from "node:child_process";
import process from "node:process";

const withZk = process.argv.includes("--zk");
const compileArgs = ["compile", ...(withZk ? [] : ["--skip-zk"]), "src/intent.compact", "src/managed/intent"];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.platform === "win32") {
  const quotedArgs = compileArgs.map((arg) => `'${arg.replaceAll("'", `'\\''`)}'`).join(" ");
  run("wsl.exe", [
    "--distribution",
    "Ubuntu",
    "--cd",
    process.cwd(),
    "--",
    "bash",
    "-lc",
    `~/.local/bin/compact ${quotedArgs}`,
  ]);
} else {
  run("compact", compileArgs);
}
