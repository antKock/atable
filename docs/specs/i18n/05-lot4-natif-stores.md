# Lot 4 — Natif, stores et activation (code livré le 2026-09-05 ; activation en attente)

> Contexte et décisions : `00-socle.md`. Ce lot clôt le chantier : c'est ici que
> l'anglais devient visible pour de vrais utilisateurs.

## Fait (code, sur staging)

- **iOS — localisations déclarées** : `knownRegions` + `fr` dans le projet ;
  `App/fr.lproj/InfoPlist.strings` et `App/en.lproj/InfoPlist.strings` (les 3
  textes de permission caméra / micro / photos + `CFBundleDisplayName`),
  enregistrés dans la cible App (variant group + phase Resources). Effets :
  la fiche App Store affichera « Français, Anglais », et iOS proposera le
  réglage par-app Réglages › Mijote › Langue.
- **Share Extension** : titre et 4 messages passés par `NSLocalizedString`,
  `ShareExtension/{fr,en}.lproj/Localizable.strings`. Le groupe est
  « synchronisé » (Xcode 16+) : les `.lproj` sont embarqués sans édition du
  pbxproj.
- `ios/App/CapApp-SPM/Package.swift` régénéré par `npx cap sync ios` (il
  référençait encore `@capacitor/action-sheet`, retiré en juillet — le build
  Xcode échouait à résoudre les paquets).
- **Vérifié par un build device** (`xcodebuild … -sdk iphoneos
  CODE_SIGNING_ALLOWED=NO`) : `App.app/{fr,en}.lproj/InfoPlist.strings` et
  `ShareExtension.appex/{fr,en}.lproj/Localizable.strings` présents, valeurs EN
  correctes. Le simulateur est indisponible sur cette machine (CoreSimulator
  plus ancien que Xcode 26.6) — test sur appareil réel à faire via TestFlight.
- **Android** : rien à traduire (`strings.xml` = nom de l'app), le WebView envoie
  `Accept-Language` de l'appareil. Aucune modification.

## Checklist d'activation (dans cet ordre)

1. [ ] **Relecture humaine** de `src/app/(landing)/legal/confidentialite/content-en.tsx`
   (texte à valeur juridique) — Anthony. Visible sur staging : `?lang=en` puis
   `/legal/confidentialite`.
2. [ ] **Prod — données** : migration `038_demo_stats_rollup_multi.sql` (avant le
   code, comme d'habitude), puis `node scripts/demo-en/demo-en.mjs apply --env prod`
   (idempotent ; crée le foyer démo EN + 30 recettes, images FR réutilisées).
3. [ ] **Prod — env Vercel** : `vercel env add DEMO_HOUSEHOLD_ID_EN production
   --value 00000000-0000-0000-0000-00000000e000 --yes` (⚠ jamais `npx vercel`).
4. [ ] **Promotion staging → main** (PR + `gh pr merge --admin`, compte antKock).
   Toujours invisible tant que `I18N_EN_ENABLED` est absent.
5. [ ] **Build iOS** : `npx cap sync ios` (prod = sans `CAP_ENV`), archive Xcode,
   upload TestFlight ; tester sur un iPhone **réglé en anglais** : permissions
   caméra/micro/photos en EN, Share Extension « Import into Mijote », réglage
   par-app présent dans Réglages › Mijote.
6. [ ] **App Store Connect** : ajouter la localisation *English (U.S.)*, coller
   `docs/marketing/fiche-app-store-en.md` (titre, sous-titre « Cookbook: import,
   cook, share », mots-clés, description, promo), **captures EN** prises depuis
   l'app localisée (remplacer les captures FR de `visuels-app-store/export-en/`).
   Google Play : fiche EN (sans nouveau build).
7. [ ] **Activation** : `vercel env add I18N_EN_ENABLED production --value 1 --yes`
   + redéploiement prod. **Découplée de la release App Store** (décision Anthony,
   2026-09-05) : un appareil anglais qui a déjà l'app passe en EN dès
   l'activation — c'est le but ; la fiche et les captures EN suivent avec la
   release iOS. Prérequis réels : étapes 1 à 4.
8. [ ] Vérifier en prod avec `curl -H "Accept-Language: en-US"` : `<html lang="en">`,
   `/api/demo/session` → recettes EN ; puis mettre à jour `00-socle.md` (statuts
   `done`), le vault (`Mijote.md`, `Historique & Décisions.md`) et la note ASO.

## Rollback

`vercel env rm I18N_EN_ENABLED production` + redéploiement : tout le monde
revient en FR instantanément (le code EN reste, inerte). Les données EN (foyer
démo) peuvent rester.

## Hors périmètre / suites possibles

- Sélecteur de langue in-app (décision 1 : non).
- `demo_stats_rollup` par foyer (max FR/EN, pas la somme) — cf. Lot 3.
- `INFOPLIST_KEY_CFBundleDisplayName = "Mijote - Tes Recettes"` dans les build
  settings n'est pas repris par le build (l'Info.plist donne « Mijote ») :
  réglage vestigial, laissé tel quel.
