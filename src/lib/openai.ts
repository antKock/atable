import OpenAI from "openai";

// Client instancié à la première utilisation, pas au chargement du module :
// `next build` évalue les modules des routes (« collecting page data ») et le
// constructeur OpenAI lève une erreur sans clé. Sur Vercel la clé est présente
// au build ; dans l'image Docker (docs/infra/migration-vps-ovh.md) elle ne
// l'est volontairement pas — aucun secret ne doit être nécessaire au build.
// Le Proxy conserve l'API `openai.chat…`, `openai.images…` pour les appelants.
let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_SERVICE_KEY });
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
