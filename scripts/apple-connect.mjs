#!/usr/bin/env node
// CLI minimal pour l'API App Store Connect.
// Auth : APPLE_CONNECT_KEY (corps base64 de la clé .p8), APPLE_CONNECT_KEY_ID,
// APPLE_CONNECT_ISSUER_ID — lus depuis .env.local.
//
// Usage :
//   node scripts/apple-connect.mjs apps
//   node scripts/apple-connect.mjs get "/v1/apps/<id>/analyticsReportRequests"
//   echo '<json>' | node scripts/apple-connect.mjs post|patch <path>   (écriture)
//   node scripts/apple-connect.mjs analytics-create <appId>   (snapshot historique)
//   node scripts/apple-connect.mjs analytics-requests <appId>
//   node scripts/apple-connect.mjs analytics-reports <requestId> [category]
//   node scripts/apple-connect.mjs analytics-instances <reportId>
//   node scripts/apple-connect.mjs analytics-download <instanceId>

import { createPrivateKey, createSign } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { loadEnvLocal } from './lib/env.mjs';

const API = 'https://api.appstoreconnect.apple.com';
const API_HOST = new URL(API).host;

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function makeToken() {
  const { APPLE_CONNECT_KEY, APPLE_CONNECT_KEY_ID, APPLE_CONNECT_ISSUER_ID } = process.env;
  if (!APPLE_CONNECT_KEY || !APPLE_CONNECT_KEY_ID || !APPLE_CONNECT_ISSUER_ID) {
    throw new Error('Variables APPLE_CONNECT_* manquantes dans .env.local');
  }
  const key = createPrivateKey({
    key: Buffer.from(APPLE_CONNECT_KEY, 'base64'),
    format: 'der',
    type: 'pkcs8',
  });
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: APPLE_CONNECT_KEY_ID, typ: 'JWT' };
  const payload = {
    iss: APPLE_CONNECT_ISSUER_ID,
    iat: now,
    exp: now + 15 * 60,
    aud: 'appstoreconnect-v1',
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = createSign('SHA256')
    .update(signingInput)
    .sign({ key, dsaEncoding: 'ieee-p1363' });
  return `${signingInput}.${b64url(signature)}`;
}

async function api(pathOrUrl, { method = 'GET', body } = {}) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${API}${pathOrUrl}`;
  // Le JWT ne part que vers l'API App Store Connect : une URL absolue vers un
  // autre hôte (lien `next` copié-collé, faute de frappe) ne doit jamais
  // recevoir le Bearer.
  if (new URL(url).host !== API_HOST) {
    throw new Error(`hôte refusé : ${new URL(url).host} (seul ${API_HOST} reçoit le jeton)`);
  }
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${makeToken()}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${text}`);
  return text ? JSON.parse(text) : null;
}

const [cmd, arg1, arg2] = process.argv.slice(2);
loadEnvLocal('.env.local');

switch (cmd) {
  case 'apps': {
    const data = await api('/v1/apps');
    for (const app of data.data) {
      console.log(`${app.id}  ${app.attributes.bundleId}  ${app.attributes.name}`);
    }
    break;
  }

  case 'get': {
    const data = await api(arg1);
    console.log(JSON.stringify(data, null, 2));
    break;
  }

  // Écriture générique : corps JSON:API lu sur stdin.
  //   echo '{"data":{...}}' | node scripts/apple-connect.mjs post /v1/appInfoLocalizations
  //   echo '{"data":{...}}' | node scripts/apple-connect.mjs patch /v1/appInfoLocalizations/<id>
  case 'post':
  case 'patch': {
    const raw = await new Promise((resolve) => {
      let buf = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (c) => (buf += c));
      process.stdin.on('end', () => resolve(buf));
    });
    if (!raw.trim()) {
      console.error(`corps JSON attendu sur stdin (echo '{"data":{…}}' | node scripts/apple-connect.mjs ${cmd} ${arg1 ?? '<path>'})`);
      process.exit(1);
    }
    let body;
    try {
      body = JSON.parse(raw);
    } catch (e) {
      console.error(`corps stdin illisible en JSON : ${e.message}`);
      process.exit(1);
    }
    const data = await api(arg1, { method: cmd.toUpperCase(), body });
    console.log(JSON.stringify(data, null, 2));
    break;
  }

  case 'analytics-create': {
    const data = await api('/v1/analyticsReportRequests', {
      method: 'POST',
      body: {
        data: {
          type: 'analyticsReportRequests',
          attributes: { accessType: arg2 || 'ONE_TIME_SNAPSHOT' },
          relationships: { app: { data: { type: 'apps', id: arg1 } } },
        },
      },
    });
    console.log(`Créé : ${data.data.id} (${data.data.attributes.accessType})`);
    break;
  }

  case 'analytics-requests': {
    const data = await api(`/v1/apps/${arg1}/analyticsReportRequests`);
    for (const r of data.data) {
      console.log(`${r.id}  ${r.attributes.accessType}  stoppedDueToInactivity=${r.attributes.stoppedDueToInactivity}`);
    }
    break;
  }

  case 'analytics-reports': {
    const params = arg2 ? `?filter[category]=${encodeURIComponent(arg2)}` : '?limit=200';
    const data = await api(`/v1/analyticsReportRequests/${arg1}/reports${params}`);
    for (const r of data.data) {
      console.log(`${r.id}  [${r.attributes.category}]  ${r.attributes.name}`);
    }
    break;
  }

  case 'analytics-instances': {
    const data = await api(`/v1/analyticsReports/${arg1}/instances`);
    for (const i of data.data) {
      console.log(`${i.id}  ${i.attributes.granularity}  ${i.attributes.processingDate}`);
    }
    break;
  }

  case 'analytics-download': {
    const data = await api(`/v1/analyticsReportInstances/${arg1}/segments`);
    for (const seg of data.data) {
      const res = await fetch(seg.attributes.url);
      const buf = Buffer.from(await res.arrayBuffer());
      process.stdout.write(gunzipSync(buf).toString('utf8'));
    }
    break;
  }

  default:
    console.error('Commande inconnue. Voir l’en-tête du script pour l’usage.');
    process.exit(1);
}
