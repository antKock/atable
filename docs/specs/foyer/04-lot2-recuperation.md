# Lot 2 — Feature #14 : récupération d'accès

> Lire d'abord `00-socle.md` + `handoff/README.md` (Acte 1) + `handoff/foyer-14.jsx`.
> Prérequis : Lot 1 en staging ; AASA `/recover` déployé depuis le pré-lot (propagation
> Apple faite) ; **clé Resend disponible dans `.env.local`** (Anthony).

## Objectif

L'email de secours optionnel : saisi au profil (sans envoi), utilisé à la
récupération sur un nouvel appareil (magic-link + code), fusion d'owners depuis le
profil en cas de collision. Plus les hints home qui y mènent.

## 0. Infra email (préalable du lot)

- SDK `resend` (ou fetch direct — au choix, minimiser la dépendance). Module
  `src/lib/email/send.ts` : interface `sendRecoveryEmail(to, {magicLink, code})`,
  avec un transport **console/no-op quand `RESEND_API_KEY` absent** (c'est le mode
  des E2E : les tests lisent le code en DB, jamais d'email réel).
- **DÉJÀ FAIT (2026-07-09)** : `RESEND_API_KEY` + `EMAIL_FROM` sont dans `.env.local`
  ET dans Vercel (Production + Preview scope branche staging). Domaine
  `mijote.anthonykocken.fr` vérifié, expéditeur `Mijote <acces@mijote.anthonykocken.fr>`,
  envoi réel testé et reçu en boîte de réception. Clé scopée envoi-seul (voulu).
- **Templates : AVANT d'implémenter, produire 2 propositions HTML** (fichier
  autonome ouvrable en navigateur, style dérivé des tokens Mijote) et les faire
  arbitrer par Anthony. Contenu : objet, corps (lien magique bouton + code 6
  chiffres en repli), footer sobre. Français.

## 1. Migration `028_login_tokens.sql`

> (Corrigé 2026-07-10 : la spec disait `027`, déjà pris par
> `027_owners_memberships.sql` du Lot 0, appliquée en prod.)

```sql
CREATE TABLE login_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  purpose     TEXT NOT NULL CHECK (purpose IN ('recovery','merge')),
  token_hash  TEXT NOT NULL UNIQUE,   -- SHA-256 du token du magic-link (48+ bits, alphabet share-token)
  code_hash   TEXT NOT NULL,          -- SHA-256 du code 6 chiffres
  expires_at  TIMESTAMPTZ NOT NULL,   -- 15 min
  attempts    INT NOT NULL DEFAULT 0, -- essais de code ; max 5 puis token brûlé
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON login_tokens(owner_id);
```
RLS sans policy. Secrets **hashés au repos** (le bearer en clair ne vit que dans
l'email). Générateurs dans `src/lib/auth/` à côté de `share-token.ts`.

> **Livré (revue post-implémentation)** : la 028 porte aussi la fonction SQL
> `merge_owners` (fusion atomique — PostgREST n'a pas de transaction
> multi-requêtes), et une migration **`029_recovery_verify_atomic.sql`** ajoute
> `verify_login_code` : comparaison + incrément d'`attempts` + claim single-use
> sous un même `SELECT … FOR UPDATE`. Un incrément applicatif (lire puis écrire
> `attempts+1`) était contournable par rafale concurrente — le plafond de 5
> essais ne tenait pas, rendant le code 6 chiffres brute-forçable.

## 2. Profil : champ email (maquette 0.3)

- Sous le nom, section « Retrouver ton accès » : input email + copy exacte du
  handoff (« sert uniquement à retrouver ton accès… pas de mot de passe, pas de
  compte »). `PUT /api/owner/email` (withOwnerAuth + **assertNotDemoOwner** —
  le gel démo du profil est owner-level depuis le Lot 1, pas foyer-level :
  suivre le patron de `PUT /api/owner`) : normalise lowercase, valide le
  format, stocke. **Aucun envoi à la saisie.**
- **Collision** (email déjà sur un autre owner) → flow **fusion** (§5).
- Ligne « Toi » du hub : sous-titre devient « Accès sauvegardé » /
  « Sauvegarder mon accès » selon `recovery_email`.

## 3. Hints home (maquettes 1.1 ; décisions n°9 du socle)

- Généraliser la grammaire de `InstallAppBanner` en un `HintCard` (icône + titre +
  corps + CTA + croix) et un `MiniStrip` une-ligne.
- Trois hints, **tous server-gated dans `(app)/layout.tsx`** (pattern cookie
  `mijote_install_dismissed` existant, 180 j) :
  - **install** (existant, restylé en mini-strip « Installe l'app Mijote », iOS web
    uniquement) — toujours AU-DESSUS du hint principal ;
  - hint principal, **un seul à la fois** : **partage** (« Cuisinez à plusieurs »,
    CTA → détail foyer) tant que `recipeCount < 3`, puis **email** (« Sauvegarde ton
    accès », CTA → profil) si `recovery_email` absent.
  - cookies : `mijote_share_hint_dismissed`, `mijote_email_hint_dismissed`.
    Au dismiss du hint email : toast « Tu retrouveras ça dans ton profil ».
- **Démo : aucun hint** partage/email/install ; la bannière démo (CTA conversion)
  est refaite sur la MÊME grammaire `HintCard`/`MiniStrip`, priorité sur tout.

## 4. Fork onboarding + récupération (maquettes 1.2, 1.3, 1.4)

- **Routes publiques** : ajouter `/recover/` et `/api/recovery/` aux
  `PUBLIC_PREFIXES` de `src/middleware.ts` — sans ça l'écran de récupération
  est inatteignable (redirect `/` pour un visiteur sans cookie). L'AASA liste
  déjà `/recover/*` (pré-lot).
- `LandingScreen` : 3ᵉ action **« Rejoindre un foyer »** (lien texte sous les CTA,
  cf. maquette) → écran « Rejoindre un foyer » (fond sage, icône clé) :
  - CTA principal « J'ai un code d'invitation » → `CodeEntryForm` existant ;
  - CTA secondaire « Récupérer avec mon email » → écran de récup.
  - Copy générique (rejoindre un proche OU retrouver son foyer) — clé anti-doublon.
- **Écran récup** : saisie email → `POST /api/recovery/request` :
  - répond **toujours 200** avec le même écran « Vérifie tes mails »
    (anti-énumération stricte, email inconnu inclus) ;
  - si l'email existe : crée `login_tokens(purpose='recovery')`, envoie magic-link
    `https://<host>/recover/<token>` + code ;
  - rate-limits Upstash : par IP et par email (réutiliser les patterns de
    `join/route.ts`) ; compte à rebours de renvoi 60 s côté UI.
- **Écran « Vérifie tes mails »** : email rappelé sur sa ligne, encart code 6
  chiffres (6 cases, `DM Mono`), lien « Renvoyer · 0:42 ».
- **Consommation** :
  - Magic-link : route `GET /recover/[token]` (page) → `POST /api/recovery/consume`
    → vérifie hash/expiry/used → crée `device_session(owner_id)` + signe le cookie →
    redirect `/home`. Fonctionne dans l'app via Universal Link (le
    `DeepLinkHandler` générique route déjà le chemin ; le cookie se pose dans le
    WebView car c'est lui qui navigue).
  - Code : `POST /api/recovery/verify { email, code }` → même issue ; `attempts++`,
    max 5 puis token brûlé.
  - **Pas de fusion à la récup** : simple reconnexion à l'owner (décision n°6).
  - L'ancien appareil coexiste (aucune invalidation des autres sessions).

## 5. Fusion d'owners (depuis le profil uniquement ; maquette VerifyScreen merge)

- Déclencheur : `PUT /api/owner/email` avec un email déjà pris → crée
  `login_tokens(purpose='merge', owner_id = owner CIBLE au email)`, envoie le mail,
  écran « On réunit tes foyers » (lien + code, mêmes mécanique/limites).
- À la vérification : **fusion** = transaction service role :
  - memberships : union (dédup par foyer, garder le rôle le plus fort,
    member > guest) au profit de l'owner **cible** (celui qui portait l'email) ;
  - `device_sessions.owner_id` et `daily_activity.owner_id` : repointés
    source → cible ;
  - `name` : garder celui de la cible, sinon celui de la source ;
  - supprimer l'owner source. Le cookie du device courant reste valide (le `sid`
    ne change pas — sa session est repointée).
