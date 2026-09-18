# Chantier « Monétisation » — Socle (backlog #29)

> Cadrage fait avec Anthony le 2026-09-18. **Rien n'est développé.** Ce document réunit
> les décisions prises, celles qui restent ouvertes, et le plan d'exécution. L'entité qui
> encaisse est tranchée (compte Apple individuel) ; restent D1-bis à D5.

## Objectif

**Ne pas perdre d'argent, sans chercher à en gagner.** L'app reste utilisable à volonté.
Seul ce qui coûte cher et relève du « plus » devient payant, à un prix supérieur au coût
réel, pour que les payeurs financent les gratuits. La démarche est transparente : on montre
ce que Mijote coûte et ce que les utilisateurs ont apporté.

## Constat chiffré (prod, `ai_costs`, 2026-09-18)

| Semaine | Coût IA | Foyers ayant consommé de l'IA |
|---|---|---|
| 24/08 | 1,51 $ | 6 |
| 31/08 | 0,59 $ | 13 |
| 07/09 | 3,11 $ | 21 |
| 14/09 (4,5 j) | 6,42 $ | 26 |

- Rythme actuel ≈ **50 $/mois d'IA** (`ai_costs` sous-estime de 10 à 20 %, cf. analyse du
  2026-09-18). Avec le VPS (~5 à 9 €) et la licence Apple (~8 €/mois), le total est
  d'environ **60 €/mois**. Le coût a doublé chaque semaine pendant trois semaines.
- Répartition sur 30 jours : **foyer médian 6,5 ¢**, maximum 3,06 $, **5 foyers = 54 %**
  de la dépense. Le problème vient des gros importeurs, pas de l'utilisateur moyen.
- Par poste : **illustration IA 64 %** (≈ 1,2 ¢ par image), OCR 29 %, le reste (texte,
  voix, Apify) est négligeable.
- Requêtes utilisées : `node scripts/events/query.mjs prod "<sql sur ai_costs>"`.

## Décisions prises

1. **Gratuit et illimité** : saisie, carnet, recherche, mode cuisson, foyer et invités,
   partage, multi-carnets, imports URL, Instagram, voix et texte, **import photo (OCR)
   compris**, avec un simple garde-fou quotidien (quelques dizaines par jour) contre l'abus.
2. **Payant : l'illustration IA uniquement.**
   - **Stock gratuit à vie** de 50 illustrations. Pas de recharge mensuelle. Les comptes
     existants partent aussi de 50 le jour du lancement.
   - Stock épuisé → **couverture typographique gratuite** générée sans IA (couleur, titre,
     motif), pour garder un carnet homogène. Photo d'origine pour les imports URL : piste
     séparée, question des droits non tranchée.
3. **Pas d'abonnement** (trop cher perçu par les utilisateurs). Vente de **packs** en achat
   intégré consommable :

   | Pack | Prix | Reste après TVA et 15 % Apple | Coût réel | Marge |
   |---|---|---|---|---|
   | 100 recettes illustrées | **2,99 €** | ~2,12 € | ~1,10 € | ~1 € |
   | 300 recettes illustrées | **6,99 €** | ~4,95 € | ~3,30 € | ~1,65 € |

   - Formulation **en recettes, pas en images**, par comparaison avec un livre de cuisine.
   - Apple propose des paliers de prix au pas de 10 centimes sous 10 € : ajustable en
     5 minutes dans App Store Connect.
4. **Tout achat débloque pour toujours les styles de génération supplémentaires** (et sert
   de badge « soutien »).
5. **Pourboire sans contrepartie** possible en plus (consommable, autorisé par la
   règle 3.1.1).
6. **Page « Ce que coûte Mijote »** : coût du mois en direct, montant apporté par les
   utilisateurs, **jauge collective** (« 41 % du mois couvert par 23 personnes »). Le coût
   par compte reste un détail, mis en avant pour ceux qui ont épuisé leur stock (pour la
   plupart des gens, le chiffre est minuscule et ne motive pas). Chaque achat se rattache au
   collectif : « tes 4,99 € couvrent tes illustrations et ~29 foyers gratuits ».
