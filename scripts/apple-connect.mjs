#!/usr/bin/env node
// CLI minimal pour l'API App Store Connect — s'appuie sur le module partagé
// src/lib/apple-connect/client.ts (JWT, appels, téléchargement d'instances),
// celui du cron /api/cron/app-store-sync. Node ≥ 22.18 : le `.ts` est importé
// tel quel (type stripping), sans bundler.
//
// Auth : APPLE_CONNECT_KEY (corps base64 de la clé .p8), APPLE_CONNECT_KEY_ID,
// APPLE_CONNECT_ISSUER_ID — lus depuis .env.local.
//
// Usage :
//   node scripts/apple-connect.mjs apps
//   node scripts/apple-connect.mjs get "/v1/apps/<id>/analyticsReportRequests"
//   echo '<json>' | node scripts/apple-connect.mjs post|patch <path>   (écriture)
//   node scripts/apple-connect.mjs analytics-create <appId> [ONGOING]   (défaut : snapshot historique)
//   node scripts/apple-connect.mjs analytics-requests <appId>
//   node scripts/apple-connect.mjs analytics-reports <requestId> [category]
//   node scripts/apple-connect.mjs analytics-instances <reportId>
//   node scripts/apple-connect.mjs analytics-download <instanceId>

import { loadEnvLocal } from './lib/env.mjs';
import { createAppleConnectClient, credentialsFromEnv } from '../src/lib/apple-connect/client.ts';

const [cmd, arg1, arg2] = process.argv.slice(2);
loadEnvLocal('.env.local');

const { api, downloadInstance } = createAppleConnectClient(credentialsFromEnv());

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
    process.stdout.write(await downloadInstance(arg1));
    break;
  }

  default:
    console.error('Commande inconnue. Voir l’en-tête du script pour l’usage.');
    process.exit(1);
}
