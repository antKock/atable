# Journal des événements — requêtes (#28)

Spec : `docs/specs/events/00-socle.md`. Les **moments** sont des vues SQL (migration 052) ;
les questions récurrentes qui ne méritent pas une vue vivent ici, en `.sql`.

```bash
node scripts/events/query.mjs prod last-screen-before-churn.sql   # par ssh, lecture seule
node scripts/events/query.mjs staging "select count(*) from events"
node scripts/events/query.mjs local import-outcomes.sql             # harnais E2E
```

| Fichier | Question |
|---|---|
| `onboarding-by-variant.sql` | Q1 — où les nouveaux iOS s'arrêtent-ils, par bras A/B |
| `last-screen-before-churn.sql` | Q2 — dernier écran avant de disparaître |
| `intense-vs-evaporated.sql` | Q2 — première semaine des intenses vs des évaporés |
| `import-outcomes.sql` | Q3 — issues et causes d'échec par méthode d'import |
| `platforms.sql` | Q7 — iOS / Android / web |
| `discovery.sql` | Q8 — d'où viennent les consultations, quels filtres servent |

Règles : identifiants seulement (jamais de contenu dans `props`) ; les cibles `data-track`
référencées ici sont vérifiées par `src/lib/events/catalog.test.ts`.