7. **Achat intégré Apple, pas de paiement externe** (voir « Règles Apple » : l'écart de
   frais est nul ou négatif sur des petits montants).
8. **Pas de RevenueCat**, jugé trop lourd à ce stade. Choix intermédiaire : plugin
   open source dans l'app et vérification sur notre serveur (voir « Architecture »).
9. Vocabulaire : **« soutenir », « contribuer »**, jamais « don ». Juridiquement, ce qui est
   vendu dans l'app est du chiffre d'affaires, pas un don (pas de reçu fiscal possible).

## Décisions ouvertes (état au 2026-09-18)

| # | Question | Décision |
|---|---|---|
| D1 | Entité qui encaisse | **Compte Apple individuel** (scénario A). |
| D1-bis | Adresse affichée sur la fiche UE (DSA) | **Adresse personnelle acceptée**, pas de domiciliation. |
| D2 | À qui appartiennent les crédits | **À l'owner (la personne)**. Pour ne pas perdre des crédits achetés : **proposer fortement** l'e-mail de secours au premier achat, sans l'imposer (la règle Apple 5.1.1 interdit d'exiger des données personnelles non indispensables ; un achat bloqué derrière un e-mail risque le refus en revue). Filet : historique StoreKit des consommables (iOS 18+). Les crédits gratuits d'un appareil perdu sans e-mail sont perdus : acceptable. |
| D3 | Styles | 3 ou 4 styles cohérents avec une app de recettes. **Choix au moment du lot 3**, sur échantillons. |
| D4 | Photo d'origine des imports URL | **Hors chantier** : future fonction « utiliser l'image de la page », à mettre au backlog séparément. |
| D5 | Réinstallation ou nouveau profil = 50 illustrations de plus | **Accepté à court terme.** Si abus observé : Apple DeviceCheck. |

## Entité qui encaisse (D1)

### Faits

