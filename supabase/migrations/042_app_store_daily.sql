-- 042 — Stats App Store dans le dashboard (backlog #19).
--
-- Agrégats quotidiens tirés de l'API App Store Connect (Analytics Reports,
-- flux ONGOING) par le cron /api/cron/app-store-sync : une ligne par jour et
-- par source App Store (« App Store search », « App referrer »…), avec le
-- détail referrer (bundle id / domaine, ex. com.openai.chat) dans
-- source_info. Deux rapports alimentent des colonnes DISJOINTES :
--   - App Downloads Standard (r3)               → colonnes `dl_*`
--   - App Store Discovery and Engagement (r15)  → colonnes `eng_*`
-- Les téléchargements n'ont pas de Source Info (source_info = '' pour eux).
--
-- Les compteurs Apple sont arrondis/seuillés (petits volumes omis) : on stocke
-- ce qu'Apple livre, la page rappelle la limite. Service role only (RLS sans
-- policy), comme stats_daily (032).

CREATE TABLE app_store_daily (
  day                 DATE NOT NULL,
  source_type         TEXT NOT NULL,
  source_info         TEXT NOT NULL DEFAULT '',
  -- App Downloads Standard
  dl_first_time       INT  NOT NULL DEFAULT 0, -- « First-time download »
  dl_redownload       INT  NOT NULL DEFAULT 0, -- « Redownload »
  dl_update           INT  NOT NULL DEFAULT 0, -- « Auto-update » + « Manual update »
  -- App Store Discovery and Engagement
  eng_impressions     INT  NOT NULL DEFAULT 0,
  eng_impressions_uniq INT NOT NULL DEFAULT 0,
  eng_page_views      INT  NOT NULL DEFAULT 0,
  eng_page_views_uniq INT  NOT NULL DEFAULT 0,
  eng_taps            INT  NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (day, source_type, source_info)
);

ALTER TABLE app_store_daily ENABLE ROW LEVEL SECURITY;

-- Journal des instances Apple déjà intégrées : l'idempotence du cron repose
-- dessus (une instance = un fichier immuable identifié par Apple ; toute
-- instance inconnue est intégrée, les connues sont sautées). Sert aussi de
-- « dernier passage » au dashboard.
CREATE TABLE app_store_sync_instances (
  instance_id     TEXT PRIMARY KEY,
  report          TEXT NOT NULL CHECK (report IN ('downloads', 'engagement')),
  processing_date DATE NOT NULL,
  data_days       DATE[] NOT NULL DEFAULT '{}',
  row_count       INT NOT NULL DEFAULT 0,
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_store_sync_instances ENABLE ROW LEVEL SECURITY;

-- Remplacement atomique des colonnes d'UN rapport pour UN jour : Apple livre
-- une instance par jour et par rapport, la source de vérité est donc l'instance
-- entière — les lignes du jour absentes de la nouvelle livraison retombent à
-- zéro (sinon une source disparue resterait comptée). Les colonnes de l'autre
-- rapport ne sont pas touchées. Les lignes devenues entièrement nulles sont
-- supprimées.
--
-- p_rows : tableau JSON d'objets { source_type, source_info?, <colonnes du rapport> }.
CREATE OR REPLACE FUNCTION app_store_daily_replace(p_day date, p_report text, p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_report NOT IN ('downloads', 'engagement') THEN
    RAISE EXCEPTION 'app_store_daily_replace: rapport inconnu « % »', p_report;
  END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'app_store_daily_replace: p_rows doit être un tableau JSON';
  END IF;

  IF p_report = 'downloads' THEN
    UPDATE app_store_daily
       SET dl_first_time = 0, dl_redownload = 0, dl_update = 0, updated_at = NOW()
     WHERE day = p_day;

    INSERT INTO app_store_daily (day, source_type, source_info, dl_first_time, dl_redownload, dl_update)
    SELECT p_day,
           r.source_type,
           COALESCE(r.source_info, ''),
           COALESCE(r.dl_first_time, 0),
           COALESCE(r.dl_redownload, 0),
           COALESCE(r.dl_update, 0)
      FROM jsonb_to_recordset(p_rows)
             AS r(source_type text, source_info text, dl_first_time int, dl_redownload int, dl_update int)
     WHERE r.source_type IS NOT NULL
    ON CONFLICT (day, source_type, source_info) DO UPDATE
       SET dl_first_time = EXCLUDED.dl_first_time,
           dl_redownload = EXCLUDED.dl_redownload,
           dl_update     = EXCLUDED.dl_update,
           updated_at    = NOW();
  ELSE
    UPDATE app_store_daily
       SET eng_impressions = 0, eng_impressions_uniq = 0, eng_page_views = 0,
           eng_page_views_uniq = 0, eng_taps = 0, updated_at = NOW()
     WHERE day = p_day;

    INSERT INTO app_store_daily (day, source_type, source_info,
                                 eng_impressions, eng_impressions_uniq,
                                 eng_page_views, eng_page_views_uniq, eng_taps)
    SELECT p_day,
           r.source_type,
           COALESCE(r.source_info, ''),
           COALESCE(r.eng_impressions, 0),
           COALESCE(r.eng_impressions_uniq, 0),
           COALESCE(r.eng_page_views, 0),
           COALESCE(r.eng_page_views_uniq, 0),
           COALESCE(r.eng_taps, 0)
      FROM jsonb_to_recordset(p_rows)
             AS r(source_type text, source_info text, eng_impressions int, eng_impressions_uniq int,
                  eng_page_views int, eng_page_views_uniq int, eng_taps int)
     WHERE r.source_type IS NOT NULL
    ON CONFLICT (day, source_type, source_info) DO UPDATE
       SET eng_impressions      = EXCLUDED.eng_impressions,
           eng_impressions_uniq = EXCLUDED.eng_impressions_uniq,
           eng_page_views       = EXCLUDED.eng_page_views,
           eng_page_views_uniq  = EXCLUDED.eng_page_views_uniq,
           eng_taps             = EXCLUDED.eng_taps,
           updated_at           = NOW();
  END IF;

  DELETE FROM app_store_daily
   WHERE day = p_day
     AND dl_first_time = 0 AND dl_redownload = 0 AND dl_update = 0
     AND eng_impressions = 0 AND eng_impressions_uniq = 0
     AND eng_page_views = 0 AND eng_page_views_uniq = 0 AND eng_taps = 0;
END;
$$;

-- Privilèges : réservés à service_role (règle 039).
REVOKE ALL ON FUNCTION app_store_daily_replace(date, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_store_daily_replace(date, text, jsonb) TO service_role;
