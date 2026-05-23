# Politique de confidentialité — À Table

> **Document à publier à une URL publique stable** (requis par l'App Store et par
> le RGPD). Voir les `[À COMPLÉTER]` avant publication.
>
> ⚠️ Brouillon de qualité production, mais je ne suis pas juriste : une relecture
> RGPD/CNIL est recommandée avant mise en ligne d'un produit publié.

**Dernière mise à jour : 23 mai 2026**

---

## 1. Qui sommes-nous

À Table (« l'Application », « le Service ») est une application de gestion de
recettes de cuisine et de planification de menus, accessible sur le Web et sur
l'App Store iOS.

Le responsable du traitement des données personnelles est :

- **Anthony Kocken**, éditeur indépendant de l'Application.
- Contact : [kocken.anthony@gmail.com](mailto:kocken.anthony@gmail.com)
- Application accessible à l'adresse : `https://atable.anthonykocken.fr`

---

## 2. Notre approche : le strict minimum de données

À Table est conçue pour fonctionner **sans compte traditionnel**. Vous n'avez
besoin de fournir **ni adresse e-mail, ni nom, ni numéro de téléphone, ni mot de
passe**. L'accès repose sur la notion de **foyer** : un espace de recettes
partagé, rejoint au moyen d'un **code d'invitation**.

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

- **Nom du foyer** : le libellé que vous choisissez pour votre espace partagé
  (ex. « Cuisine de Marie »).
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

- **Nom d'appareil** : lors de la connexion d'un appareil à un foyer, nous
  dérivons un libellé lisible (ex. « Apple iPhone 15 · Safari ») à partir de
  l'en-tête technique « User-Agent » de votre navigateur. Cela vous permet de
  reconnaître et de gérer les appareils connectés à votre foyer. L'en-tête
  brut n'est pas conservé.
- **Métadonnées de session** : des identifiants techniques aléatoires (générés
  automatiquement, sans lien avec votre identité réelle) et la date de dernière
  activité de chaque appareil.
- **Adresse IP** : utilisée **uniquement et de façon temporaire** pour limiter
  le nombre de tentatives de connexion à un foyer (protection contre les abus).
  Elle **n'est pas enregistrée dans notre base de données** et n'est pas
  associée à votre contenu.

### 3.3 Données que nous ne collectons PAS

Nom réel, adresse e-mail, numéro de téléphone, adresse postale, mot de passe,
données de géolocalisation, données de santé, données bancaires ou de paiement,
identifiants publicitaires, contacts, historique de navigation.

---

## 4. Finalités et bases légales du traitement

| Donnée | Finalité | Base légale (RGPD) |
|---|---|---|
| Nom du foyer, recettes, photos, tags | Fournir le service : créer, stocker et partager vos recettes au sein du foyer | Exécution du contrat (les conditions d'utilisation du Service) |
| Code d'invitation, identifiants de session, nom d'appareil | Vous authentifier de manière anonyme et gérer l'accès des appareils au foyer | Exécution du contrat |
| Contenu soumis aux imports (audio, images, URL) | Réaliser l'import demandé et structurer la recette | Exécution du contrat (fonctionnalité que vous déclenchez explicitement) |
| Adresse IP | Limiter les tentatives de connexion abusives | Intérêt légitime (sécurité du Service) |

---

## 5. Imports par intelligence artificielle

Pour transformer un enregistrement vocal, une photo ou une page web en recette
structurée, l'Application fait appel au service **OpenAI** (voir section 6).

- **Import par dictée vocale** : l'enregistrement audio est transmis à OpenAI
  pour transcription, puis le texte obtenu est structuré. **L'enregistrement
  audio n'est jamais conservé** par À Table : seul le texte de la recette
  résultante est enregistré.
- **Import par photo / capture d'écran** : l'image est transmise à OpenAI pour
  en extraire le texte de la recette. **Les images d'import ne sont pas
  conservées** par À Table : seule la recette structurée résultante est
  enregistrée. (Les photos que vous **ajoutez délibérément** à une recette, à
  l'inverse, sont conservées — voir section 8.)
- **Import par lien URL** : le contenu textuel de la page web est récupéré puis
  transmis à OpenAI pour structuration. **L'adresse URL et le contenu brut de la
  page ne sont pas conservés.**

Ces traitements ne sont déclenchés que **lorsque vous utilisez explicitement**
la fonction d'import correspondante.

---

## 6. Hébergement et sous-traitants

Pour fonctionner, l'Application s'appuie sur les prestataires techniques
suivants, qui agissent en qualité de **sous-traitants** pour notre compte :

| Prestataire | Rôle | Données concernées | Localisation |
|---|---|---|---|
| **Vercel** | Hébergement de l'application | Données techniques de requête, journaux | `[À COMPLÉTER : région — ex. UE / États-Unis]` |
| **Supabase** | Base de données et stockage des photos | Foyers, recettes, sessions, photos | `[À COMPLÉTER : région du projet]` |
| **Upstash** | Limitation de débit (sécurité) | Adresse IP, identifiants de session | `[À COMPLÉTER : région]` |
| **OpenAI** | Transcription audio, lecture d'images, structuration de texte | Contenu soumis aux imports (section 5) | États-Unis |

Concernant **OpenAI** : les données transmises via leur interface de
programmation (API) **ne sont pas utilisées pour entraîner leurs modèles** et
sont conservées par OpenAI pour une durée limitée (à des fins de prévention des
abus) avant suppression, conformément à leur politique de traitement des données
API.

> ℹ️ `[À VÉRIFIER]` : privilégiez, lorsque c'est possible, des régions
> d'hébergement situées dans l'Union européenne (Vercel, Supabase, Upstash) afin
> de limiter les transferts hors UE.

---

## 7. Transferts de données hors Union européenne

Certains sous-traitants, notamment **OpenAI**, peuvent traiter des données aux
**États-Unis**. Ces transferts sont encadrés par des garanties appropriées au
sens du RGPD (clauses contractuelles types de la Commission européenne et/ou
adhésion au cadre de protection des données UE–États-Unis, selon le prestataire).

---

## 8. Durées de conservation

| Donnée | Durée de conservation |
|---|---|
| Foyer, recettes, photos, sessions d'appareil | Conservés tant que le foyer existe ; supprimés lorsque vous supprimez le foyer (voir section 11) |
| Cookie de session (`atable_session`) | 1 an (renouvelable à chaque connexion) |
| Adresse IP (limitation de débit) | 1 heure maximum |
| Contenu soumis aux imports, côté OpenAI | Durée limitée fixée par OpenAI, puis suppression |
| Journaux techniques (hébergeur) | Durée limitée, à des fins de sécurité et de diagnostic |

Aucune suppression automatique des foyers inactifs n'est appliquée à ce jour :
vos recettes restent disponibles tant que vous ne les supprimez pas.

---

## 9. Cookies et stockage local

L'Application **n'utilise aucun cookie publicitaire ou de mesure d'audience**.
Aucun bandeau de consentement aux cookies n'est donc nécessaire.

- **Cookie `atable_session`** : cookie **strictement nécessaire** au
  fonctionnement du Service. Il vous maintient connecté à votre foyer. Il est
  sécurisé (inaccessible au JavaScript, signé cryptographiquement, transmis
  uniquement en HTTPS) et a une durée de vie d'un an.
- **Stockage local du navigateur** (`localStorage`) : utilisé à des fins
  strictement fonctionnelles — mémoriser votre préférence de thème
  (clair/sombre), accélérer l'affichage via une mémoire tampon des données déjà
  chargées, et conserver un identifiant technique aléatoire servant à organiser
  le stockage de vos photos. Ces informations restent sur votre appareil.

---

## 10. Sécurité

Nous mettons en œuvre des mesures techniques visant à protéger vos données :
chiffrement des échanges (HTTPS), cookie de session sécurisé et signé
cryptographiquement, limitation des tentatives de connexion, et accès aux
données restreint à votre foyer.

Toutefois, **le code d'invitation d'un foyer fait office de clé d'accès** :
quiconque possède ce code peut rejoindre le foyer. Nous vous recommandons de ne
le partager qu'avec les personnes de confiance.

---

## 11. Suppression de vos données

Vous gardez le contrôle de vos données directement depuis l'Application :

- **Quitter le foyer** : déconnecte l'appareil utilisé. Les recettes du foyer
  sont conservées pour les autres appareils.
- **Supprimer le foyer** : supprime **définitivement** l'ensemble des recettes,
  des étiquettes, des sessions d'appareil et le foyer lui-même.
- **Supprimer une recette** : supprime la recette concernée et ses étiquettes
  associées.

La suppression d'un foyer satisfait l'exigence d'un chemin clair de suppression
des données de l'utilisateur.

---

## 12. Vos droits

Conformément au RGPD, vous disposez des droits d'**accès**, de **rectification**,
d'**effacement**, de **limitation**, d'**opposition** et de **portabilité** de
vos données.

- Les droits de **rectification** et d'**effacement** s'exercent directement
  dans l'Application (modification ou suppression de vos recettes, suppression
  du foyer).
- Pour toute autre demande (accès, copie de vos données, opposition), vous
  pouvez nous contacter à l'adresse indiquée à la **section 1**.

L'Application ne nous permettant pas de relier un foyer à une identité réelle,
nous pourrons être amenés à vous demander des éléments permettant d'établir que
vous êtes bien membre du foyer concerné avant de donner suite à une demande.

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
