-- 031: owners.alias — surnom auto STOCKÉ (statique), au lieu d'être dérivé à la
-- volée de l'id à chaque rendu (src/lib/alias.ts). Un changement des pools
-- d'animaux/adjectifs (ex. assainissement des surnoms désagréables) ne doit plus
-- jamais faire bouger le surnom d'un owner : il est figé en base à la création
-- (nouveaux owners) et par backfill (existants). Le nom choisi par l'utilisateur
-- (owners.name) prime toujours ; `alias` n'est que le repli par défaut.
--
-- Sûre à appliquer AVANT le déploiement du code (migration avant code) : la
-- colonne naît NULLABLE, l'ancien code l'ignore, le nouveau la lit avec repli
-- `alias ?? aliasForOwner(id)`. Les owners existants sont backfillés ensuite
-- (scripts/backfill-owner-alias.mjs) — figeant leur surnom actuel, en ne
-- remplaçant que ceux qui contiennent un mot retiré.
alter table owners add column if not exists alias text;

comment on column owners.alias is
  'Surnom auto par défaut, figé à la création. Repli quand owners.name est NULL. Jamais régénéré (statique).';
