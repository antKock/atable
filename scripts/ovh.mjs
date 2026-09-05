#!/usr/bin/env node
// Appel signé à l'API OVH (https://api.ovh.com/console/), pour piloter le VPS
// et la zone DNS depuis le poste (docs/infra/migration-vps-ovh.md).
//
//   node scripts/ovh.mjs GET /me
//   node scripts/ovh.mjs GET /vps
//   node scripts/ovh.mjs GET /domain/zone/<zone>/record?fieldType=A
//   node scripts/ovh.mjs POST /domain/zone/<zone>/record '{"fieldType":"A","subDomain":"x","target":"1.2.3.4","ttl":300}'
//   node scripts/ovh.mjs POST /domain/zone/<zone>/refresh
//
// Clés dans .env.local (jamais commitées) : OVH_ENDPOINT (ovh-eu), OVH_APP_KEY,
// OVH_APP_SECRET, OVH_CONSUMER_KEY — créées sur https://api.ovh.com/createToken/
// avec des droits restreints (GET/POST/PUT /vps/*, GET/POST/PUT/DELETE
// /domain/zone/<zone>/*, GET /me).

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const ENDPOINTS = {
  "ovh-eu": "https://eu.api.ovh.com/1.0",
  "ovh-ca": "https://ca.api.ovh.com/1.0",
  "ovh-us": "https://api.us.ovhcloud.com/1.0",
};

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
    }
  } catch {
    // pas de .env.local : on se contente de l'environnement
  }
  return env;
}

export async function ovh(method, path, body) {
  const env = loadEnv();
  const base = ENDPOINTS[env.OVH_ENDPOINT ?? "ovh-eu"];
  const { OVH_APP_KEY: ak, OVH_APP_SECRET: as, OVH_CONSUMER_KEY: ck } = env;
  if (!ak || !as || !ck) throw new Error("OVH_APP_KEY / OVH_APP_SECRET / OVH_CONSUMER_KEY manquants dans .env.local");

  const url = base + path;
  const payload = body === undefined ? "" : JSON.stringify(body);
  // Horloge du serveur OVH (la signature tolère peu de dérive).
  const now = Number(await (await fetch(`${base}/auth/time`)).text());
  const sig = "$1$" + createHash("sha1").update([as, ck, method, url, payload, now].join("+")).digest("hex");

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Ovh-Application": ak,
      "X-Ovh-Consumer": ck,
      "X-Ovh-Timestamp": String(now),
      "X-Ovh-Signature": sig,
    },
    body: payload || undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [method, path, json] = process.argv.slice(2);
  if (!method || !path) {
    console.error("usage: node scripts/ovh.mjs <GET|POST|PUT|DELETE> <path> [json-body]");
    process.exit(2);
  }
  try {
    const out = await ovh(method.toUpperCase(), path, json ? JSON.parse(json) : undefined);
    console.log(JSON.stringify(out, null, 2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