- SASU **Anthony Kocken Conseil** (SIREN 941 185 878), active depuis le 2025-02-21,
  **NAF 70.22Z** (conseil pour les affaires). Le NAF est statistique et ne limite rien.
  Ce qui compte, c'est **l'objet social (article 2 des statuts)**, non consultable dans le
  registre public : **à relire**. Une clause « et plus généralement toutes opérations se
  rattachant directement ou indirectement… » couvre en général une activité annexe. Même
  hors objet, une SAS reste engagée vis-à-vis des tiers (art. L227-6 C. com.) : le risque
  est interne, et l'associé unique est Anthony. Élargir l'objet coûte ~150 à 300 €
  (décision de l'associé unique, annonce légale, formalité INPI).
- **Aujourd'hui c'est la SASU qui paie** OpenAI, le VPS et la licence Apple. L'avenir de la
  SASU sera clair d'ici 3 à 4 mois (fin 2026 / début 2027).
- **Un compte Apple individuel peut encaisser** : les ventes arrivent sur l'IBAN personnel.
- **Pour vendre dans l'UE, Apple exige le statut de professionnel (DSA) et affiche l'adresse,
  le téléphone et l'e-mail du vendeur sur la fiche App Store.** En individuel, c'est
  l'adresse personnelle (parade : domiciliation, ~10 €/mois). **À vérifier : le statut DSA
  actuellement déclaré dans App Store Connect.**
- Compte Google Play : probablement **personnel** (les tests fermés à 12 testeurs sont une
  contrainte des comptes personnels). Même question le jour où Android devient payant.

### Scénario A : commencer en individuel — **RETENU le 2026-09-18**

- Aucune démarche à faire maintenant : les ventes 2026 se déclarent au printemps 2027, en
  **revenus non commerciaux non professionnels** (formulaire 2042-C-PRO, **case 5KU**, régime micro-BNC :
  abattement de 34 %, puis impôt sur le revenu et 17,2 % de prélèvements sociaux). Le fisc
  tolère ce cas pour une activité accessoire. À ces montants, l'impôt se compte en euros par
  an. **Il n'y a pas besoin de « tricher » : la voie légale ne coûte rien avant la
  déclaration de 2027.**
- Si l'activité devient régulière, la voie propre est la **micro-entreprise** : création
  gratuite en 15 minutes sur le guichet unique de l'INPI, cotisations URSSAF
  proportionnelles aux recettes (rien si aucune vente), cumulable avec la présidence de la
  SASU.
- Incohérence assumée tant que les montants sont faibles : coûts payés par la SASU,
  recettes perçues en personnel. À signaler au comptable à la clôture.
- Revoir la question quand les recettes cumulées approchent **200 €** ou quand l'avenir de
  la SASU est clair (le premier des deux).

### Scénario B : passer le compte Apple au nom de la SASU

1. Récupérer le **numéro D-U-N-S** de la SASU (gratuit) avec l'outil d'Apple
   <https://developer.apple.com/enroll/duns-lookup/>. S'il n'existe pas, le demander à
   Dun & Bradstreet : ~5 jours ouvrés, parfois 2 semaines.
2. Demander le **passage du compte en organisation** : raison sociale, site web, D-U-N-S.
   Apple peut appeler ou demander un Kbis. Compter **1 à 4 semaines** au total. Cause de
   retard habituelle : une raison sociale qui ne correspond pas exactement à la fiche D&B.
3. Signer le contrat payant, puis renseigner IBAN et fiscalité au nom de la SASU.

- **L'app reste en ligne pendant la migration** : notes, avis, bundle ID et TestFlight sont
  conservés. Seul le nom du vendeur change.
- **Il n'existe pas de retour d'un compte organisation vers un compte individuel.** Si la
  SASU ferme, il faut **transférer l'app** (App Transfer d'App Store Connect) vers un
  nouveau compte (99 €) **avant la radiation**. Sont conservés : l'app, les avis, le
  bundle ID et les produits d'achat intégré. Les soldes de crédits sont chez nous et ne
  bougent pas. **Point à revérifier le moment venu** : l'App Group partagé entre l'app et la
  Share Extension (`ios/App/App/App.entitlements`) doit être recréé dans le nouveau compte.

### Préalables Apple, quel que soit le scénario

- [ ] **Paid Applications Agreement** signé (App Store Connect > « Agreements, Tax, and
      Banking »).
- [ ] **IBAN** du bénéficiaire (personnel ou SASU).
- [ ] **Formulaire fiscal US** : W-8BEN (individuel) ou W-8BEN-E (SASU). La convention
      France–US ramène la retenue à la source à 0 %.
- [ ] **Adhésion au Small Business Program** (15 % au lieu de 30 %). Elle n'est pas
      automatique et se demande à part.
