# Fiche App Store — textes prêts à coller (2026-09)

Décisions actées avec Anthony le 2026-09-02 (analyse concurrentielle : ReciMe, WeChef,
GoomY, My Recipe Box, RecipeChef, Recipe Keeper). Les visuels sont dans
`visuels-app-store/index.html` (v9, export dans `export/`).

## Titre — 26/30 caractères

```
Mijote — Livre de recettes
```

« livre » choisi vs « carnet » : colle à la DA (bel objet) et aux requêtes observées en
campagne ; « carnet » passe dans le champ mots-clés. WeChef occupe déjà « Carnet de
recettes » en titre.

## Sous-titre — 27/30 caractères

```
Importe, cuisine et partage
```

Trois verbes-bénéfices, trois mots-clés indexés (importer, cuisine, partager).
Remplace « Réunies comme par magie » (aucun mot-clé recherché).

## Texte promotionnel — 163/170 caractères

> Modifiable **sans re-review** dans App Store Connect → à poser dès maintenant.

```
Gratuit, sans pub, sans abonnement. Colle un lien Instagram ou TikTok, photographie un vieux cahier ou dicte : la fiche se remplit toute seule, joliment illustrée.
```

## Champ mots-clés — 95/100 caractères

```
carnet,cahier,scanner,instagram,tiktok,marmiton,famille,foyer,menu,repas,plat,ingrédients,vocal
```

- Sans espaces après les virgules ; ne pas répéter les mots du titre/sous-titre
  (déjà indexés).
- ⚠️ `instagram,tiktok,marmiton` : pratique ASO courante mais marques tierces —
  risque (faible) de rejet 2.3.7. Repli si retoqué : `photo,dictée,saison`.

## Description

Changements vs l'actuelle : **hook de 2 lignes + ligne gratuité en ouverture** (seules
~3 lignes visibles avant « plus ») ; « paywalls » → « abonnements » ; dernière ligne
« sans achat intégré » → « sans abonnement » (survivra à une monétisation à débloquage
unique ; ne JAMAIS promettre « sans achat intégré » ni « gratuit pour toujours »).

```
Marre de chercher « cette recette de la dernière fois » entre douze captures d'écran, un lien Instagram perdu et un vieux cahier ? Mijote les réunit dans un seul livre de recettes — et remplit les fiches tout seul.

Gratuit, sans publicité, sans abonnement.

QUATRE FAÇONS D'AJOUTER UNE RECETTE

• PHOTO — prends en photo le carnet de ta grand-mère ou un screenshot Instagram. On extrait le titre, les ingrédients et les étapes pour toi.
• VOIX — dicte la recette pendant qu'on te la raconte au téléphone. On transcrit et on met en forme.
• LIEN — colle l'adresse d'un blog culinaire. On récupère le contenu et on en fait une vraie recette, lisible, sans le bruit autour.
• À LA MAIN — tape directement ta recette si tu la connais par cœur ou si tu veux la composer pas à pas. Tu restes en contrôle de A à Z.

Chaque recette se complète toute seule : temps de préparation, coût estimé, saisons, étiquettes (végétarien, rapide, comfort food). Une jolie illustration est même générée pour reconnaître chaque plat d'un coup d'œil. Tu restes maître : modifie, complète, remplace l'image par tes propres photos.

SIMPLE À ADOPTER, À AIMER, À PARTAGER

• ESSAI EN UN CLIC — explore un carnet démo avant même de créer le tien. Tu vois ce que ça donne, sans rien fournir.
• PAS DE COMPTE — quand tu te lances, pas d'e-mail, pas de mot de passe, pas de publicité. On te respecte assez pour ne rien te demander d'inutile.
• CARNET PARTAGÉ — crée ton carnet et invite qui tu veux, en membre ou en invité (lecture seule). Vos recettes sont les mêmes sur tous vos téléphones. Ton ou ta partenaire ajoute la recette du dimanche midi, tu la retrouves dans ta cuisine du mardi soir.
• PARTAGE PAR LIEN — envoie une recette à qui tu veux par un simple lien. La personne l'ouvre direct, sans compte et sans rien installer, et la garde dans son carnet en un geste.

RETROUVER, SANS CHERCHER

• Accueil par envies : Rapide, Végétarien, Comfort food, De saison, Apéro, Desserts.
• Filtres précis : par ingrédient, durée, coût, régime, type de plat.
• Mode « De saison » : ne voir que ce qui se cuisine maintenant.
• Pendant que tu cuisines, l'écran reste allumé tout seul — pas besoin de réveiller ton téléphone les mains tachées de farine.

TON CARNET, TES RÈGLES

• Renomme ton carnet, gère membres et invités, quitte ou supprime le carnet en deux tapotements.
• Suppression définitive et complète à tout moment — c'est ton contenu, jamais le nôtre.

CONFIDENTIALITÉ

• Pas de profilage publicitaire, pas de pixels de suivi, pas d'identifiant publicitaire.
• Aucune vente de tes données à des tiers.
• Politique de confidentialité : mijote.anthonykocken.fr/legal/confidentialite

POUR QUI ?

Pour celles et ceux qui aiment cuisiner et qui en ont assez de chercher « cette recette de la dernière fois » dans douze endroits différents. Pour les maisonnées qui veulent garder vivantes les vraies recettes — celles qu'on mange, pas celles d'un site sponsorisé. Pour les gens marre des apps bourrées de pubs et d'abonnements.

Mijote est gratuit, sans publicité et sans abonnement.
```

