# Politique de confidentialité — Mijote

> **Source de vérité éditoriale.** La version publiée en ligne est
> `src/app/(landing)/legal/confidentialite/page.tsx` →
> `https://mijote.anthonykocken.fr/legal/confidentialite`. Toute mise à jour
> ici doit être répercutée dans la page Next.js.
>
> ⚠️ Document de qualité production mais non relu par un juriste : une revue
> RGPD/CNIL reste recommandée avant communication large.

**Dernière mise à jour : 5 septembre 2026**

---

## 1. Qui sommes-nous

Mijote (« l'Application », « le Service ») est une application de gestion de
recettes de cuisine et de planification de menus, accessible sur le Web, sur
l'App Store iOS et sur Google Play (Android).

Le responsable du traitement des données personnelles est :

- **Anthony Kocken**, éditeur indépendant de l'Application.
- Contact : [kocken.anthony@gmail.com](mailto:kocken.anthony@gmail.com)
- Application accessible à l'adresse : `https://mijote.anthonykocken.fr`

---

## 2. Notre approche : le strict minimum de données

Mijote est conçue pour fonctionner **sans compte traditionnel**. Vous n'avez
besoin de fournir **ni adresse e-mail, ni nom, ni numéro de téléphone, ni mot de
passe**. L'accès repose sur la notion de **carnet** : un carnet de recettes
partagé, ouvert au moyen d'un **code d'invitation**.

Deux informations sont **facultatives** et ne servent qu'à vous : un **nom de
profil**, affiché aux autres membres de vos carnets, et un **e-mail de secours**,
utilisé uniquement pour retrouver vos carnets si vous changez ou perdez votre
appareil. Sans e-mail de secours, aucun e-mail ne vous est jamais envoyé.

Nous nous engageons sur les principes suivants :

- **Aucune publicité, aucun profilage publicitaire.**
- **Aucun outil de mesure d'audience ni de traçage** (pas de Google Analytics,
  pas de cookies tiers, pas de pixels de suivi).
