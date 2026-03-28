import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

function formatUtcTimestampForFilename(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    "_",
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    "Z",
  ].join("");
}

function parseSchemas(argv) {
  const explicitSchemas = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--schema") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("Missing value after --schema");
      }
      explicitSchemas.push(next);
      index += 1;
      continue;
    }

    if (arg.startsWith("--schema=")) {
      explicitSchemas.push(arg.slice("--schema=".length));
    }
  }

  if (explicitSchemas.length > 0) {
    return explicitSchemas;
  }

  const envSchemas = process.env.RHIZOME_DB_BACKUP_SCHEMAS;
  if (envSchemas) {
    return envSchemas
      .split(",")
      .map((schema) => schema.trim())
      .filter(Boolean);
  }

  return ["public", "cubefsrs", "auth"];
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with code ${result.status}`);
  }
}

function main() {
  const repoRoot = process.cwd();
  const backupsDir = path.join(repoRoot, "backups");
  mkdirSync(backupsDir, { recursive: true });

  const schemas = parseSchemas(process.argv.slice(2));
  if (schemas.length === 0) {
    throw new Error("No schemas selected for backup");
  }

  const stamp = formatUtcTimestampForFilename(new Date());
  const schemaLabel = schemas.join("-");
  const base = path.join(backupsDir, `backup_${schemaLabel}_${stamp}`);
  const schemaFile = `${base}_schema.sql`;
  const dataFile = `${base}_data.sql`;
  const schemaArg = schemas.join(",");

  console.log(`\n[backup] Schemas: ${schemaArg}`);
  console.log(`[backup] Writing schema to: ${schemaFile}`);
  run("supabase", ["db", "dump", "--linked", "--schema", schemaArg, "-f", schemaFile]);

  console.log(`\n[backup] Writing data to: ${dataFile}`);
  run("supabase", [
    "db",
    "dump",
    "--linked",
    "--data-only",
    "--use-copy",
    "--schema",
    schemaArg,
    "-f",
    dataFile,
  ]);

  console.log("\n[backup] Done.");
  console.log("[backup] If you see a password prompt, set SUPABASE_DB_PASSWORD for automation.");
}

main();