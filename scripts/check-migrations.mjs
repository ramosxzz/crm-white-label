import { readdir } from "node:fs/promises";

const files = (await readdir(new URL("../supabase/migrations/", import.meta.url))).filter(f => f.endsWith(".sql"));
const versions = new Map();
for (const file of files) {
  const version = file.match(/^(\d{14})_.+\.sql$/)?.[1];
  if (!version) throw new Error("Nome de migration invalido: " + file);
  if (versions.has(version)) throw new Error("Migration duplicada: " + versions.get(version) + " e " + file);
  versions.set(version, file);
}
console.log(files.length + " migrations com identificadores unicos.");