- Fonction pure `mergePlan(source, target)` (calcul des unions/décisions) séparée de
  l'exécution → unit-testable à fond.
- **Rate-limits (ajout de revue)** : la route de vérification du code de fusion
  est plafonnée par IP comme `/api/recovery/verify` — sans quoi un owner
  connaissant l'email d'une victime bruteforce le code et **absorbe ses
  foyers**. `PUT /api/owner/email` est plafonné par IP dès avant le lookup : la
  décision n°6 assume la fuite d'existence, pas son énumération scriptée.

## Tests

- E2E (codes lus en DB par les helpers, transport email no-op) :
  1. poser un email au profil → rien d'envoyé (table login_tokens vide), hub
     « Accès sauvegardé » ;
  2. récup complète par code sur un « nouvel appareil » (contexte B) → retrouve son
     foyer ; l'ancien contexte marche toujours ;
  3. récup par magic-link (naviguer l'URL) ;
  4. email inconnu → écran identique, aucune ligne login_tokens ;
  5. code faux ×5 → token brûlé, message générique ;
  6. fusion : deux owners (A avec email, B pose le même email) → vérif → B absorbe
     les foyers ? NON — A est la cible : les sessions de B repointées sur A,
     memberships unis, hub de B liste l'union ;
  7. hints : règle <3 recettes → partage, ≥3 sans email → email, dismiss persistant,
     rien en démo ;
  8. fork onboarding : « Rejoindre un foyer » → les deux chemins.
- Unit : `mergePlan`, hachage/expiry/attempts des tokens, normalisation email.
- **Test manuel unique (Anthony)** : réception réelle des emails Resend sur staging
  (délivrabilité + rendu), et magic-link depuis l'app iOS (Universal Link).

## Points de vigilance

- Ne jamais différencier les réponses (timing compris, best effort) entre email
  connu/inconnu à la récup.
- `EMAIL_FROM`/domaine : staging peut envoyer depuis le même domaine vérifié.
- Le repli code existe parce que le magic-link ouvert hors du WebView ne pose pas le
  cookie au bon endroit — ne pas « optimiser » ce repli.

## Definition of Done

DoD commune + les 8 E2E ci-dessus + templates arbitrés par Anthony + envoi réel
vérifié une fois sur staging.
