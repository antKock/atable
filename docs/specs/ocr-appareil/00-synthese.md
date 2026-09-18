# Chantier « OCR sur l'appareil » — Synthèse (étapes 1 à 5)

> Cadré par Anthony le 2026-09-18. Apple Vision sur l'iPhone lit le texte, le serveur le
> structure avec luna, gpt-4o reste en secours. **Rien de natif ni de changement du flux
> d'import sans validation d'Anthony.** En cas d'écart doc ↔ code, le code fait foi.

## 0. En bref

- **Étape 1 — sur staging** (`b0035d5`) : gpt-4o renvoie la nature des images (`kind`) dans le même
  appel OCR, consignée sans contenu (`image_kind` sur `api.called`). Lecture :
  `scripts/events/queries/image-kinds.sql`. Go prod à demander.
- **Pool public** : 98 recettes / 154 images (56 captures, 27 pages imprimées, 15 manuscrits),
  licences notées, images hors git.
- **Qualité** : sans aucun secours, Vision + luna fait **24,2/30 contre 24,3 pour gpt-4o** en
  moyenne pondérée (70/25/5), écart dans le bruit du juge (±2,7). Captures 25,8 vs 26,3 ;
  imprimés **21,7 vs 19,4** (Vision meilleur) ; manuscrits **13,3 vs 21,0** (échec net : le
  secours sert à ça). L'API classique `VNRecognizeTextRequest` (iOS 13+) fait au moins aussi bien
  que la nouvelle `RecognizeDocumentsRequest` (iOS 26+) : pas besoin d'exiger iOS 26.
- **Secours retenu** : luna auto-évalue la lecture dans le même appel (`ocr_quality`) ; secours
  gpt-4o si `poor`, ou `doubtful` avec une confiance Vision pondérée < 0,9. Sur le pool pondéré :
  **14 % de secours** (87 % des manuscrits), score 24,2 vs 24,3.
- **Coût** : ≈ **0,22 ¢ par import photo** au lieu de ≈ 1 ¢ (−78 %) ; ≈ −23 % de la facture IA
  totale. Mais en valeur absolue le gain est faible : **≈ 0,6 $/mois à 5 recettes/jour, ≈ 12 $/mois
  à 100/jour**.

## 1. Étape 1 — mesurer la répartition (livrée sur staging)

- `IMAGE_KINDS` (`src/lib/schemas/import.ts`) ; le schéma OCR = schéma commun + `kind` en dernier ;
  consigne dans `OCR_USER_PROMPT` (`src/lib/import.ts`). ~3 tokens de sortie, aucun appel en plus.
- `extractRecipeFromImages` renvoie `{ recipe, imageKind }` ; la route pose `image_kind` par
  l'en-tête interne `withApiEventExtra` (comme `site`), jamais dans la réponse. Une valeur absente
  ou inconnue ne fait pas échouer l'import.