## Ordre d'application

1. **Aujourd'hui, sans review** : texte promotionnel.
2. **Prochaine soumission** (avec les nouveaux visuels) : titre, sous-titre,
   mots-clés, description.
3. Visuel « partage » (S5 FR / 05-share EN) : les lots foyer (rôles membre/invité,
   invitations) sont **en prod depuis le 2026-07-11** → soumissible. La capture FR vient
   encore de la maquette hi-fi ; idéalement la refaire depuis l'app FR comme l'EN
   (pipeline `en-captures/`), pour coller strictement à la guideline 2.3.3.
4. À la monétisation : ajuster le slide S5 « Gratuit. Sans pub, sans abonnement. »
   (retirer « Gratuit. », garder le reste) et la ligne gratuité de la description.

## Nouveautés (What's New) — version 1.3

> Validé le 2026-09-06. Couvre tout ce qui est parti en prod depuis la 1.2 (fin juin) :
> chantier carnets partagés (rôles, multi-carnets, email de secours, profil), carrousels
> refondus, import plus rapide, retour visuel d'illustration, étiquettes corrigées, lot
> fiabilité, version EN. Exclu : transcript audio Instagram (activé puis retiré).

### FR

```
Grosse fournée ! Ton carnet se partage, ton accès est sauvegardé, et tout le reste est plus rapide.

À PLUSIEURS
• Invite qui tu veux dans ton carnet : ton ou ta partenaire, tes colocs, tes parents. Chacun ajoute ses recettes, tout le monde en profite.
• Deux niveaux d'accès : membre (peut ajouter et modifier) ou invité (lecture seule) — un lien d'invitation pour chaque.
• Qui a ajouté quoi ? Un nom par personne, et la liste des membres à portée de main.

TES CARNETS
• Plusieurs carnets : celui de la maison, celui de la coloc, celui de mamie. Passe de l'un à l'autre et choisis où ranger chaque recette.
• Ne perds plus jamais ton carnet : ajoute un email de secours (100 % optionnel) pour retrouver ton accès si tu changes de téléphone.

ET AUSSI
• Accueil repensé : des carrousels par envies (Rapide, Végétarien, Comfort food, De saison…) mieux garnis, sans doublons.
• Import plus rapide et plus précis — à la voix, depuis un lien ou une photo.
• Tu vois l'illustration se créer après un import, au lieu d'attendre sans savoir.
• Étiquettes plus justes (fini les faux « Végétarien »).
• Plus fiable au quotidien : reprise automatique après une coupure réseau, plus de zoom intempestif sur le champ de lien.
• Mijote existe désormais en anglais — pratique pour partager ton carnet avec des proches qui ne parlent pas français.

Un avis sur l'App Store nous aide énormément — merci !
```

### EN (localisation English U.S.)

```
Big batch! Your cookbook is shareable, your access is backed up, and everything else got faster.

TOGETHER
• Invite anyone into your cookbook: your partner, your roommates, your parents. Everyone adds their recipes, everyone enjoys them.
• Two levels of access: member (can add and edit) or guest (read-only) — one invite link for each.
• Who added what? A name for each person, and the member list one tap away.

YOUR COOKBOOKS
• Several cookbooks: home, the flat share, grandma's. Switch between them and choose where each recipe goes.
• Never lose your cookbook again: add a backup email (100% optional) to get your access back if you change phones.

ALSO
• Redesigned home: carousels by craving (Quick, Vegetarian, Comfort food, In season…) that are fuller, with no duplicates.
• Faster, more accurate imports — by voice, from a link or from a photo.
• Watch the illustration being created after an import instead of waiting in the dark.
• More accurate tags (no more false "Vegetarian").
• More reliable day to day: automatic recovery after a network drop, no more unwanted zoom on the link field.

A rating on the App Store helps us enormously — thank you!
```
