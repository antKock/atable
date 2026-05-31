-- Migration 014: record the running app version per active-day.
--
-- The native shell loads the live web origin and self-updates (VersionWatcher
-- + /api/version), so the build a device is actually running can lag the
-- latest deploy. The activity heartbeat now reports the client's frozen
-- build id; storing it here lets the dashboard watch versions propagate
-- across the fleet day by day. Nullable — pre-014 clients (and any ping
-- without a build id) simply leave it NULL.

ALTER TABLE daily_activity ADD COLUMN IF NOT EXISTS app_version TEXT;
