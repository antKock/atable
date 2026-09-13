-- 047 — Veilleur ops (backlog #27) : compte quotidien des réponses 5xx vues par
-- Traefik (logs d'accès, relevés par scripts/vps/watch.sh), écrit par
-- POST /api/admin/watch (upsert par jour). Sert le voyant « Bord (Traefik) » de
-- la section Santé et le digest du lundi. Rien d'autre : sauvegardes et crons
-- sont lus directement (S3, tables existantes).

ALTER TABLE stats_daily
  ADD COLUMN IF NOT EXISTS traefik_5xx INT NOT NULL DEFAULT 0;
