// Types du schéma Postgres, GÉNÉRÉS — ne pas éditer à la main.
//
//   npm run db:types
//
// Source : la base Supabase LOCALE du harnais E2E (`npx supabase gen types
// --local`), qui porte exactement `supabase/migrations/` — le même schéma que
// staging et prod (appliqué avec `scripts/vps/migrate.mjs`). Après toute
// migration : régénérer, committer avec elle. `tsc` révèle alors chaque
// colonne fantôme ou renommée dans les requêtes (revue 2026-09-12, lot 1).
//
// Consommé par `createServerClient()` (src/lib/supabase/server.ts) :
// `PostgrestClient<Database>` type `.from()`, `.select()`, `.rpc()`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ai_costs: {
        Row: {
          call_type: string
          cost_usd: number
          created_at: string
          household_id: string
          id: string
          input_tokens: number | null
          model: string
          output_tokens: number | null
          recipe_id: string | null
        }
        Insert: {
          call_type: string
          cost_usd?: number
          created_at?: string
          household_id: string
          id?: string
          input_tokens?: number | null
          model: string
          output_tokens?: number | null
          recipe_id?: string | null
        }
        Update: {
          call_type?: string
          cost_usd?: number
          created_at?: string
          household_id?: string
          id?: string
          input_tokens?: number | null
          model?: string
          output_tokens?: number | null
          recipe_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_costs_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_costs_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_costs_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "v3_recipe_people"
            referencedColumns: ["recipe_id"]
          },
        ]
      }
      app_store_daily: {
        Row: {
          day: string
          dl_first_time: number
          dl_redownload: number
          dl_update: number
          eng_impressions: number
          eng_impressions_uniq: number
          eng_page_views: number
          eng_page_views_uniq: number
          eng_taps: number
          source_info: string
          source_type: string
          updated_at: string
        }
        Insert: {
          day: string
          dl_first_time?: number
          dl_redownload?: number
          dl_update?: number
          eng_impressions?: number
          eng_impressions_uniq?: number
          eng_page_views?: number
          eng_page_views_uniq?: number
          eng_taps?: number
          source_info?: string
          source_type: string
          updated_at?: string
        }
        Update: {
          day?: string
          dl_first_time?: number
          dl_redownload?: number
          dl_update?: number
          eng_impressions?: number
          eng_impressions_uniq?: number
          eng_page_views?: number
          eng_page_views_uniq?: number
          eng_taps?: number
          source_info?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_store_sync_instances: {
        Row: {
          data_days: string[]
          instance_id: string
          processing_date: string
          report: string
          row_count: number
          synced_at: string
        }
        Insert: {
          data_days?: string[]
          instance_id: string
          processing_date: string
          report: string
          row_count?: number
          synced_at?: string
        }
        Update: {
          data_days?: string[]
          instance_id?: string
          processing_date?: string
          report?: string
          row_count?: number
          synced_at?: string
        }
        Relationships: []
      }
      daily_activity: {
        Row: {
          app_version: string | null
          created_at: string
          day: string
          device_id: string | null
          household_id: string
          id: string
          origin: string
          owner_id: string | null
          platform: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          day: string
          device_id?: string | null
          household_id: string
          id?: string
          origin?: string
          owner_id?: string | null
          platform?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          day?: string
          device_id?: string | null
          household_id?: string
          id?: string
          origin?: string
          owner_id?: string | null
          platform?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_activity_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "device_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_activity_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_activity_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      device_sessions: {
        Row: {
          created_at: string
          device_name: string
          household_id: string
          id: string
          is_revoked: boolean
          last_seen_at: string
          owner_id: string | null
          platform: string
        }
        Insert: {
          created_at?: string
          device_name: string
          household_id: string
          id?: string
          is_revoked?: boolean
          last_seen_at?: string
          owner_id?: string | null
          platform?: string
        }
        Update: {
          created_at?: string
          device_name?: string
          household_id?: string
          id?: string
          is_revoked?: boolean
          last_seen_at?: string
          owner_id?: string | null
          platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_sessions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_sessions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      digests_sent: {
        Row: {
          sent_at: string
          sent_to: string
          week: string
        }
        Insert: {
          sent_at?: string
          sent_to: string
          week: string
        }
        Update: {
          sent_at?: string
          sent_to?: string
          week?: string
        }
        Relationships: []
      }
      households: {
        Row: {
          created_at: string
          guest_join_code: string
          id: string
          is_demo: boolean
          join_code: string
          name: string
          origin: string
        }
        Insert: {
          created_at?: string
          guest_join_code: string
          id?: string
          is_demo?: boolean
          join_code: string
          name: string
          origin?: string
        }
        Update: {
          created_at?: string
          guest_join_code?: string
          id?: string
          is_demo?: boolean
          join_code?: string
          name?: string
          origin?: string
        }
        Relationships: []
      }
      login_tokens: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          owner_id: string
          purpose: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          owner_id: string
          purpose: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          owner_id?: string
          purpose?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "login_tokens_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          household_id: string
          id: string
          owner_id: string
          role: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          owner_id: string
          role?: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          owner_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          alias: string | null
          created_at: string
          demo_trial_started_at: string | null
          id: string
          name: string | null
          recovery_email: string | null
        }
        Insert: {
          alias?: string | null
          created_at?: string
          demo_trial_started_at?: string | null
          id?: string
          name?: string | null
          recovery_email?: string | null
        }
        Update: {
          alias?: string | null
          created_at?: string
          demo_trial_started_at?: string | null
          id?: string
          name?: string | null
          recovery_email?: string | null
        }
        Relationships: []
      }
      recipe_tags: {
        Row: {
          recipe_id: string
          tag_id: string
        }
        Insert: {
          recipe_id: string
          tag_id: string
        }
        Update: {
          recipe_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_tags_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_tags_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "v3_recipe_people"
            referencedColumns: ["recipe_id"]
          },
          {
            foreignKeyName: "recipe_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_views_daily: {
        Row: {
          day: string
          owner_id: string
          views: number
        }
        Insert: {
          day: string
          owner_id: string
          views?: number
        }
        Update: {
          day?: string
          owner_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_views_daily_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          complexity: string | null
          cook_time: string | null
          cost: string | null
          created_at: string | null
          created_by_device_id: string | null
          enrichment_status: string
          generated_image_url: string | null
          household_id: string
          id: string
          image_prompt: string | null
          image_status: string
          ingredients: string | null
          is_seed: boolean
          last_activity_at: string
          last_moved_at: string | null
          notes: string | null
          photo_url: string | null
          prep_time: string | null
          seasons: string[] | null
          servings: number | null
          share_token: string | null
          share_token_created_at: string | null
          source: string
          steps: string | null
          title: string
          updated_at: string | null
          user_id: string | null
          view_count: number
        }
        Insert: {
          complexity?: string | null
          cook_time?: string | null
          cost?: string | null
          created_at?: string | null
          created_by_device_id?: string | null
          enrichment_status?: string
          generated_image_url?: string | null
          household_id: string
          id?: string
          image_prompt?: string | null
          image_status?: string
          ingredients?: string | null
          is_seed?: boolean
          last_activity_at?: string
          last_moved_at?: string | null
          notes?: string | null
          photo_url?: string | null
          prep_time?: string | null
          seasons?: string[] | null
          servings?: number | null
          share_token?: string | null
          share_token_created_at?: string | null
          source?: string
          steps?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
          view_count?: number
        }
        Update: {
          complexity?: string | null
          cook_time?: string | null
          cost?: string | null
          created_at?: string | null
          created_by_device_id?: string | null
          enrichment_status?: string
          generated_image_url?: string | null
          household_id?: string
          id?: string
          image_prompt?: string | null
          image_status?: string
          ingredients?: string | null
          is_seed?: boolean
          last_activity_at?: string
          last_moved_at?: string | null
          notes?: string | null
          photo_url?: string | null
          prep_time?: string | null
          seasons?: string[] | null
          servings?: number | null
          share_token?: string | null
          share_token_created_at?: string | null
          source?: string
          steps?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipes_created_by_device_id_fkey"
            columns: ["created_by_device_id"]
            isOneToOne: false
            referencedRelation: "device_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      stats_daily: {
        Row: {
          day: string
          demo_active_devices: number
          demo_ai_calls: number
          demo_frozen_hits: number
          demo_recipes_added: number
          demo_trials: number
          demo_trials_android: number
          demo_trials_ios: number
          demo_trials_web: number
          merge_tokens_sent: number
          merge_tokens_used: number
          recovery_tokens_sent: number
          recovery_tokens_used: number
          tokens_burned: number
          updated_at: string
        }
        Insert: {
          day: string
          demo_active_devices?: number
          demo_ai_calls?: number
          demo_frozen_hits?: number
          demo_recipes_added?: number
          demo_trials?: number
          demo_trials_android?: number
          demo_trials_ios?: number
          demo_trials_web?: number
          merge_tokens_sent?: number
          merge_tokens_used?: number
          recovery_tokens_sent?: number
          recovery_tokens_used?: number
          tokens_burned?: number
          updated_at?: string
        }
        Update: {
          day?: string
          demo_active_devices?: number
          demo_ai_calls?: number
          demo_frozen_hits?: number
          demo_recipes_added?: number
          demo_trials?: number
          demo_trials_android?: number
          demo_trials_ios?: number
          demo_trials_web?: number
          merge_tokens_sent?: number
          merge_tokens_used?: number
          recovery_tokens_sent?: number
          recovery_tokens_used?: number
          tokens_burned?: number
          updated_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          household_id: string | null
          id: string
          is_predefined: boolean
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          household_id?: string | null
          id?: string
          is_predefined?: boolean
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          household_id?: string | null
          id?: string
          is_predefined?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v3_recipe_people: {
        Row: {
          created_at: string | null
          household_id: string | null
          owner_id: string | null
          recipe_id: string | null
          share_token: string | null
          share_token_created_at: string | null
          source: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      analytics_acquisition_daily: {
        Args: { p_days?: number }
        Returns: {
          day: string
          first_carnets: number
          new_carnets: number
          new_owners: number
        }[]
      }
      analytics_activation: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          activated: number
          cohort_week: string
          owners: number
          rate: number
        }[]
      }
      analytics_active_daily: {
        Args: {
          p_days?: number
          p_household_ids?: string[]
          p_platform?: string
        }
        Returns: {
          day: string
          mau: number
          mau_devices: number
          stickiness: number
          wau: number
        }[]
      }
      analytics_active_daily_cohorts: {
        Args: {
          p_days?: number
          p_household_ids?: string[]
          p_platform?: string
        }
        Returns: {
          cohort: string
          day: string
          mau: number
        }[]
      }
      analytics_adoption_since: {
        Args: { p_carnets_since: string; p_owners_since: string }
        Returns: {
          carnets_since: number
          carnets_with_guest_since: number
          multi_carnet_since: number
          named_since: number
          owners_since: number
          with_email_since: number
        }[]
      }
      analytics_ai_cost_daily: {
        Args: { p_days?: number }
        Returns: {
          call_type: string
          calls: number
          cost_usd: number
          day: string
        }[]
      }
      analytics_ai_cost_demo_daily: {
        Args: { p_days?: number }
        Returns: {
          calls: number
          cost_usd: number
          day: string
        }[]
      }
      analytics_ai_cost_summary: {
        Args: { p_days?: number }
        Returns: {
          calls_total: number
          cost_per_image: number
          cost_per_recipe: number
          image_usd: number
          images_count: number
          import_crawler_usd: number
          import_instagram_usd: number
          import_url_usd: number
          import_voice_usd: number
          metadata_usd: number
          ocr_usd: number
          recipe_linked_usd: number
          recipes_costed: number
          total_usd: number
        }[]
      }
      analytics_carnet_people_dist: {
        Args: never
        Returns: {
          bucket: string
          carnets: number
          guests: number
          members: number
        }[]
      }
      analytics_carnets_per_owner: {
        Args: never
        Returns: {
          bucket: string
          owners: number
        }[]
      }
      analytics_cumulative_parc_daily: {
        Args: { p_days?: number }
        Returns: {
          carnets: number
          day: string
          owners: number
        }[]
      }
      analytics_demo_funnel: {
        Args: { p_days?: number }
        Returns: {
          conversions: number
          day: string
          trials: number
        }[]
      }
      analytics_demo_summary: {
        Args: { p_days?: number }
        Returns: {
          activated_7d: number
          conversion_pct: number
          conversions: number
          demo_ai_calls: number
          demo_recipes: number
          frozen_hits: number
          median_hours_to_convert: number
          trials: number
        }[]
      }
      analytics_demo_time_to_convert: {
        Args: never
        Returns: {
          bin: string
          owners: number
        }[]
      }
      analytics_depth: {
        Args: { p_days?: number; p_household_ids?: string[] }
        Returns: number
      }
      analytics_devices_per_owner: {
        Args: never
        Returns: {
          bucket: string
          owners: number
        }[]
      }
      analytics_enrichment: {
        Args: { p_household_ids?: string[] }
        Returns: {
          kind: string
          recipes: number
          status: string
        }[]
      }
      analytics_guest_adoption: {
        Args: never
        Returns: {
          carnets_total: number
          carnets_with_guest: number
          guests_total: number
        }[]
      }
      analytics_kpis: {
        Args: { p_household_ids?: string[] }
        Returns: {
          dormant_carnets: number
          owners_total: number
          recipes_total: number
        }[]
      }
      analytics_login_frequency: {
        Args: {
          p_days?: number
          p_household_ids?: string[]
          p_platform?: string
        }
        Returns: {
          bin: string
          owners: number
        }[]
      }
      analytics_owner_days: {
        Args: {
          p_days: number
          p_household_ids?: string[]
          p_platform?: string
        }
        Returns: {
          day: string
          owner_id: string
        }[]
      }
      analytics_recipes_by_platform: {
        Args: { p_from?: string; p_household_ids?: string[]; p_to?: string }
        Returns: {
          platform: string
          recipes: number
        }[]
      }
      analytics_recipes_created_daily: {
        Args: {
          p_from?: string
          p_household_ids?: string[]
          p_platform?: string
          p_source?: string
          p_to?: string
        }
        Returns: {
          day: string
          recipes: number
        }[]
      }
      analytics_recipes_per_household_dist: {
        Args: { p_household_ids?: string[] }
        Returns: {
          bucket: string
          households: number
        }[]
      }
      analytics_recovery: {
        Args: { p_days?: number }
        Returns: {
          merge_tokens_sent: number
          merge_tokens_used: number
          owners_named: number
          owners_total: number
          owners_with_email: number
          recovery_tokens_sent: number
          recovery_tokens_used: number
          tokens_burned: number
          tokens_pending: number
        }[]
      }
      analytics_retention_cohorts: {
        Args: { p_cohorts?: number; p_max_week?: number }
        Returns: {
          active: number
          cohort: string
          owners: number
          pct: number
          week_offset: number
        }[]
      }
      analytics_sharing: {
        Args: { p_days?: number }
        Returns: {
          copies: number
          links_total: number
          moves: number
        }[]
      }
      analytics_source_mix: {
        Args: {
          p_from?: string
          p_household_ids?: string[]
          p_platform?: string
          p_to?: string
        }
        Returns: {
          recipes: number
          source: string
        }[]
      }
      analytics_source_mix_monthly: {
        Args: { p_household_ids?: string[]; p_months?: number }
        Returns: {
          month: string
          recipes: number
          source: string
        }[]
      }
      analytics_top_households: {
        Args: { p_limit?: number }
        Returns: {
          household_id: string
          last_active: string
          name: string
          recipes: number
        }[]
      }
      analytics_v3_carnets: {
        Args: never
        Returns: {
          created_at: string
          guests: number
          id: string
          last_active_day: string
          members: number
          name: string
          origin: string
          recipes: number
          shared_links: number
        }[]
      }
      analytics_v3_daily: {
        Args: { p_days?: number }
        Returns: {
          active_people: number
          day: string
          new_people: number
          recipes: number
          trials: number
          trials_android: number
          trials_ios: number
          trials_web: number
        }[]
      }
      analytics_v3_demo: {
        Args: { p_days?: number }
        Returns: {
          conversions: number
          platform: string
          trials: number
        }[]
      }
      analytics_v3_health: {
        Args: { p_days?: number }
        Returns: {
          ai_calls: number
          ai_cost_demo_usd: number
          ai_cost_usd: number
          demo_ai_calls: number
          demo_frozen_hits: number
          demo_recipes: number
          demo_seed_en: number
          demo_seed_fr: number
          demo_trials: number
          last_app_store_sync: string
          last_rollup: string
          merge_used: number
          recipes_created: number
          recipes_enriched: number
          recipes_failed: number
          recipes_pending_stale: number
          recovery_sent: number
          recovery_used: number
          tokens_burned: number
        }[]
      }
      analytics_v3_people: {
        Args: never
        Returns: {
          active_28d: boolean
          active_days_28d: number
          active_m1: boolean
          active_m2: boolean
          active_m3: boolean
          active_prev28: boolean
          carnets: number
          channel: string
          created_at: string
          display_name: string
          first_method: string
          first_platform: string
          first_recipe_at: string
          guest_of: number
          has_email: boolean
          id: string
          last_active_day: string
          named: boolean
          recipes_28d: number
          recipes_7d: number
          recipes_total: number
          returned_7d: boolean
          via_demo: boolean
          views_28d: number
          views_total: number
        }[]
      }
      analytics_v3_sharing: {
        Args: { p_days?: number }
        Returns: {
          copies: number
          links: number
          links_dated_estimate: boolean
        }[]
      }
      analytics_v3_weekly_active: {
        Args: { p_weeks?: number }
        Returns: {
          active: number
          cohort_month: string
          engaged: number
          week_end: string
        }[]
      }
      analytics_v3_weekly_recipes: {
        Args: { p_weeks?: number }
        Returns: {
          recipes: number
          source: string
          week_start: string
        }[]
      }
      app_store_daily_replace: {
        Args: { p_day: string; p_report: string; p_rows: Json }
        Returns: undefined
      }
      carnet_activity: {
        Args: never
        Returns: {
          household_id: string
          last_active: string
        }[]
      }
      demo_stats_rollup:
        | {
            Args: { p_days?: number; p_demo_household: string }
            Returns: undefined
          }
        | {
            Args: { p_days?: number; p_demo_households: string[] }
            Returns: undefined
          }
      merge_owners: {
        Args: {
          p_adopt_household_ids: string[]
          p_name: string
          p_source_id: string
          p_target_id: string
          p_upgrade_household_ids: string[]
        }
        Returns: undefined
      }
      owner_in_carnets: {
        Args: { p_household_ids: string[]; p_owner: string }
        Returns: boolean
      }
      owner_is_real: { Args: { p_owner: string }; Returns: boolean }
      purge_recipe_views: { Args: { p_keep_days?: number }; Returns: number }
      stats_daily_increment: { Args: { p_field: string }; Returns: undefined }
      track_recipe_view: { Args: { p_owner: string }; Returns: undefined }
      verify_login_code: {
        Args: { p_code_hash: string; p_owner_id: string; p_purpose: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