- Vérifié : tsc, lint, 1 018 vitest, 63 E2E ; vrai gpt-4o sur les captures du harnais ; import réel
  sur staging (sonde : 200, pas de `kind` ni d'en-tête interne dans la réponse) ; ligne `events`
  vérifiée sur la stack locale sans sonde ; Sentry staging vide.
- **Justesse de `kind` sur le pool : 98/98** (56 screenshot, 27 printed_photo, 15 handwritten).
- ⚠ **Lecture biaisée** : en prod, 99 % des imports photo viennent d'iOS et **une seule personne**
  en fait 34 à 46 par jour (163 imports réussis du 15 au 18/09). La répartition mesurée sera
  surtout la sienne : lire aussi la colonne `personnes` de `image-kinds.sql`.

## 2. Pool de test (sources publiques)

Scripts, manifestes et vérités des manuscrits versionnés dans `scripts/bench/ocr-pool/` ; images
et autres vérités dans `scripts/bench/fixtures/ocr-pool/` (hors git, régénérables par les
scripts `build-*`). Aucune image d'utilisateur.

| Catégorie | Recettes / images | Sources | Licences |
|---|---|---|---|
| Captures d'écran | 56 / 104 | 45 pages web mobiles (Marmiton, 750g, CuisineAZ, JDF, Ptitchef, Cuisine Actuelle, Elle, Femme Actuelle, Hervé Cuisine, 7 blogs FR ; BBC Good Food, AllRecipes, Serious Eats, Budget Bytes, RecipeTin, Love & Lemons, Cookie and Kate, Minimalist Baker) + 11 rendus d'app (Notes, iMessage, WhatsApp, légende Instagram, appli, PDF) | pages : droit d'auteur, capture pour test interne (TDM, art. L122-5-3 CPI), hors git ; rendus : textes rédigés pour le banc ou Wikibooks CC BY-SA |
| Pages imprimées | 27 / 33 | 13 vraies pages numérisées (Farmer 1918, Beeton 1907, Picayune 1916, Gouffé, Audot, Tante Marie, Escoffier, Dubois, Ali-Bab, Ouest-Éclair 1924…) + 14 mises en page modernes composées (Wikibooks CC BY-SA ou rédigées), toutes « photographiées » par script (perspective, courbure, lumière chaude, ombre, flou, double page) | domaine public (archive.org, Gallica : réutilisation non commerciale), CC BY-SA, CC0 |
| Manuscrits | 15 / 17 | Paris Musées (fiches 1944, CC0), Wellcome MS.7883 (1849, PDM), boîte à recettes du Michigan (CC BY-SA), NARA / bibliothèques présidentielles (PD-US), Columbus Library (NoC-US) | voir le manifeste |

Vérité terrain : JSON-LD `Recipe` restreint à ce qui est visible (captures), texte injecté (rendus),
transcriptions faites à la main en regardant l'image (vieux livres, manuscrits). Jamais une sortie
de modèle testé.

**Limites** : pas de vrai livre récent photographié (droits d'auteur) ; les photos sont simulées ;
les fiches manuscrites françaises viennent d'un seul fonds (crayon, 1944) ; Instagram inaccessible
sans compte (rendus locaux) ; les captures web sont plus longues que la moyenne de prod (1,9 image
par import contre 1,6).

Le **plan B** (conservation déclarée de 30 jours des images d'import) n'est **pas nécessaire** :
le pool couvre les trois catégories, et la répartition réelle viendra de l'étape 1.

## 3. Banc d'essai

`scripts/bench/ocr-pool/` : `vision-ocr.swift` (Vision sur Mac, `.accurate`, fr-FR + en-US,
correction linguistique, modes classique et documents), `bench-ocr-pool.mjs` (prompt et schéma
**relus depuis `src/lib/import.ts`**), `judge-ocr-pool.mjs` (gpt-5.6-sol en aveugle contre la
vérité, /30 + erreurs graves + « autre recette »), `report-ocr-pool.mjs`.

Variantes : `gpt-4o` (prod), `vision+luna` (API classique), `vdoc+luna` (API documents), et les
mêmes avec auto-évaluation `ocr_quality` (`…lunaq`).

| /30 (erreurs graves par recette) | Captures (56) | Imprimés (27) | Manuscrits (15) | Pondéré 70/25/5 |
|---|---|---|---|---|
| gpt-4o | 26,3 (0,55) | 19,4 (3,11) | 21,0 (2,93) | 24,3 (1,31) |
| vision+lunaq | 25,8 (0,39) | 21,7 (3,41) | 13,3 (6,73) | 24,2 (1,46) |
| vision+luna | 25,8 (0,39) | 20,7 (3,56) | 12,9 (7,07) | 23,9 (1,52) |
| vdoc+lunaq | 25,3 (0,50) | 19,6 (3,85) | 13,6 (6,67) | 23,3 (1,65) |

- **Pondération** : estimation 70 % captures / 25 % imprimés / 5 % manuscrits en attendant
  l'étape 1. Avec le secours, l'écart reste sous 0,4 pt de 85/12/3 à 50/35/15.
- **Vieux livres** : gpt-4o y fait 12,7 contre 18,4 : il lit de travers les petits corps serrés
  (quantités fausses) et prend plus souvent une recette voisine. Hors pages à plusieurs recettes
  (`--sans-ambigus`) : imprimés 26,8 (Vision) contre 24,6 (gpt-4o).
- **Captures** : les écarts restants viennent surtout de la structuration par luna (sections
  inventées, ingrédients d'une variante), pas de la lecture.
- **Confiance Vision** : avec la correction linguistique, elle ne prend que 3 valeurs par ligne
  (1 / 0,5 / 0,3). C'est un signal grossier, utile seulement pondéré par la longueur.
- **Latence** (médiane) : gpt-4o 4,0 s (prod : 4,1 s, p90 7,3 s) ; luna sur le texte 2,9 s + Vision
  ≈ 0,3 s par image sur Mac (plus lent sur iPhone, à mesurer) : **à peu près équivalent**.
- Coût du banc : ≈ 1,3 $ d'appels + ≈ 3,5 $ de juge.

## 4. Critère de secours

« Lecture mauvaise » = la variante texte fait 5,4 pts de moins que gpt-4o (2× le bruit du juge) ou
commet ≥ 2 erreurs graves de plus. Base : `vision+lunaq`, pool pondéré 70/25/5.

| Critère | Secours | Non rattrapées | Inutiles | Score | Secours sur les manuscrits |
|---|---|---|---|---|---|
| jamais | 0 % | 10 % | 0 % | 24,2 | 0 % |
| `ocr_quality = poor` | 5 % | 7 % | 2 % | 24,4 | 67 % |
| **`poor` OU (`doubtful` ET confiance < 0,9)** | **14 %** | **6 %** | **10 %** | **24,2** | **87 %** |
| `ocr_quality ≠ good` | 43 % | 1 % | 34 % | 24,1 | 100 % |
| confiance pondérée < 0,9 | 25 % | 6 % | 21 % | 24,1 | 80 % |
| < 2 ingrédients ou 0 étape | 29 % | 8 % | 27 % | 24,2 | 27 % |
| toujours | 100 % | 0 % | 90 % | 24,3 | 100 % |

- **Retenu** : `poor` OU (`doubtful` ET confiance pondérée < 0,9). Le critère `poor` seul suffit
  pour la moyenne, mais il laisse passer un manuscrit sur trois ; or une fiche de grand-mère ratée
  coûte cher en confiance. Le seuil vit **côté serveur** : il se règle sans nouvelle version.
- Les « non rattrapées » restantes (6 %) sont surtout des défauts de structuration de luna
  (captures, mises en page modernes). Un secours ne les corrigerait qu'en partie.
- Filet complémentaire proposé : un lien « Lecture imparfaite ? Relire la photo » sur le
  formulaire pré-rempli, qui déclenche gpt-4o à la demande (un seul identifiant `data-track`).

### Coût moyen et gain

- Aujourd'hui : ≈ **1 ¢** par import photo (Costs API, +21 % sur l'estimation).
- Chemin iOS : luna ≈ **0,08 ¢** + 14 % × 1 ¢ de secours ≈ **0,22 ¢** (−78 %) ; critère `poor` seul
  ≈ 0,13 ¢ (−87 %). Le web (1 % des imports photo) reste sur gpt-4o.
- L'OCR pèse ≈ 0,53 ¢ par recette en moyenne (29 % d'une recette à 1,75 ¢) : gain ≈ **0,41 ¢ par
  recette**, soit ≈ **−23 % de la facture IA**.

| Rythme | Facture IA / mois aujourd'hui | Gain / mois |
|---|---|---|
| ≈ 5 recettes / jour | ≈ 2,6 $ | ≈ 0,6 $ |
| ≈ 65 / jour (rythme du 16 au 18/09) | ≈ 34 $ | ≈ 8 $ |
| ≈ 100 / jour | ≈ 53 $ | ≈ 12 $ |

Bénéfices hors facture : les photos ne quittent pas le téléphone dans ≈ 86 % des cas (argument de
confidentialité) ; moins de pression sur la limite gpt-4o de l'organisation (**30 000 tokens/min ≈
9 imports photo par minute** ; atteinte pendant le banc, jamais en prod à ce jour).

## 5. Architecture proposée (rien d'implémenté)

### Plugin iOS : maison

- **Écarté** : `@capacitor-community/image-to-text` (Vision, mais CocoaPods uniquement alors que le
  projet est en SPM ; ni confiance, ni langues fr/en, ni correction réglable) ; les plugins ML Kit
  (`@capacitor-mlkit/text-recognition`, `@pantrist/…`) ajoutent le SDK Google sans gain sur iOS —
  **à reconsidérer pour Android**, avec le même contrat JS.
- **Plugin `MijoteOcr`** dans la cible App (~100 lignes Swift, reprise de `vision-ocr.swift`),
  enregistré par une sous-classe de `CAPBridgeViewController`
  (`capacitorDidLoad → bridge?.registerPluginInstance`). `recognize({ images: string[] })` (les
  data URL déjà redimensionnées par `resizeImageToBase64`) → `{ engine, pages: [{ lines: [{ text,
  confidence, box }] }], ms }` ; file d'attente en arrière-plan, `.accurate`, fr-FR + en-US,
  correction activée, iOS 15 (cible actuelle) suffit.
- Côté web : `Capacitor.isPluginAvailable("MijoteOcr")`. Les versions installées sans plugin
  gardent le chemin gpt-4o, sans rien changer ; le code web part avant le build.

### Route

`POST /api/recipes/import/screenshot` accepte en plus `{ ocr: { engine, pages } }` (texte ≤ 50 000
caractères, zod) :
1. le serveur assemble le texte, appelle luna avec le schéma + `ocr_quality` ;
2. critère OK → 200 avec la recette (comme aujourd'hui) ;
3. sinon → 200 `{ needImages: true, retryToken }` (jeton signé, lié à l'owner, 10 min) ; le client
   renvoie les images avec le jeton, **sans reconsommer le quota** ;
4. Vision n'a presque rien lu (< 40 caractères) → secours direct, sans appel luna.
- Plugin en erreur, trop lent (> 10 s) ou absent → le client envoie les images comme aujourd'hui.
  Hors ligne : comme aujourd'hui (l'import demande le réseau), pas de file d'attente.

### Coûts, journal, tests

- `ai_costs` : nouveau `call_type` **`ocr_text`** (luna sur le texte Vision), `ocr` reste gpt-4o.
  ⚠ **Migration** : la contrainte `ai_costs_call_type_check` (025) doit l'accepter **avant** le code ;
  vérifier le regroupement par voie du dashboard v3.
- Journal : `api.called` porte `ocr_path` (`device` / `device_fallback` / `server`) et
  `ocr_quality` (catégories). `image_kind` n'existe que quand gpt-4o est appelé.
- Tests : vitest de la route (texte OK, secours, jeton, quota non reconsommé, texte vide) ; le banc
  devient le test de non-régression (ajouter une variante qui appelle exactement le code serveur).

### Version iOS

- **Demande un build** : le plugin et son enregistrement (cible App). Rien de visible, pas de
  nouvelle permission (les photos sont déjà choisies par l'utilisateur).
- **Ne demande pas de build** : la route, le critère, `ImportSelector` et la migration, poussés avant
  et inactifs tant qu'aucun build n'expose le plugin.
- **À grouper avec l'étape 2 du chantier Instagram** (`docs/specs/instagram/00-socle.md` §2.5 prévoit
  déjà ce regroupement) : une seule revue pour 1.4.
- App Privacy : moins de données envoyées, pas de nouvelle catégorie. La politique de confidentialité
  peut mentionner la lecture sur l'appareil (facultatif).

## 6. Décisions attendues d'Anthony

1. Go prod de l'étape 1.
2. Faire ou non l'intégration, sachant que le gain annuel se situe entre ≈ 7 $ et ≈ 150 $ selon le
   rythme : l'intérêt principal est de profiter du build Instagram (même revue) et de l'argument
   de confidentialité.
3. Critère de secours : combiné (recommandé) ou `poor` seul (moins cher, un manuscrit sur trois
   non rattrapé).