- [ ] **Statut de professionnel DSA** à jour (voir plus haut pour l'adresse affichée).
- [ ] Produits d'achat intégré créés dans App Store Connect, avec capture d'écran pour la
      revue ; politique de confidentialité et conditions d'utilisation à jour.

## Règles Apple (relues en ligne le 2026-09-18)

- **3.1.1** : tout contenu ou toute fonction débloquée dans l'app passe par l'achat intégré.
  Les pourboires au développeur sont autorisés (« tip the developer »). **Les crédits
  achetés ne doivent jamais expirer**, et il faut un mécanisme de restauration pour ce qui
  est restaurable.
- **3.2.1 (vi) / 3.2.2 (iv)** : la collecte hors achat intégré n'est permise qu'aux
  associations reconnues par Apple. Une SASU n'y a pas droit.
- **3.1.3 (b)** : un achat fait sur le web peut être reconnu dans l'app, à condition que la
  même offre existe aussi en achat intégré.
- **3.1.1 (a)** : hors UE et hors États-Unis, interdiction de pousser vers un autre moyen de
  paiement. **Aux États-Unis**, les liens vers le web sont autorisés.
- **UE (DMA)**, d'après la page Apple, avec le Small Business Program :
  - achat intégré Apple : **15 %**, TVA, remboursements et fraude gérés par Apple ;
  - paiement tiers dans l'app : 10 % + frais du prestataire ;
  - lien vers le web : 10 % sur les achats faits dans les 7 jours après le clic, + frais
    du prestataire.

  Les frais fixes Stripe (~0,25 €) pèsent ~12 % d'un achat à 1,99 € : **l'achat intégré est
  aussi cher, voire moins cher, et ne laisse rien à gérer.**
- **Changement au 2026-10-01** : conditions UE unifiées (« Attachment 14 » de la licence
  développeur, mise à jour le 2026-08-18). La Core Technology Commission (5 %) remplace
  l'ancien frais par installation. Conclusion inchangée pour Mijote.

Sources :
[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) ·
[Apps in the EU](https://developer.apple.com/support/apps-in-the-eu/) ·
[RevenueCat — mise à jour DMA](https://www.revenuecat.com/blog/growth/apple-eu-dma-update-june-2025) ·
[Funnelfox — frais App Store 2026](https://blog.funnelfox.com/apple-app-store-fees-2026-eu-dma/)

## Architecture proposée

### Dans l'app

- Plugin **[`@capgo/native-purchases`](https://github.com/Cap-go/capacitor-native-purchases)**
  (MIT, gratuit, StoreKit 2 sur iOS, Google Play Billing sur Android) : liste des produits,
  achat, lecture des transactions. Pas de Swift à écrire.
  - Alternatives écartées : RevenueCat (service tiers, jugé trop lourd à ce stade ; à
    reconsidérer si Android et le web deviennent payants) ; Capawesome Purchases (offre
    payante) ; plugin StoreKit maison (~100 lignes de Swift, sans gain réel).
- **Prix affiché = `displayPrice` de StoreKit**, jamais un prix en dur : devise et
  localisation gérées par Apple (FR et EN).
- Web et Android au lancement : la page de transparence et le solde restent visibles, les
  packs sont indisponibles (message « disponible dans l'app iOS »). Sur le web, on ne
  pousse pas vers l'App Store avec un prix (3.1.3).

### Sur le serveur

- Route `POST /api/purchases/verify` : reçoit la transaction signée (JWS), la vérifie avec
  la bibliothèque officielle **`@apple/app-store-server-library`** (chaîne de certificats
  Apple), puis crédite le solde **une seule fois par `transactionId`** (idempotence par
  contrainte d'unicité).
- **App Store Server Notifications v2** (`POST /api/purchases/apple-notifications`) : un
  remboursement (`REFUND`) retire les crédits correspondants (le solde peut devenir
  négatif ; on n'en tient pas rigueur, on bloque seulement les nouvelles générations).
- Données (migration à venir), crédits rattachés à l'**owner** (proposition D2) :
  - `credit_ledger(id, owner_id, delta, reason, transaction_id UNIQUE NULL, product_id,
    created_at)` avec `reason` parmi `grant_free | purchase | refund | generation |
    admin` : le solde est la somme. Un journal plutôt qu'un compteur : c'est traçable et
    ça alimente directement la page de transparence ;
  - `owner_unlocks(owner_id, unlock, created_at)` pour les styles ;
  - `ai_costs` existante pour le coût réel par owner ou foyer.
- **La consommation se fait au moment de la génération** (`src/lib/enrichment.ts`) : ligne
  `generation` (-1) écrite dans la même opération que l'appel image. Un échec de génération
  rend le crédit. La régénération consomme aussi un crédit.
- **Perte d'appareil** : les crédits suivent l'owner, donc la récupération par e-mail de
  secours (#14) les ramène. Proposer l'e-mail de secours juste après le premier achat.
  Filet supplémentaire à vérifier : depuis iOS 18, la clé Info.plist
  `SKIncludeConsumableInAppPurchaseHistory` fait apparaître les consommables dans
  l'historique StoreKit, ce qui permettrait de recréditer (dédoublonné par
  `transactionId`) sur un nouvel appareil.
- Foyers démo : pas d'achat, pas de consommation (garde-fou existant
  `assertNotDemoSeedMutation` et `is_demo`).

### Transparence

- Coût du mois : Costs API d'OpenAI (déjà utilisée par `/admin/stats`,
  `src/lib/admin/openai-costs.ts`) + coûts fixes déclarés dans la config (VPS, licence Apple,
  domaine). Mise en cache (la Costs API est lente, cf. note sur la lenteur du dashboard).
- Recettes : somme des achats du mois dans `credit_ledger`, montant net après TVA et
  commission (calculé à partir du prix du produit). Les rapports financiers d'Apple
  (`scripts/apple-connect.mjs`) servent à recaler une fois par mois.
- Aucune donnée personnelle affichée : agrégats uniquement (nombre de contributeurs, pas de
  noms).

### Règles du repo à respecter

- Chaque chaîne visible dans `src/lib/i18n/fr.ts` **et** `en.ts`.
- Chaque bouton porte un `data-track` du catalogue `src/lib/events/catalog.ts`. Identifiants
  proposés, à figer à l'implémentation (ils ne se renommeront plus ensuite) :
  `credits.pack_buy`, `credits.tip`, `credits.restore`, `transparency.open`,
  `cover.style_pick`. Les « moments » (conversion stock épuisé → achat) sont des **vues
  SQL**, pas de nouveaux événements.
- Jamais de montant ni d'identifiant de transaction dans les `props` d'événement.

## Lots

| # | Contenu | Dépend de | Statut |
|---|---|---|---|
| 0 | **Démarches Apple (Anthony, en parallèle)** : contrat payant, IBAN perso, W-8BEN, Small Business Program, statut DSA. | — | à faire |
| 1 | **Stock gratuit + couverture typographique** : `credit_ledger`, attribution de 50 crédits à tous les owners, consommation à la génération, couverture sans IA quand le solde est nul, affichage du solde. Utile même sans paiement : plafonne déjà les gros consommateurs. | — | à faire |
| 2 | **Packs en achat intégré** : produits App Store Connect, plugin, vérification serveur, notifications de remboursement, écran d'achat, proposition d'e-mail de secours au premier achat. | lots 0 et 1 | à faire |
| 3 | **Styles de génération** débloqués par tout achat. | D3, lot 2 | à faire |
| 4 | **Page « Ce que coûte Mijote »** + pourboire. | lot 2 | à faire |
| 5 | Mesure : vues SQL (stock épuisé → achat, taux de conversion, couverture du mois). | lot 2 | à faire |

**Le lot 1 est prêt à démarrer** ; il avance en parallèle des démarches Apple (lot 0).

## Risques et points d'attention

- **Revue Apple** : la première soumission avec achats intégrés est plus scrutée. Prévoir
  la capture de l'écran d'achat, un compte de test sandbox, et une formulation qui ne
  mentionne aucun autre moyen de paiement.
- **Réaction des utilisateurs actuels** : prévenir avant de lancer (message dans l'app),
  et offrir le stock de 50 à tous, y compris aux gros importeurs.
- **Croissance du coût avant le lancement** : le lot 1 seul plafonne déjà la dépense. C'est
  le levier le plus rapide si la courbe continue de doubler.
- **Plafond Apify** (crédit gratuit de 5 $/mois) : hors périmètre, mais à surveiller avec
  la croissance (cf. analyse des coûts IA).
