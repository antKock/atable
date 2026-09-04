# App Store listing — English (en-US) — PRÊT, À PUBLIER AVEC LE LOT 4

> ⚠️ **À n'appliquer qu'à la fin du chantier « Version EN »** (`docs/specs/i18n/`,
> Lot 4 : release iOS avec `en.lproj` + `I18N_EN_ENABLED=1`). Publier la fiche EN
> avant = promesse rompue → avis 1★. Les visuels EN (`visuels-app-store/export-en/`)
> contiennent des captures FR à remplacer par des captures de l'app localisée.
>
> **Vocabulaire aligné sur l'app (2026-09-04)** : un « carnet » se dit **cookbook**
> dans l'interface EN (décision 7 du socle i18n, relevé concurrence ReciMe/Pestle/
> Whisk). La fiche parle donc de *cookbook*, jamais de *household* ni de *recipe
> book* pour désigner le carnet — « recipe book » ne reste que dans le titre, comme
> mot-clé de recherche.

## Title — 28/30 characters

```
Mijote: Recipe Book & Keeper
```

« recipe book » + « recipe keeper » = les deux grosses requêtes EN de la catégorie
(cf. Recipe Keeper, 546 avis). « Mijote » reste la marque, intraduisible et mémorable.

## Subtitle — 29/30 characters

```
Cookbook: import, cook, share
```

Les trois verbes du FR, précédés du mot que l'utilisateur lira dans l'app. Titre +
sous-titre couvrent ainsi les deux requêtes concurrentes de la catégorie : « recipe
book » (titre) et « cookbook » (sous-titre), sans doublon avec le champ mots-clés.

## Promotional text — 148/170 characters

```
Free, no ads, no subscription. Paste an Instagram or TikTok link, snap an old notebook or dictate: the recipe writes itself, beautifully illustrated.
```

## Keywords — 97/100 characters

```
keeper,organizer,scanner,importer,instagram,tiktok,family,meal,planner,grocery,notebook,saver,box
```

(Pas de « marmiton » en EN ; pas de « recipe/book/cookbook » — déjà dans le titre et
le sous-titre. « cookbook » libéré → « saver » et « box » : « recipe saver » et
« recipe box » sont deux requêtes réelles de la catégorie.)

## Description

```
Tired of hunting for "that recipe from last time" across a dozen screenshots, a lost Instagram link and an old notebook? Mijote gathers them all into one cookbook — and fills in the cards for you.

Free, no ads, no subscription.

FOUR WAYS TO ADD A RECIPE

• PHOTO — snap your grandmother's notebook or an Instagram screenshot. We extract the title, ingredients and steps for you.
• VOICE — dictate the recipe while someone tells it to you over the phone. We transcribe it and shape it up.
• LINK — paste the address of a cooking blog. We fetch the content and turn it into a real, readable recipe, without the noise around it.
• BY HAND — type your recipe directly if you know it by heart or want to build it step by step. You stay in control from A to Z.

Every recipe completes itself: prep time, estimated cost, seasons, tags (vegetarian, quick, comfort food). A lovely illustration is even generated so you can spot each dish at a glance. You stay in charge: edit, complete, or swap the image for your own photos.

EASY TO ADOPT, TO LOVE, TO SHARE

• ONE-TAP TRIAL — explore a demo cookbook before even creating your own. See what it feels like without giving anything away.
• NO ACCOUNT — when you get started: no email, no password, no ads. We respect you enough not to ask for anything unnecessary.
• SHARED COOKBOOK — create a cookbook and pass the invite code to whoever you like. Your recipes are the same on all your phones. Your partner adds the Sunday lunch recipe, you find it in your kitchen on Tuesday night.
• SHARE BY LINK — send a recipe to anyone with a simple link. They open it right away, no account, nothing to install, and can keep it in their own cookbook in one tap.

FIND, WITHOUT SEARCHING

• Browse by craving: Quick, Vegetarian, Comfort food, In season, Appetizers, Desserts.
• Precise filters: by ingredient, time, cost, diet, dish type.
• "In season" mode: only see what's worth cooking right now.
• While you cook, the screen stays awake on its own — no need to wake your phone with flour-covered hands.

YOUR COOKBOOK, YOUR RULES

• Rename your cookbook, manage members and guests, leave or delete it in two taps.
• Full and permanent deletion at any time — it's your content, never ours.

PRIVACY

• No ad profiling, no tracking pixels, no advertising identifier.
• Your data is never sold to anyone.
• Privacy policy: mijote.anthonykocken.fr/legal/confidentialite

WHO IS IT FOR?

For people who love to cook and are tired of digging for "that recipe from last time" in twelve different places. For households that want to keep real recipes alive — the ones you actually eat, not the ones from a sponsored site. For anyone fed up with apps stuffed with ads and subscriptions.

Mijote is free, with no ads and no subscription.
```

## Checklist avant publication (= Lot 4 du chantier `docs/specs/i18n/`)

1. Lots 0-3 livrés : interface EN (`src/lib/i18n/en.ts` + bascule par langue
   d'appareil — **fait, Lot 0**), prompts IA en langue source, démo EN, pages
   partage `/r/[token]`, emails, pages légales EN.
2. Recapturer les 6 visuels depuis l'app EN (remplacer les captures FR de
   `export-en/`) ; vérifier que les captures montrent bien « cookbook ».
3. Release iOS avec `en.lproj` (permissions + Share Extension), puis ajouter la
   localisation **English (U.S.)** dans App Store Connect et y coller les textes
   ci-dessus ; poser `I18N_EN_ENABLED=1` en prod le même jour.

Note : la ligne « manage connected devices » de la version précédente a été
remplacée par « manage members and guests » — la liste d'appareils n'existe plus
depuis le chantier foyer (Lot 1/3). La fiche FR validée contient encore « gère les
appareils connectés » : à corriger de la même façon à la prochaine soumission.