- **Aucune vente ni location** de vos données à des tiers.
- **Aucun suivi entre applications ou entre sites** (pas de « tracking » au sens
  de l'App Store).

---

## 3. Données que nous traitons

### 3.1 Données que vous nous fournissez

- **Nom du carnet** : le libellé que vous choisissez pour votre carnet partagé
  (ex. « Cuisine de Marie »).
- **Nom de profil (facultatif)** : le nom que vous choisissez d'afficher aux
  autres membres de vos carnets. Sans nom, un alias aléatoire (ex. « Lapin
  Curieux »), dérivé d'un identifiant technique, est affiché à la place.
- **E-mail de secours (facultatif)** : l'adresse que vous enregistrez dans votre
  profil pour retrouver vos carnets sur un nouvel appareil. Elle est stockée
  telle quelle (en minuscules) et n'est utilisée que pour vous envoyer, à votre
  demande, un lien ou un code de connexion (voir sections 6 et 10). Vous pouvez
  la retirer à tout moment depuis votre profil.
- **Lien de partage d'une recette** : lorsque vous partagez une recette, nous
  générons une adresse unique. Toute personne disposant de ce lien peut
  consulter la recette (titre, ingrédients, étapes, photo) et l'enregistrer
  dans son propre carnet, sans compte. Le lien reste valable tant que la
  recette existe.
- **Contenu des recettes** : titres, listes d'ingrédients, étapes de préparation,
  temps de préparation et de cuisson, coût estimé, saisons, étiquettes (tags) et
  photos que vous ajoutez.
- **Contenu soumis aux fonctions d'import** : lorsque vous importez une recette,
  vous nous transmettez, selon la méthode choisie :
  - un **enregistrement audio** (import par dictée vocale) ;
  - une ou plusieurs **images** (import par photo ou capture d'écran) ;
  - une **adresse de page web** (import par lien URL).

  Le traitement de ces éléments est détaillé à la **section 5**.

### 3.2 Données collectées automatiquement

- **Nom d'appareil** : lors de la connexion d'un appareil à un carnet, nous
  dérivons un libellé lisible (ex. « Apple iPhone 15 · Safari ») à partir de
  l'en-tête technique « User-Agent » de votre navigateur. Il sert au diagnostic
  et à la sécurité (reconnaître un appareil en cas de demande de votre part).
  L'en-tête brut n'est pas conservé.
- **Métadonnées de session** : des identifiants techniques aléatoires (générés
  automatiquement, sans lien avec votre identité réelle) et la date de dernière
  activité de chaque appareil.
- **Adresse IP** : utilisée **uniquement et de façon temporaire** pour limiter
  le nombre de tentatives de connexion à un carnet (protection contre les abus).
  Elle **n'est pas enregistrée dans notre base de données** et n'est pas
  associée à votre contenu.
- **Rapports d'erreur (plantages)** : en cas d'erreur technique ou de plantage,
  un rapport est transmis à notre prestataire **Sentry** (voir section 6). Il
  peut contenir le message d'erreur, le type d'appareil, la version du système
  et un identifiant technique de session, afin de diagnostiquer et corriger le
  problème. Il **ne contient pas le contenu de vos recettes**.
- **Appartenances et rôles** : la liste des carnets auxquels vous avez accès et
  votre rôle dans chacun (membre, ou invité en lecture seule).
- **Statistiques d'usage internes** : pour comprendre l'utilisation du Service,
  nos serveurs enregistrent, par appareil connecté, les jours d'activité et la
  plateforme (iOS, Android, web), des compteurs par recette (nombre de
  consultations, dernière activité) et des agrégats quotidiens (nombre d'essais
  de la démo, d'e-mails de récupération envoyés…). Ces statistiques sont
  produites sans aucun outil tiers et ne contiennent ni nom ni adresse e-mail.
- **Langue** : l'interface s'affiche dans la langue de votre appareil (en-tête
  technique « Accept-Language ») ; cette information n'est pas conservée.

### 3.3 Données que nous ne collectons PAS

Sauf si vous les saisissez volontairement dans votre profil (nom, e-mail de
secours), nous ne collectons aucun nom ni adresse e-mail. Nous ne collectons
jamais : numéro de téléphone, adresse postale, mot de passe, données de
géolocalisation, données de santé, données bancaires ou de paiement,
identifiants publicitaires, contacts, historique de navigation.

---

## 4. Finalités et bases légales du traitement

| Donnée | Finalité | Base légale (RGPD) |
|---|---|---|
| Nom du carnet, recettes, photos, tags | Fournir le service : créer, stocker et partager vos recettes au sein du carnet | Exécution du contrat (les conditions d'utilisation du Service) |
| Code d'invitation, identifiants de session, nom d'appareil, appartenances et rôles | Vous authentifier de manière anonyme et gérer l'accès des appareils et des personnes aux carnets | Exécution du contrat |
| Nom de profil | Vous identifier auprès des autres membres de vos carnets | Exécution du contrat (information facultative) |
| E-mail de secours, liens et codes de connexion | Retrouver vos carnets sur un nouvel appareil ; réunir deux accès en un seul profil | Exécution du contrat (fonctionnalité facultative que vous activez) |
| Statistiques d'usage internes | Mesurer l'utilisation du Service et l'améliorer | Intérêt légitime (amélioration du Service), sans profilage individuel |
| Contenu soumis aux imports (audio, images, URL) | Réaliser l'import demandé et structurer la recette | Exécution du contrat (fonctionnalité que vous déclenchez explicitement) |
| Adresse IP | Limiter les tentatives de connexion abusives | Intérêt légitime (sécurité du Service) |
| Rapports d'erreur (plantages) | Diagnostiquer et corriger les dysfonctionnements, améliorer la stabilité | Intérêt légitime (qualité et sécurité du Service) |

---

## 5. Imports par intelligence artificielle

Pour transformer un enregistrement vocal, une photo ou une page web en recette
structurée, l'Application fait appel au service **OpenAI** (voir section 6).

- **Import par dictée vocale** : l'enregistrement audio est transmis à OpenAI
  pour transcription, puis le texte obtenu est structuré. **L'enregistrement
  audio n'est jamais conservé** par Mijote : seul le texte de la recette
  résultante est enregistré.
- **Import par photo / capture d'écran** : l'image est transmise à OpenAI pour
  en extraire le texte de la recette. **Les images d'import ne sont pas
  conservées** par Mijote : seule la recette structurée résultante est
  enregistrée. (Les photos que vous **ajoutez délibérément** à une recette, à
  l'inverse, sont conservées — voir section 8.)
- **Import par lien URL** : le contenu textuel de la page web est récupéré —
  directement, ou pour certaines sources (Instagram, sites protégeant l'accès
  automatisé) via notre prestataire **Apify** (voir section 6) à qui l'adresse
  est transmise — puis transmis à OpenAI pour structuration. **L'adresse URL et
  le contenu brut de la page ne sont pas conservés.**

Ces traitements ne sont déclenchés que **lorsque vous utilisez explicitement**
la fonction d'import correspondante.

---

## 6. Hébergement et sous-traitants

Pour fonctionner, l'Application s'appuie sur les prestataires techniques
suivants, qui agissent en qualité de **sous-traitants** pour notre compte :

| Prestataire | Rôle | Données concernées | Localisation |
|---|---|---|---|
| **Vercel** | Hébergement de l'application | Données techniques de requête, journaux | Union européenne (Paris, `cdg1`) |
| **Supabase** | Base de données et stockage des photos | Foyers, recettes, sessions, photos | Union européenne (Irlande, `eu-west-1`) |
| **Upstash** | Limitation de débit (sécurité) | Adresse IP, identifiants de session | Royaume-Uni (Londres, `eu-west-2`) |
| **OpenAI** | Transcription audio, lecture d'images, structuration de texte | Contenu soumis aux imports (section 5) | États-Unis |
| **Apify** | Récupération du contenu de pages web lors de l'import par lien (Instagram, sites protégeant l'accès automatisé) | Adresse de la page à importer | États-Unis |
| **Sentry** | Journalisation des erreurs et rapports de plantage | Messages d'erreur, contexte technique (type d'appareil, système, identifiant de session) | États-Unis |
| **Resend** | Envoi des e-mails de récupération d'accès | Adresse e-mail de secours, lien et code de connexion | États-Unis |

Concernant **OpenAI** : les données transmises via leur interface de
programmation (API) **ne sont pas utilisées pour entraîner leurs modèles** et
sont conservées par OpenAI pour une durée limitée (à des fins de prévention des
abus) avant suppression, conformément à leur politique de traitement des données
API.

---

## 7. Transferts de données hors Union européenne

Vercel et Supabase, qui hébergent l'essentiel de vos données, opèrent
**au sein de l'Union européenne**. Deux sous-traitants traitent néanmoins
des données en dehors de l'UE :

- **OpenAI** (imports IA) opère aux **États-Unis** ;
- **Apify** (import par lien) opère aux **États-Unis** ;
- **Sentry** (rapports d'erreur) opère aux **États-Unis** ;
- **Resend** (e-mails de récupération d'accès) opère aux **États-Unis** ;
- **Upstash** (limitation de débit) opère au **Royaume-Uni**.

Ces transferts sont encadrés par des garanties appropriées au sens du RGPD :
clauses contractuelles types de la Commission européenne, décision
d'adéquation Royaume-Uni du 28 juin 2021, et/ou adhésion au cadre de
protection des données UE–États-Unis (*EU–US Data Privacy Framework*) pour les
prestataires établis aux États-Unis.

---

## 8. Durées de conservation

| Donnée | Durée de conservation |
|---|---|
| Carnet, recettes, photos, sessions d'appareil | Conservés tant que le carnet existe ; supprimés lorsque vous supprimez le carnet (voir section 11) |
| Nom de profil, e-mail de secours | Tant que votre profil existe ; modifiables ou retirables à tout moment depuis le profil |
| Liens et codes de connexion | 15 minutes (stockés hachés, 5 essais maximum), purgés au plus tard 24 h après expiration |
| Cookie de session (`atable_session`) | 180 jours, prolongés à chaque utilisation de l'Application |
| Adresse IP (limitation de débit) | 1 heure maximum |
| Contenu soumis aux imports, côté OpenAI | Durée limitée fixée par OpenAI, puis suppression |
| Rapports d'erreur (Sentry) | Durée limitée fixée par Sentry (90 jours par défaut), puis suppression |
| Journaux techniques (hébergeur) | Durée limitée, à des fins de sécurité et de diagnostic |
| Statistiques d'usage internes | Agrégats quotidiens conservés sans limite ; jours d'activité par appareil supprimés avec le carnet |
| Compte démo | Recettes ajoutées dans la démo supprimées chaque nuit ; identités démo purgées après 30 jours |

Aucune suppression automatique des carnets inactifs n'est appliquée à ce jour :
vos recettes restent disponibles tant que vous ne les supprimez pas.

---

## 9. Cookies et stockage local

L'Application **n'utilise aucun cookie publicitaire ou de mesure d'audience**.
Aucun bandeau de consentement aux cookies n'est donc nécessaire.

- **Cookie `atable_session`** : cookie **strictement nécessaire** au
  fonctionnement du Service. Il vous maintient connecté à votre carnet. Il est
  sécurisé (inaccessible au JavaScript, signé cryptographiquement, transmis
  uniquement en HTTPS) et a une durée de vie de 180 jours, prolongée à chaque
  utilisation.
- **Stockage local du navigateur** (`localStorage`) : utilisé à des fins
  strictement fonctionnelles — accélérer l'affichage via une mémoire tampon des
  données déjà chargées, et conserver un identifiant technique aléatoire
  servant à organiser le stockage de vos photos. Ces informations restent sur
  votre appareil.

---

## 10. Sécurité

Nous mettons en œuvre des mesures techniques visant à protéger vos données :
chiffrement des échanges (HTTPS), cookie de session sécurisé et signé
cryptographiquement, limitation des tentatives de connexion, et accès aux
données restreint à votre carnet.

Les liens et codes de connexion envoyés à votre e-mail de secours sont à usage
unique, valables 15 minutes, stockés hachés (SHA-256) et limités à 5 essais.

Toutefois, **le code ou le lien d'invitation d'un carnet fait office de clé
d'accès** : quiconque le possède peut ouvrir le carnet — en lecture et écriture
avec un lien « membre », en lecture seule avec un lien « invité ». Nous vous
recommandons de ne les partager qu'avec des personnes de confiance ; tout membre
peut retirer une personne du carnet à tout moment.

---

## 11. Suppression de vos données

Vous gardez le contrôle de vos données directement depuis l'Application :

- **Quitter un carnet** : retire votre accès à ce carnet. Ses recettes sont
  conservées pour les autres membres.
- **Retirer un membre** : tout membre peut retirer une autre personne d'un
  carnet ; son accès est coupé immédiatement.
- **Supprimer un carnet** : supprime **définitivement** l'ensemble des recettes,
  des étiquettes, des sessions d'appareil et le carnet lui-même.
- **Supprimer une recette** : supprime la recette concernée et ses étiquettes
  associées.
- **Retirer votre e-mail de secours ou votre nom** : depuis votre profil, à
  tout moment.
- **Se déconnecter** : efface la session de l'appareil utilisé.

La suppression d'un carnet satisfait l'exigence d'un chemin clair de suppression
des données de l'utilisateur.

---

## 12. Vos droits

Conformément au RGPD, vous disposez des droits d'**accès**, de **rectification**,
d'**effacement**, de **limitation**, d'**opposition** et de **portabilité** de
vos données.

- Les droits de **rectification** et d'**effacement** s'exercent directement
  dans l'Application (modification ou suppression de vos recettes, suppression
  du carnet).
- Pour toute autre demande (accès, copie de vos données, opposition), vous
  pouvez nous contacter à l'adresse indiquée à la **section 1**.

L'Application ne nous permettant pas de relier un carnet à une identité réelle
(hors e-mail de secours que vous auriez enregistré), nous pourrons être amenés à vous demander des éléments permettant d'établir que
vous êtes bien membre du carnet concerné avant de donner suite à une demande.

Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une
réclamation auprès de la **Commission nationale de l'informatique et des
libertés (CNIL)** — `www.cnil.fr`.

---

## 13. Mineurs

L'Application n'est pas destinée aux enfants et ne collecte pas sciemment de
données les concernant. Aucune donnée n'est demandée permettant de connaître
l'âge des utilisateurs.

---

## 14. Modifications de la présente politique

Cette politique de confidentialité peut être amenée à évoluer. Toute
modification substantielle sera signalée par la mise à jour de la date figurant
en tête de document.

---

## 15. Contact

Pour toute question relative à la présente politique ou au traitement de vos
données : [kocken.anthony@gmail.com](mailto:kocken.anthony@gmail.com).
