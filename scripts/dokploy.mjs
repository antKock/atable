#!/usr/bin/env node
// Appel à l'API Dokploy du VPS (docs/infra/migration-vps-ovh.md).
//
//   node scripts/dokploy.mjs GET  project.all
//   node scripts/dokploy.mjs GET  application.one '{"applicationId":"..."}'
//   node scripts/dokploy.mjs POST application.deploy '{"applicationId":"..."}'
//
// Garde-fou : les procédures destructives (`*.delete`, `*.remove`, `*.stop`,
// `*.reload`, `*.redeploy`, `*.cleanAll`, `*.saveEnvironment`) exigent `--yes`,
// sinon le script affiche l'opération et sort en code 2. `application.deploy`
// (utilisé par le workflow) n'est jamais bloqué.
//
// Jeton et URL dans .env.local (jamais commités) : DOKPLOY_URL, DOKPLOY_TOKEN
// (Settings → Profile → API/CLI). Le document OpenAPI complet est servi par
// GET settings.getOpenApiDocument.

import { readFileSync } from "node:fs";

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
    }
  } catch {
    // pas de .env.local
  }
  return env;
}

export async function dokploy(method, procedure, input) {
  const env = loadEnv();
  const base = (env.DOKPLOY_URL ?? "").replace(/\/$/, "");
  const token = env.DOKPLOY_TOKEN;
  if (!base || !token) throw new Error("DOKPLOY_URL / DOKPLOY_TOKEN manquants dans .env.local");
  let url = `${base}/api/${procedure}`;
  const init = { method, headers: { "x-api-key": token, accept: "application/json" } };
  if (method === "GET") {
    if (input) url += "?" + new URLSearchParams(input).toString();
  } else {
    init.headers["content-type"] = "application/json";
    init.body = JSON.stringify(input ?? {});
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${procedure} → ${res.status} ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
}

const DESTRUCTIVE_PROCEDURE = /\.(delete|remove|stop|reload|redeploy|cleanAll|saveEnvironment)/;
export function isDestructive(procedure) {
  if (procedure === "application.deploy") return false;
  return DESTRUCTIVE_PROCEDURE.test(procedure);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const yes = process.argv.includes("--yes");
  const [method, procedure, json] = process.argv.slice(2).filter((a) => a !== "--yes");
  if (!method || !procedure) {
    console.error("usage: node scripts/dokploy.mjs <GET|POST> <procedure> [json-input] [--yes]");
    process.exit(2);
  }
  const verb = method.toUpperCase();
  if (isDestructive(procedure) && !yes) {
    console.error(`Opération destructive refusée sans --yes : ${verb} ${procedure}${json ? " " + json : ""}`);
    console.error("Relancer avec --yes pour confirmer.");
    process.exit(2);
  }
  try {
    const out = await dokploy(verb, procedure, json ? JSON.parse(json) : undefined);
    console.log(JSON.stringify(out, null, 2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
