import OpenAI from "openai";

// Client instancié à la première utilisation, pas au chargement du module :
// `next build` évalue les modules des routes (« collecting page data ») et le
// constructeur OpenAI lève une erreur sans clé. Dans l'image Docker
// (docs/infra/migration-vps-ovh.md) la clé n'est volontairement pas présente
// au build — aucun secret ne doit être nécessaire au build.
// Le Proxy conserve l'API `openai.chat…`, `openai.images…` pour les appelants.
let client: OpenAI | null = null;

export const OPENAI_TIMEOUT_MS = 45_000;

function getClient(): OpenAI {
  if (!client) {
    // Clé nommée explicitement : sans `apiKey`, le SDK retombe en silence sur
    // OPENAI_API_KEY puis échoue avec un message qui ne nomme pas la variable
    // attendue par Mijote — trompeur au premier démarrage d'un conteneur.
    const apiKey = process.env.OPENAI_SERVICE_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_SERVICE_KEY manquante : la variable d'environnement est requise pour les appels OpenAI (enrichissement, imports IA)",
      );
    }
    // Timeout par appel (45 s) : sans lui, un appel OpenAI qui pend gardait le
    // handler ouvert jusqu'à `maxDuration` et le client abandonnait à 60 s sans
    // réponse. `maxRetries: 0` : les reprises sont gérées par `withRetry`
    // (lib/retry.ts) — le SDK ne doit pas les doubler.
    client = new OpenAI({ apiKey, timeout: OPENAI_TIMEOUT_MS, maxRetries: 0 });
  }
  return client;
}

const openai = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    const real = getClient();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export default openai;
