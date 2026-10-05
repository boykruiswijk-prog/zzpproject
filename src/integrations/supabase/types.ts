export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      _audit_fixes: {
        Row: {
          n: number
          new: string
          old: string
          slug: string
          toegepast: number | null
        }
        Insert: {
          n: number
          new: string
          old: string
          slug: string
          toegepast?: number | null
        }
        Update: {
          n?: number
          new?: string
          old?: string
          slug?: string
          toegepast?: number | null
        }
        Relationships: []
      }
      aanvraag_concepten: {
        Row: {
          achternaam: string | null
          attributie: Json | null
          bedrijfsnaam: string | null
          created_at: string
          email: string | null
          geanonimiseerd_op: string | null
          id: string
          is_test: boolean
          kvk: string | null
          laatst_actief_op: string
          lead_id: string | null
          opgevolgd_door: string | null
          opgevolgd_op: string | null
          opvolg_notitie: string | null
          pagina: string | null
          pakket: string | null
          sector: string | null
          stap: number
          status: string
          telefoon: string | null
          voornaam: string | null
        }
        Insert: {
          achternaam?: string | null
          attributie?: Json | null
          bedrijfsnaam?: string | null
          created_at?: string
          email?: string | null
          geanonimiseerd_op?: string | null
          id: string
          is_test?: boolean
          kvk?: string | null
          laatst_actief_op?: string
          lead_id?: string | null
          opgevolgd_door?: string | null
          opgevolgd_op?: string | null
          opvolg_notitie?: string | null
          pagina?: string | null
          pakket?: string | null
          sector?: string | null
          stap?: number
          status?: string
          telefoon?: string | null
          voornaam?: string | null
        }
        Update: {
          achternaam?: string | null
          attributie?: Json | null
          bedrijfsnaam?: string | null
          created_at?: string
          email?: string | null
          geanonimiseerd_op?: string | null
          id?: string
          is_test?: boolean
          kvk?: string | null
          laatst_actief_op?: string
          lead_id?: string | null
          opgevolgd_door?: string | null
          opgevolgd_op?: string | null
          opvolg_notitie?: string | null
          pagina?: string | null
          pakket?: string | null
          sector?: string | null
          stap?: number
          status?: string
          telefoon?: string | null
          voornaam?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aanvraag_concepten_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "kpi_actieve_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aanvraag_concepten_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      activiteiten_log: {
        Row: {
          aangemaakt_op: string
          actie_type: string
          id: string
          is_test: boolean
          klant_email: string | null
          lead_id: string | null
          omschrijving: string
          uitgevoerd_door: string | null
          uitgevoerd_door_naam: string | null
        }
        Insert: {
          aangemaakt_op?: string
          actie_type: string
          id?: string
          is_test?: boolean
          klant_email?: string | null
          lead_id?: string | null
          omschrijving: string
          uitgevoerd_door?: string | null
          uitgevoerd_door_naam?: string | null
        }
        Update: {
          aangemaakt_op?: string
          actie_type?: string
          id?: string
          is_test?: boolean
          klant_email?: string | null
          lead_id?: string | null
          omschrijving?: string
          uitgevoerd_door?: string | null
          uitgevoerd_door_naam?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activiteiten_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "kpi_actieve_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activiteiten_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      article_categories: {
        Row: {
          created_at: string
          hub_slug: string | null
          label: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          hub_slug?: string | null
          label: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          hub_slug?: string | null
          label?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      articles: {
        Row: {
          author_id: string | null
          author_name: string | null
          category: string
          content: string | null
          content_reviewed_at: string | null
          created_at: string
          excerpt: string | null
          generated_by_ai: boolean
          id: string
          image_url: string | null
          is_published: boolean | null
          published_at: string | null
          read_time: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          source_name: string | null
          source_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          category?: string
          content?: string | null
          content_reviewed_at?: string | null
          created_at?: string
          excerpt?: string | null
          generated_by_ai?: boolean
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          published_at?: string | null
          read_time?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          source_name?: string | null
          source_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          category?: string
          content?: string | null
          content_reviewed_at?: string | null
          created_at?: string
          excerpt?: string | null
          generated_by_ai?: boolean
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          published_at?: string | null
          read_time?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          source_name?: string | null
          source_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      articles_backup_20261001_audit: {
        Row: {
          author_id: string | null
          author_name: string | null
          category: string | null
          content: string | null
          content_reviewed_at: string | null
          created_at: string | null
          excerpt: string | null
          generated_by_ai: boolean | null
          id: string | null
          image_url: string | null
          is_published: boolean | null
          published_at: string | null
          read_time: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string | null
          source_name: string | null
          source_url: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          category?: string | null
          content?: string | null
          content_reviewed_at?: string | null
          created_at?: string | null
          excerpt?: string | null
          generated_by_ai?: boolean | null
          id?: string | null
          image_url?: string | null
          is_published?: boolean | null
          published_at?: string | null
          read_time?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string | null
          source_name?: string | null
          source_url?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          category?: string | null
          content?: string | null
          content_reviewed_at?: string | null
          created_at?: string | null
          excerpt?: string | null
          generated_by_ai?: boolean | null
          id?: string | null
          image_url?: string | null
          is_published?: boolean | null
          published_at?: string | null
          read_time?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string | null
          source_name?: string | null
          source_url?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bav_aanmeldingen: {
        Row: {
          aangemeld_op: string
          achternaam: string
          bedrijfsnaam: string
          beroep: string | null
          betaalwijze: string
          bijgewerkt_op: string
          email: string
          exact_abonnement_id: string | null
          exact_account_id: string | null
          exact_fout: string | null
          exact_foutmelding: string | null
          exact_gesynchroniseerd_op: string | null
          exact_relatie_id: string | null
          exact_status: string
          exact_subscription_id: string | null
          exact_sync_op: string | null
          iban: string | null
          id: string
          ingangsdatum: string
          is_test: boolean
          jaarpremie: number | null
          kvk_nummer: string | null
          lead_id: string | null
          maandpremie: number | null
          pakket: string
          pakket_naam: string
          premiebedrag: number
          rekeninghouder: string | null
          sector: string | null
          status: string
          telefoon: string | null
          voornaam: string
        }
        Insert: {
          aangemeld_op?: string
          achternaam: string
          bedrijfsnaam: string
          beroep?: string | null
          betaalwijze: string
          bijgewerkt_op?: string
          email: string
          exact_abonnement_id?: string | null
          exact_account_id?: string | null
          exact_fout?: string | null
          exact_foutmelding?: string | null
          exact_gesynchroniseerd_op?: string | null
          exact_relatie_id?: string | null
          exact_status?: string
          exact_subscription_id?: string | null
          exact_sync_op?: string | null
          iban?: string | null
          id?: string
          ingangsdatum: string
          is_test?: boolean
          jaarpremie?: number | null
          kvk_nummer?: string | null
          lead_id?: string | null
          maandpremie?: number | null
          pakket: string
          pakket_naam: string
          premiebedrag: number
          rekeninghouder?: string | null
          sector?: string | null
          status?: string
          telefoon?: string | null
          voornaam: string
        }
        Update: {
          aangemeld_op?: string
          achternaam?: string
          bedrijfsnaam?: string
          beroep?: string | null
          betaalwijze?: string
          bijgewerkt_op?: string
          email?: string
          exact_abonnement_id?: string | null
          exact_account_id?: string | null
          exact_fout?: string | null
          exact_foutmelding?: string | null
          exact_gesynchroniseerd_op?: string | null
          exact_relatie_id?: string | null
          exact_status?: string
          exact_subscription_id?: string | null
          exact_sync_op?: string | null
          iban?: string | null
          id?: string
          ingangsdatum?: string
          is_test?: boolean
          jaarpremie?: number | null
          kvk_nummer?: string | null
          lead_id?: string | null
          maandpremie?: number | null
          pakket?: string
          pakket_naam?: string
          premiebedrag?: number
          rekeninghouder?: string | null
          sector?: string | null
          status?: string
          telefoon?: string | null
          voornaam?: string
        }
        Relationships: [
          {
            foreignKeyName: "bav_aanmeldingen_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "kpi_actieve_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bav_aanmeldingen_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          acties: Json | null
          created_at: string
          feedback: number | null
          id: string
          rol: string
          sessie_id: string
          tekst: string
        }
        Insert: {
          acties?: Json | null
          created_at?: string
          feedback?: number | null
          id?: string
          rol: string
          sessie_id: string
          tekst: string
        }
        Update: {
          acties?: Json | null
          created_at?: string
          feedback?: number | null
          id?: string
          rol?: string
          sessie_id?: string
          tekst?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_sessie_id_fkey"
            columns: ["sessie_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rate_limit: {
        Row: {
          created_at: string
          id: number
          ip_hash: string
        }
        Insert: {
          created_at?: string
          id?: never
          ip_hash: string
        }
        Update: {
          created_at?: string
          id?: never
          ip_hash?: string
        }
        Relationships: []
      }
      chat_sessions: {
        Row: {
          aantal_berichten: number
          created_at: string
          id: string
          ip_hash: string
          is_test: boolean
          laatste_bericht_op: string
          lead_id: string | null
          startpagina: string | null
          taal: string
          ua_hash: string | null
        }
        Insert: {
          aantal_berichten?: number
          created_at?: string
          id?: string
          ip_hash: string
          is_test?: boolean
          laatste_bericht_op?: string
          lead_id?: string | null
          startpagina?: string | null
          taal?: string
          ua_hash?: string | null
        }
        Update: {
          aantal_berichten?: number
          created_at?: string
          id?: string
          ip_hash?: string
          is_test?: boolean
          laatste_bericht_op?: string
          lead_id?: string | null
          startpagina?: string | null
          taal?: string
          ua_hash?: string | null
        }
        Relationships: []
      }
      collective_newsletter: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      collective_signups: {
        Row: {
          created_at: string
          email: string
          huidige_leverancier: string | null
          id: string
          interesse_gebieden: string[] | null
          naam: string
          pilot_slug: string
          postcode: string | null
          telefoon: string | null
          type: string | null
        }
        Insert: {
          created_at?: string
          email: string
          huidige_leverancier?: string | null
          id?: string
          interesse_gebieden?: string[] | null
          naam: string
          pilot_slug: string
          postcode?: string | null
          telefoon?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          huidige_leverancier?: string | null
          id?: string
          interesse_gebieden?: string[] | null
          naam?: string
          pilot_slug?: string
          postcode?: string | null
          telefoon?: string | null
          type?: string | null
        }
        Relationships: []
      }
      collective_suggestions: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_test: boolean
          naam: string | null
          status: string
          suggestie: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_test?: boolean
          naam?: string | null
          status?: string
          suggestie: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_test?: boolean
          naam?: string | null
          status?: string
          suggestie?: string
        }
        Relationships: []
      }
      crm_identiteit_beslissingen: {
        Row: {
          bekende_namen: string[]
          beslissing: string
          beslist_door: string | null
          beslist_op: string
          created_at: string
          genormaliseerd_email: string
          id: string
          updated_at: string
        }
        Insert: {
          bekende_namen?: string[]
          beslissing: string
          beslist_door?: string | null
          beslist_op?: string
          created_at?: string
          genormaliseerd_email: string
          id?: string
          updated_at?: string
        }
        Update: {
          bekende_namen?: string[]
          beslissing?: string
          beslist_door?: string | null
          beslist_op?: string
          created_at?: string
          genormaliseerd_email?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      dba_batches: {
        Row: {
          certified_count: number
          created_at: string
          created_by: string
          id: string
          name: string
          processed_count: number
          status: string
          total_candidates: number
          updated_at: string
          zip_file_url: string | null
          zip_filename: string | null
        }
        Insert: {
          certified_count?: number
          created_at?: string
          created_by: string
          id?: string
          name?: string
          processed_count?: number
          status?: string
          total_candidates?: number
          updated_at?: string
          zip_file_url?: string | null
          zip_filename?: string | null
        }
        Update: {
          certified_count?: number
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          processed_count?: number
          status?: string
          total_candidates?: number
          updated_at?: string
          zip_file_url?: string | null
          zip_filename?: string | null
        }
        Relationships: []
      }
      dba_check_fields: {
        Row: {
          created_at: string
          description: string | null
          field_name: string
          id: string
          is_active: boolean
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          field_name: string
          id?: string
          is_active?: boolean
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          field_name?: string
          id?: string
          is_active?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      dba_checks: {
        Row: {
          batch_id: string | null
          candidate_email: string | null
          candidate_phone: string | null
          certificate_number: string | null
          certificate_pdf_url: string | null
          certified_at: string | null
          certified_by: string | null
          client_name: string
          created_at: string
          document_checklist: Json | null
          eigen_materiaal_werkwijze: boolean | null
          einddatum: string | null
          eindopdrachtgever: string | null
          extracted_text: string | null
          field_results: Json | null
          functie: string | null
          id: string
          invoiced_at: string | null
          is_test: boolean
          kvk_check_result: Json | null
          kvk_file_url: string | null
          kvk_filename: string | null
          kvk_text: string | null
          lead_id: string | null
          missing_fields: Json | null
          opdrachtgever: string | null
          optie_verlenging: string | null
          original_filename: string | null
          polis_file_url: string | null
          polis_filename: string | null
          polis_text: string | null
          project_description: string | null
          project_name: string | null
          rechtsvorm: string | null
          rewritten_description: string | null
          specifieke_vaardigheden: string | null
          startdatum: string | null
          status: string
          suggestions: Json | null
          treedt_zelfstandig_op: boolean | null
          updated_at: string
          uploaded_file_url: string | null
          uren_per_week: string | null
          uurtarief: string | null
          verification_token: string | null
        }
        Insert: {
          batch_id?: string | null
          candidate_email?: string | null
          candidate_phone?: string | null
          certificate_number?: string | null
          certificate_pdf_url?: string | null
          certified_at?: string | null
          certified_by?: string | null
          client_name: string
          created_at?: string
          document_checklist?: Json | null
          eigen_materiaal_werkwijze?: boolean | null
          einddatum?: string | null
          eindopdrachtgever?: string | null
          extracted_text?: string | null
          field_results?: Json | null
          functie?: string | null
          id?: string
          invoiced_at?: string | null
          is_test?: boolean
          kvk_check_result?: Json | null
          kvk_file_url?: string | null
          kvk_filename?: string | null
          kvk_text?: string | null
          lead_id?: string | null
          missing_fields?: Json | null
          opdrachtgever?: string | null
          optie_verlenging?: string | null
          original_filename?: string | null
          polis_file_url?: string | null
          polis_filename?: string | null
          polis_text?: string | null
          project_description?: string | null
          project_name?: string | null
          rechtsvorm?: string | null
          rewritten_description?: string | null
          specifieke_vaardigheden?: string | null
          startdatum?: string | null
          status?: string
          suggestions?: Json | null
          treedt_zelfstandig_op?: boolean | null
          updated_at?: string
          uploaded_file_url?: string | null
          uren_per_week?: string | null
          uurtarief?: string | null
          verification_token?: string | null
        }
        Update: {
          batch_id?: string | null
          candidate_email?: string | null
          candidate_phone?: string | null
          certificate_number?: string | null
          certificate_pdf_url?: string | null
          certified_at?: string | null
          certified_by?: string | null
          client_name?: string
          created_at?: string
          document_checklist?: Json | null
          eigen_materiaal_werkwijze?: boolean | null
          einddatum?: string | null
          eindopdrachtgever?: string | null
          extracted_text?: string | null
          field_results?: Json | null
          functie?: string | null
          id?: string
          invoiced_at?: string | null
          is_test?: boolean
          kvk_check_result?: Json | null
          kvk_file_url?: string | null
          kvk_filename?: string | null
          kvk_text?: string | null
          lead_id?: string | null
          missing_fields?: Json | null
          opdrachtgever?: string | null
          optie_verlenging?: string | null
          original_filename?: string | null
          polis_file_url?: string | null
          polis_filename?: string | null
          polis_text?: string | null
          project_description?: string | null
          project_name?: string | null
          rechtsvorm?: string | null
          rewritten_description?: string | null
          specifieke_vaardigheden?: string | null
          startdatum?: string | null
          status?: string
          suggestions?: Json | null
          treedt_zelfstandig_op?: boolean | null
          updated_at?: string
          uploaded_file_url?: string | null
          uren_per_week?: string | null
          uurtarief?: string | null
          verification_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dba_checks_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "dba_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dba_checks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "kpi_actieve_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dba_checks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      exact_abonnementen_spiegel: {
        Row: {
          block_entry: boolean | null
          cancellation_date: string | null
          classification: string | null
          end_date: string | null
          entry_id: string
          invoice_day: number | null
          invoice_to: string | null
          invoiced_to: string | null
          invoiced_to_bron: string | null
          invoicing_start_date: string | null
          nummer: string | null
          omschrijving: string | null
          opgehaald_op: string
          ordered_by: string | null
          payment_condition: string | null
          raw: Json | null
          start_date: string | null
          subscription_type: string | null
          sync_run_id: string | null
        }
        Insert: {
          block_entry?: boolean | null
          cancellation_date?: string | null
          classification?: string | null
          end_date?: string | null
          entry_id: string
          invoice_day?: number | null
          invoice_to?: string | null
          invoiced_to?: string | null
          invoiced_to_bron?: string | null
          invoicing_start_date?: string | null
          nummer?: string | null
          omschrijving?: string | null
          opgehaald_op?: string
          ordered_by?: string | null
          payment_condition?: string | null
          raw?: Json | null
          start_date?: string | null
          subscription_type?: string | null
          sync_run_id?: string | null
        }
        Update: {
          block_entry?: boolean | null
          cancellation_date?: string | null
          classification?: string | null
          end_date?: string | null
          entry_id?: string
          invoice_day?: number | null
          invoice_to?: string | null
          invoiced_to?: string | null
          invoiced_to_bron?: string | null
          invoicing_start_date?: string | null
          nummer?: string | null
          omschrijving?: string | null
          opgehaald_op?: string
          ordered_by?: string | null
          payment_condition?: string | null
          raw?: Json | null
          start_date?: string | null
          subscription_type?: string | null
          sync_run_id?: string | null
        }
        Relationships: []
      }
      exact_abonnementsregels_spiegel: {
        Row: {
          amount_dc: number | null
          entry_id: string | null
          from_date: string | null
          id: string
          item: string | null
          item_code: string | null
          item_omschrijving: string | null
          line_type: string | null
          net_price: number | null
          opgehaald_op: string
          quantity: number | null
          raw: Json | null
          sync_run_id: string | null
          to_date: string | null
          unit_code: string | null
          unit_price: number | null
          vat_code: string | null
        }
        Insert: {
          amount_dc?: number | null
          entry_id?: string | null
          from_date?: string | null
          id: string
          item?: string | null
          item_code?: string | null
          item_omschrijving?: string | null
          line_type?: string | null
          net_price?: number | null
          opgehaald_op?: string
          quantity?: number | null
          raw?: Json | null
          sync_run_id?: string | null
          to_date?: string | null
          unit_code?: string | null
          unit_price?: number | null
          vat_code?: string | null
        }
        Update: {
          amount_dc?: number | null
          entry_id?: string | null
          from_date?: string | null
          id?: string
          item?: string | null
          item_code?: string | null
          item_omschrijving?: string | null
          line_type?: string | null
          net_price?: number | null
          opgehaald_op?: string
          quantity?: number | null
          raw?: Json | null
          sync_run_id?: string | null
          to_date?: string | null
          unit_code?: string | null
          unit_price?: number | null
          vat_code?: string | null
        }
        Relationships: []
      }
      exact_abonnementstypes_spiegel: {
        Row: {
          code: string | null
          id: string
          omschrijving: string | null
          opgehaald_op: string
          raw: Json | null
          sync_run_id: string | null
        }
        Insert: {
          code?: string | null
          id: string
          omschrijving?: string | null
          opgehaald_op?: string
          raw?: Json | null
          sync_run_id?: string | null
        }
        Update: {
          code?: string | null
          id?: string
          omschrijving?: string | null
          opgehaald_op?: string
          raw?: Json | null
          sync_run_id?: string | null
        }
        Relationships: []
      }
      exact_accounts_spiegel: {
        Row: {
          blocked: boolean | null
          code: string | null
          code_norm: string | null
          id: string
          is_sales: boolean | null
          kvk: string | null
          naam: string | null
          opgehaald_op: string
          raw: Json | null
          status: string | null
          sync_run_id: string | null
        }
        Insert: {
          blocked?: boolean | null
          code?: string | null
          code_norm?: string | null
          id: string
          is_sales?: boolean | null
          kvk?: string | null
          naam?: string | null
          opgehaald_op?: string
          raw?: Json | null
          status?: string | null
          sync_run_id?: string | null
        }
        Update: {
          blocked?: boolean | null
          code?: string | null
          code_norm?: string | null
          id?: string
          is_sales?: boolean | null
          kvk?: string | null
          naam?: string | null
          opgehaald_op?: string
          raw?: Json | null
          status?: string | null
          sync_run_id?: string | null
        }
        Relationships: []
      }
      exact_artikelen_spiegel: {
        Row: {
          code: string | null
          id: string
          omschrijving: string | null
          opgehaald_op: string
          sync_run_id: string | null
        }
        Insert: {
          code?: string | null
          id: string
          omschrijving?: string | null
          opgehaald_op?: string
          sync_run_id?: string | null
        }
        Update: {
          code?: string | null
          id?: string
          omschrijving?: string | null
          opgehaald_op?: string
          sync_run_id?: string | null
        }
        Relationships: []
      }
      exact_config: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          base_url: string | null
          client_id: string | null
          client_secret: string | null
          divisie_code: string | null
          exact_item_group_id: string | null
          exact_item_id_bav_avb: string | null
          gl_account_id_bav: string | null
          gl_account_id_bav_code: string | null
          gl_account_id_screening: string | null
          gl_account_id_screening_code: string | null
          gl_account_ids: Json
          gl_code_bav: string
          gl_code_screening: string | null
          id: string
          is_actief: boolean
          laatste_sync: string | null
          last_error: string | null
          last_sync_at: string | null
          redirect_uri: string | null
          refresh_lock_until: string | null
          refresh_token: string | null
          refresh_token_obtained_at: string | null
          token_expires_at: string | null
          updated_at: string
          vat_code_screening: string | null
          webhook_secret: string | null
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          base_url?: string | null
          client_id?: string | null
          client_secret?: string | null
          divisie_code?: string | null
          exact_item_group_id?: string | null
          exact_item_id_bav_avb?: string | null
          gl_account_id_bav?: string | null
          gl_account_id_bav_code?: string | null
          gl_account_id_screening?: string | null
          gl_account_id_screening_code?: string | null
          gl_account_ids?: Json
          gl_code_bav?: string
          gl_code_screening?: string | null
          id?: string
          is_actief?: boolean
          laatste_sync?: string | null
          last_error?: string | null
          last_sync_at?: string | null
          redirect_uri?: string | null
          refresh_lock_until?: string | null
          refresh_token?: string | null
          refresh_token_obtained_at?: string | null
          token_expires_at?: string | null
          updated_at?: string
          vat_code_screening?: string | null
          webhook_secret?: string | null
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          base_url?: string | null
          client_id?: string | null
          client_secret?: string | null
          divisie_code?: string | null
          exact_item_group_id?: string | null
          exact_item_id_bav_avb?: string | null
          gl_account_id_bav?: string | null
          gl_account_id_bav_code?: string | null
          gl_account_id_screening?: string | null
          gl_account_id_screening_code?: string | null
          gl_account_ids?: Json
          gl_code_bav?: string
          gl_code_screening?: string | null
          id?: string
          is_actief?: boolean
          laatste_sync?: string | null
          last_error?: string | null
          last_sync_at?: string | null
          redirect_uri?: string | null
          refresh_lock_until?: string | null
          refresh_token?: string | null
          refresh_token_obtained_at?: string | null
          token_expires_at?: string | null
          updated_at?: string
          vat_code_screening?: string | null
          webhook_secret?: string | null
        }
        Relationships: []
      }
      exact_email_import: {
        Row: {
          created_at: string | null
          email: string
          exact_account_id: string | null
          exact_email_voor: string | null
          exact_naam: string | null
          excel_rij: number | null
          id: string
          melding: string | null
          naam: string
          niet_gevonden_volgens_excel: boolean
          relatiecode: string
          status: string
          verwerkt_op: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          exact_account_id?: string | null
          exact_email_voor?: string | null
          exact_naam?: string | null
          excel_rij?: number | null
          id?: string
          melding?: string | null
          naam: string
          niet_gevonden_volgens_excel?: boolean
          relatiecode: string
          status?: string
          verwerkt_op?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          exact_account_id?: string | null
          exact_email_voor?: string | null
          exact_naam?: string | null
          excel_rij?: number | null
          id?: string
          melding?: string | null
          naam?: string
          niet_gevonden_volgens_excel?: boolean
          relatiecode?: string
          status?: string
          verwerkt_op?: string | null
        }
        Relationships: []
      }
      exact_mandaat_import: {
        Row: {
          bankrekening_actie: string | null
          bestaande_mandaten: Json | null
          created_at: string | null
          exact_account_id: string | null
          exact_bankrekening_id: string | null
          exact_mandaat_id: string | null
          exact_naam: string | null
          iban: string
          id: string
          kenmerk: string
          melding: string | null
          naam: string
          ondertekend_op: string
          relatiecode: string
          status: string
          verwerkt_op: string | null
        }
        Insert: {
          bankrekening_actie?: string | null
          bestaande_mandaten?: Json | null
          created_at?: string | null
          exact_account_id?: string | null
          exact_bankrekening_id?: string | null
          exact_mandaat_id?: string | null
          exact_naam?: string | null
          iban: string
          id?: string
          kenmerk: string
          melding?: string | null
          naam: string
          ondertekend_op: string
          relatiecode: string
          status?: string
          verwerkt_op?: string | null
        }
        Update: {
          bankrekening_actie?: string | null
          bestaande_mandaten?: Json | null
          created_at?: string | null
          exact_account_id?: string | null
          exact_bankrekening_id?: string | null
          exact_mandaat_id?: string | null
          exact_naam?: string | null
          iban?: string
          id?: string
          kenmerk?: string
          melding?: string | null
          naam?: string
          ondertekend_op?: string
          relatiecode?: string
          status?: string
          verwerkt_op?: string | null
        }
        Relationships: []
      }
      exact_oauth_state: {
        Row: {
          created_at: string
          expires_at: string
          state: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          state: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          state?: string
        }
        Relationships: []
      }
      exact_subscription_mapping: {
        Row: {
          aangemaakt_op: string
          actief: boolean
          exact_subscription_type_id: string
          id: string
          omschrijving: string | null
          pakket_naam: string
        }
        Insert: {
          aangemaakt_op?: string
          actief?: boolean
          exact_subscription_type_id: string
          id?: string
          omschrijving?: string | null
          pakket_naam: string
        }
        Update: {
          aangemaakt_op?: string
          actief?: boolean
          exact_subscription_type_id?: string
          id?: string
          omschrijving?: string | null
          pakket_naam?: string
        }
        Relationships: []
      }
      exact_sync_log: {
        Row: {
          admin_user_id: string | null
          created_at: string
          error_message: string | null
          exact_account_id: string | null
          http_status: number | null
          id: string
          lead_id: string | null
          payload: Json | null
          status: string | null
          trigger_type: string | null
        }
        Insert: {
          admin_user_id?: string | null
          created_at?: string
          error_message?: string | null
          exact_account_id?: string | null
          http_status?: number | null
          id?: string
          lead_id?: string | null
          payload?: Json | null
          status?: string | null
          trigger_type?: string | null
        }
        Update: {
          admin_user_id?: string | null
          created_at?: string
          error_message?: string | null
          exact_account_id?: string | null
          http_status?: number | null
          id?: string
          lead_id?: string | null
          payload?: Json | null
          status?: string | null
          trigger_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exact_sync_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "kpi_actieve_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exact_sync_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      exact_tokens: {
        Row: {
          access_token: string
          created_at: string
          division_code: string
          environment: string
          expires_at: string
          id: string
          refresh_token: string
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          division_code: string
          environment?: string
          expires_at: string
          id?: string
          refresh_token: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          division_code?: string
          environment?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          updated_at?: string
        }
        Relationships: []
      }
      facturatie_config: {
        Row: {
          bijgewerkt_door: string | null
          bijgewerkt_op: string
          facturatie_actief: boolean
          id: number
          opzeg_credits_actief: boolean
          sleutel_veld: string
          verwerk_termijn_werkdagen: number
        }
        Insert: {
          bijgewerkt_door?: string | null
          bijgewerkt_op?: string
          facturatie_actief?: boolean
          id?: number
          opzeg_credits_actief?: boolean
          sleutel_veld?: string
          verwerk_termijn_werkdagen?: number
        }
        Update: {
          bijgewerkt_door?: string | null
          bijgewerkt_op?: string
          facturatie_actief?: boolean
          id?: number
          opzeg_credits_actief?: boolean
          sleutel_veld?: string
          verwerk_termijn_werkdagen?: number
        }
        Relationships: []
      }
      factuur_artikel_mapping: {
        Row: {
          bevestigd: boolean
          bevestigd_door: string | null
          bevestigd_op: string | null
          blokkade_reden: string | null
          btw_code: string
          created_at: string
          exact_item_code: string | null
          exact_item_id: string | null
          gl_code: string | null
          id: string
          itemcode_patroon: string
          notitie: string | null
          product: string
          updated_at: string
        }
        Insert: {
          bevestigd?: boolean
          bevestigd_door?: string | null
          bevestigd_op?: string | null
          blokkade_reden?: string | null
          btw_code?: string
          created_at?: string
          exact_item_code?: string | null
          exact_item_id?: string | null
          gl_code?: string | null
          id?: string
          itemcode_patroon: string
          notitie?: string | null
          product: string
          updated_at?: string
        }
        Update: {
          bevestigd?: boolean
          bevestigd_door?: string | null
          bevestigd_op?: string | null
          blokkade_reden?: string | null
          btw_code?: string
          created_at?: string
          exact_item_code?: string | null
          exact_item_id?: string | null
          gl_code?: string | null
          id?: string
          itemcode_patroon?: string
          notitie?: string | null
          product?: string
          updated_at?: string
        }
        Relationships: []
      }
      factuur_credit_planning: {
        Row: {
          aangemaakt_op: string
          aanvraag_id: string
          bedrag: number | null
          berekening: Json | null
          bron: string
          concept_op: string | null
          credit_tm: string
          credit_vanaf: string
          creditsleutel: string
          einddatum: string
          exact_account_id: string | null
          exact_invoice_id: string | null
          exact_invoice_number: string | null
          exact_item_id: string | null
          exact_status: number | null
          foutmelding: string | null
          gl_code: string | null
          id: string
          is_test: boolean
          klant_contract_id: string
          laatst_gecontroleerd_op: string | null
          melding: string | null
          origineel_factuurnummer: string | null
          planning_ids: string[]
          status: string
          verwerkt_op: string | null
        }
        Insert: {
          aangemaakt_op?: string
          aanvraag_id: string
          bedrag?: number | null
          berekening?: Json | null
          bron?: string
          concept_op?: string | null
          credit_tm: string
          credit_vanaf: string
          creditsleutel: string
          einddatum: string
          exact_account_id?: string | null
          exact_invoice_id?: string | null
          exact_invoice_number?: string | null
          exact_item_id?: string | null
          exact_status?: number | null
          foutmelding?: string | null
          gl_code?: string | null
          id?: string
          is_test?: boolean
          klant_contract_id: string
          laatst_gecontroleerd_op?: string | null
          melding?: string | null
          origineel_factuurnummer?: string | null
          planning_ids?: string[]
          status?: string
          verwerkt_op?: string | null
        }
        Update: {
          aangemaakt_op?: string
          aanvraag_id?: string
          bedrag?: number | null
          berekening?: Json | null
          bron?: string
          concept_op?: string | null
          credit_tm?: string
          credit_vanaf?: string
          creditsleutel?: string
          einddatum?: string
          exact_account_id?: string | null
          exact_invoice_id?: string | null
          exact_invoice_number?: string | null
          exact_item_id?: string | null
          exact_status?: number | null
          foutmelding?: string | null
          gl_code?: string | null
          id?: string
          is_test?: boolean
          klant_contract_id?: string
          laatst_gecontroleerd_op?: string | null
          melding?: string | null
          origineel_factuurnummer?: string | null
          planning_ids?: string[]
          status?: string
          verwerkt_op?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "factuur_credit_planning_aanvraag_id_fkey"
            columns: ["aanvraag_id"]
            isOneToOne: false
            referencedRelation: "klant_service_aanvragen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factuur_credit_planning_klant_contract_id_fkey"
            columns: ["klant_contract_id"]
            isOneToOne: false
            referencedRelation: "klant_contracten"
            referencedColumns: ["id"]
          },
        ]
      }
      factuur_planner_runs: {
        Row: {
          aantal_aangemaakt: number
          aantal_geblokkeerd: number
          aantal_kandidaten: number
          bedrag: number
          detail: Json
          gestart_op: string
          id: string
          modus: string
          status: string
          trigger_type: string
        }
        Insert: {
          aantal_aangemaakt?: number
          aantal_geblokkeerd?: number
          aantal_kandidaten?: number
          bedrag?: number
          detail?: Json
          gestart_op?: string
          id?: string
          modus: string
          status?: string
          trigger_type: string
        }
        Update: {
          aantal_aangemaakt?: number
          aantal_geblokkeerd?: number
          aantal_kandidaten?: number
          bedrag?: number
          detail?: Json
          gestart_op?: string
          id?: string
          modus?: string
          status?: string
          trigger_type?: string
        }
        Relationships: []
      }
      factuur_planning: {
        Row: {
          aangemaakt_op: string
          aantal: number
          bedrag: number
          bedrag_per_periode: number
          btw_code: string
          concept_op: string | null
          exact_account_id: string
          exact_invoice_id: string | null
          exact_invoice_number: string | null
          exact_item_id: string
          exact_status: number | null
          foutmelding: string | null
          gl_code: string | null
          id: string
          invoice_date: string | null
          is_test: boolean
          klant_contract_id: string
          laatst_gecontroleerd_op: string | null
          periode_eind: string
          periode_start: string
          planningssleutel: string
          status: string
          vervangen_door: string | null
          verwerkt_op: string | null
        }
        Insert: {
          aangemaakt_op?: string
          aantal: number
          bedrag: number
          bedrag_per_periode: number
          btw_code?: string
          concept_op?: string | null
          exact_account_id: string
          exact_invoice_id?: string | null
          exact_invoice_number?: string | null
          exact_item_id: string
          exact_status?: number | null
          foutmelding?: string | null
          gl_code?: string | null
          id?: string
          invoice_date?: string | null
          is_test?: boolean
          klant_contract_id: string
          laatst_gecontroleerd_op?: string | null
          periode_eind: string
          periode_start: string
          planningssleutel: string
          status?: string
          vervangen_door?: string | null
          verwerkt_op?: string | null
        }
        Update: {
          aangemaakt_op?: string
          aantal?: number
          bedrag?: number
          bedrag_per_periode?: number
          btw_code?: string
          concept_op?: string | null
          exact_account_id?: string
          exact_invoice_id?: string | null
          exact_invoice_number?: string | null
          exact_item_id?: string
          exact_status?: number | null
          foutmelding?: string | null
          gl_code?: string | null
          id?: string
          invoice_date?: string | null
          is_test?: boolean
          klant_contract_id?: string
          laatst_gecontroleerd_op?: string | null
          periode_eind?: string
          periode_start?: string
          planningssleutel?: string
          status?: string
          vervangen_door?: string | null
          verwerkt_op?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "factuur_planning_klant_contract_id_fkey"
            columns: ["klant_contract_id"]
            isOneToOne: false
            referencedRelation: "klant_contracten"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factuur_planning_vervangen_door_fkey"
            columns: ["vervangen_door"]
            isOneToOne: false
            referencedRelation: "factuur_planning"
            referencedColumns: ["id"]
          },
        ]
      }
      factuur_planning_log: {
        Row: {
          actie: string
          created_at: string
          id: string
          klant_contract_id: string | null
          nieuw: Json | null
          oud: Json | null
          planning_id: string | null
          uitgevoerd_door: string | null
        }
        Insert: {
          actie: string
          created_at?: string
          id?: string
          klant_contract_id?: string | null
          nieuw?: Json | null
          oud?: Json | null
          planning_id?: string | null
          uitgevoerd_door?: string | null
        }
        Update: {
          actie?: string
          created_at?: string
          id?: string
          klant_contract_id?: string | null
          nieuw?: Json | null
          oud?: Json | null
          planning_id?: string | null
          uitgevoerd_door?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "factuur_planning_log_planning_id_fkey"
            columns: ["planning_id"]
            isOneToOne: false
            referencedRelation: "factuur_planning"
            referencedColumns: ["id"]
          },
        ]
      }
      form_rate_limit: {
        Row: {
          created_at: string
          id: string
          ip: string
          kind: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip: string
          kind: string
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string
          kind?: string
        }
        Relationships: []
      }
      integratie_config: {
        Row: {
          aangemaakt_op: string
          bijgewerkt_op: string
          division: string | null
          enabled: boolean
          id: string
          naam: string
          notities: string | null
        }
        Insert: {
          aangemaakt_op?: string
          bijgewerkt_op?: string
          division?: string | null
          enabled?: boolean
          id?: string
          naam: string
          notities?: string | null
        }
        Update: {
          aangemaakt_op?: string
          bijgewerkt_op?: string
          division?: string | null
          enabled?: boolean
          id?: string
          naam?: string
          notities?: string | null
        }
        Relationships: []
      }
      interne_melding_ontvangers: {
        Row: {
          aangemaakt_door: string | null
          aangemaakt_op: string
          actief: boolean
          bijgewerkt_door: string | null
          bijgewerkt_op: string
          email: string
          id: string
        }
        Insert: {
          aangemaakt_door?: string | null
          aangemaakt_op?: string
          actief?: boolean
          bijgewerkt_door?: string | null
          bijgewerkt_op?: string
          email: string
          id?: string
        }
        Update: {
          aangemaakt_door?: string | null
          aangemaakt_op?: string
          actief?: boolean
          bijgewerkt_door?: string | null
          bijgewerkt_op?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_excl_btw: number
          amount_incl_btw: number
          bank_account: string
          bank_name: string
          btw_amount: number
          btw_percentage: number
          client_address: string | null
          client_city: string | null
          client_name: string
          client_postcode: string | null
          company_name: string | null
          created_at: string
          description: string
          due_date: string
          id: string
          invoice_date: string
          invoice_number: string
          is_test: boolean
          kvk_nummer: string | null
          lead_id: string | null
          package_type: string
          payment_method: string
          payment_terms: string
          pdf_url: string | null
          policy_id: string | null
          status: string
          ubl_exported_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_excl_btw?: number
          amount_incl_btw?: number
          bank_account?: string
          bank_name?: string
          btw_amount?: number
          btw_percentage?: number
          client_address?: string | null
          client_city?: string | null
          client_name: string
          client_postcode?: string | null
          company_name?: string | null
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          is_test?: boolean
          kvk_nummer?: string | null
          lead_id?: string | null
          package_type?: string
          payment_method?: string
          payment_terms?: string
          pdf_url?: string | null
          policy_id?: string | null
          status?: string
          ubl_exported_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_excl_btw?: number
          amount_incl_btw?: number
          bank_account?: string
          bank_name?: string
          btw_amount?: number
          btw_percentage?: number
          client_address?: string | null
          client_city?: string | null
          client_name?: string
          client_postcode?: string | null
          company_name?: string | null
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          is_test?: boolean
          kvk_nummer?: string | null
          lead_id?: string | null
          package_type?: string
          payment_method?: string
          payment_terms?: string
          pdf_url?: string | null
          policy_id?: string | null
          status?: string
          ubl_exported_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "kpi_actieve_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      klant_certificaten: {
        Row: {
          aanvraagdatum: string
          beoordeeld_door: string | null
          beoordeeld_op: string | null
          bron: string
          bron_contact: string | null
          bron_naam: string | null
          certificaatnummer: string
          created_at: string
          id: string
          ingestuurd: string | null
          is_test: boolean
          koppeling_status: string
          match_type: string | null
          onderneming_id: string
          pakket: string | null
          persoon_id: string | null
          updated_at: string
          waarschuwing: string | null
        }
        Insert: {
          aanvraagdatum: string
          beoordeeld_door?: string | null
          beoordeeld_op?: string | null
          bron?: string
          bron_contact?: string | null
          bron_naam?: string | null
          certificaatnummer: string
          created_at?: string
          id?: string
          ingestuurd?: string | null
          is_test?: boolean
          koppeling_status?: string
          match_type?: string | null
          onderneming_id: string
          pakket?: string | null
          persoon_id?: string | null
          updated_at?: string
          waarschuwing?: string | null
        }
        Update: {
          aanvraagdatum?: string
          beoordeeld_door?: string | null
          beoordeeld_op?: string | null
          bron?: string
          bron_contact?: string | null
          bron_naam?: string | null
          certificaatnummer?: string
          created_at?: string
          id?: string
          ingestuurd?: string | null
          is_test?: boolean
          koppeling_status?: string
          match_type?: string | null
          onderneming_id?: string
          pakket?: string | null
          persoon_id?: string | null
          updated_at?: string
          waarschuwing?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "klant_certificaten_onderneming_id_fkey"
            columns: ["onderneming_id"]
            isOneToOne: false
            referencedRelation: "ondernemingen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "klant_certificaten_persoon_id_fkey"
            columns: ["persoon_id"]
            isOneToOne: false
            referencedRelation: "personen"
            referencedColumns: ["id"]
          },
        ]
      }
      klant_contracten: {
        Row: {
          aantal: number
          abonnement_nr: string | null
          afas_gefactureerd_tm: string | null
          afas_volgende_factuurdatum: string | null
          afw_prijs: number | null
          afwijkingen: string[]
          bedrag_per_periode: number
          begin_datum: string | null
          bron: string
          bron_rij: number
          created_at: string
          cyclus: string
          eind_datum: string | null
          exact_abonnement_id: string | null
          exact_abonnementsregel_id: string | null
          facturatie_status: string
          factureren_vanaf: string | null
          gefactureerd_tm: string | null
          gefactureerd_tm_bron: string
          id: string
          is_test: boolean
          itemcode: string
          laatst_gefactureerd_bedrag: number | null
          maandwaarde: number | null
          onderneming_id: string
          org_prijs: number | null
          product: string
          status: string
          type: string
          updated_at: string
          volgende_factuurdatum: string | null
        }
        Insert: {
          aantal?: number
          abonnement_nr?: string | null
          afas_gefactureerd_tm?: string | null
          afas_volgende_factuurdatum?: string | null
          afw_prijs?: number | null
          afwijkingen?: string[]
          bedrag_per_periode?: number
          begin_datum?: string | null
          bron: string
          bron_rij: number
          created_at?: string
          cyclus: string
          eind_datum?: string | null
          exact_abonnement_id?: string | null
          exact_abonnementsregel_id?: string | null
          facturatie_status?: string
          factureren_vanaf?: string | null
          gefactureerd_tm?: string | null
          gefactureerd_tm_bron?: string
          id?: string
          is_test?: boolean
          itemcode: string
          laatst_gefactureerd_bedrag?: number | null
          maandwaarde?: number | null
          onderneming_id: string
          org_prijs?: number | null
          product: string
          status?: string
          type: string
          updated_at?: string
          volgende_factuurdatum?: string | null
        }
        Update: {
          aantal?: number
          abonnement_nr?: string | null
          afas_gefactureerd_tm?: string | null
          afas_volgende_factuurdatum?: string | null
          afw_prijs?: number | null
          afwijkingen?: string[]
          bedrag_per_periode?: number
          begin_datum?: string | null
          bron?: string
          bron_rij?: number
          created_at?: string
          cyclus?: string
          eind_datum?: string | null
          exact_abonnement_id?: string | null
          exact_abonnementsregel_id?: string | null
          facturatie_status?: string
          factureren_vanaf?: string | null
          gefactureerd_tm?: string | null
          gefactureerd_tm_bron?: string
          id?: string
          is_test?: boolean
          itemcode?: string
          laatst_gefactureerd_bedrag?: number | null
          maandwaarde?: number | null
          onderneming_id?: string
          org_prijs?: number | null
          product?: string
          status?: string
          type?: string
          updated_at?: string
          volgende_factuurdatum?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "klant_contracten_onderneming_id_fkey"
            columns: ["onderneming_id"]
            isOneToOne: false
            referencedRelation: "ondernemingen"
            referencedColumns: ["id"]
          },
        ]
      }
      klant_service_aanvragen: {
        Row: {
          achternaam: string
          behandeld_door: string | null
          behandeld_op: string | null
          created_at: string
          details: Json
          email: string
          geverifieerd: boolean
          id: string
          is_test: boolean
          koppeling_details: Json
          koppeling_methode: string | null
          koppeling_status: string | null
          notities: string | null
          onderneming_id: string | null
          opzegging_verwerkt_door: string | null
          opzegging_verwerkt_op: string | null
          polisnummer: string
          status: string
          telefoon: string
          type: string
          updated_at: string
          user_id: string | null
          voornaam: string
        }
        Insert: {
          achternaam: string
          behandeld_door?: string | null
          behandeld_op?: string | null
          created_at?: string
          details?: Json
          email: string
          geverifieerd?: boolean
          id?: string
          is_test?: boolean
          koppeling_details?: Json
          koppeling_methode?: string | null
          koppeling_status?: string | null
          notities?: string | null
          onderneming_id?: string | null
          opzegging_verwerkt_door?: string | null
          opzegging_verwerkt_op?: string | null
          polisnummer: string
          status?: string
          telefoon: string
          type: string
          updated_at?: string
          user_id?: string | null
          voornaam: string
        }
        Update: {
          achternaam?: string
          behandeld_door?: string | null
          behandeld_op?: string | null
          created_at?: string
          details?: Json
          email?: string
          geverifieerd?: boolean
          id?: string
          is_test?: boolean
          koppeling_details?: Json
          koppeling_methode?: string | null
          koppeling_status?: string | null
          notities?: string | null
          onderneming_id?: string | null
          opzegging_verwerkt_door?: string | null
          opzegging_verwerkt_op?: string | null
          polisnummer?: string
          status?: string
          telefoon?: string
          type?: string
          updated_at?: string
          user_id?: string | null
          voornaam?: string
        }
        Relationships: [
          {
            foreignKeyName: "klant_service_aanvragen_onderneming_id_fkey"
            columns: ["onderneming_id"]
            isOneToOne: false
            referencedRelation: "ondernemingen"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          lead_id: string
          type: Database["public"]["Enums"]["note_type"]
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          lead_id: string
          type?: Database["public"]["Enums"]["note_type"]
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lead_id?: string
          type?: Database["public"]["Enums"]["note_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "kpi_actieve_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notification_log: {
        Row: {
          cc: string | null
          created_at: string
          error_message: string | null
          id: string
          lead_id: string | null
          lead_type: string
          metadata: Json | null
          recipient: string
          resend_message_id: string | null
          status: string
          subject: string | null
        }
        Insert: {
          cc?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          lead_type: string
          metadata?: Json | null
          recipient: string
          resend_message_id?: string | null
          status: string
          subject?: string | null
        }
        Update: {
          cc?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          lead_type?: string
          metadata?: Json | null
          recipient?: string
          resend_message_id?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          achternaam: string
          activatie_log: Json
          adres_huisnummer: string | null
          adres_plaats: string | null
          adres_postcode: string | null
          adres_straat: string | null
          assigned_to: string | null
          bedrijfsnaam: string | null
          beroep: string | null
          branche: string | null
          bron: Database["public"]["Enums"]["lead_bron"]
          converted_at: string | null
          created_at: string
          eigen_risico: string | null
          email: string
          exact_abonnement_id: string | null
          exact_account_id: string | null
          exact_credit_invoice_aangemaakt_op: string | null
          exact_credit_invoice_aangemaakt_op_opzeg: string | null
          exact_credit_invoice_bedrag: number | null
          exact_credit_invoice_bedrag_opzeg: number | null
          exact_credit_invoice_id_opzeg: string | null
          exact_credit_invoice_id_pauze: string | null
          exact_creditnota_amount: number | null
          exact_creditnota_created_at: string | null
          exact_creditnota_id: string | null
          exact_factuur_aangemaakt_op_hervat: string | null
          exact_factuur_bedrag_hervat: number | null
          exact_factuur_id_hervat: string | null
          exact_fout: string | null
          exact_invoice_amount: number | null
          exact_invoice_created_at: string | null
          exact_invoice_id: string | null
          exact_invoice_number: string | null
          exact_invoice_status: number | null
          exact_relatie_code: string | null
          exact_relatie_id: string | null
          exact_status: string | null
          exact_sync_op: string | null
          extra_data: Json
          functie_bij_aanvraag: string | null
          functie_bij_heractivering: string | null
          geactiveerd_door: string | null
          geactiveerd_op: string | null
          geboortedatum: string | null
          gekozen_pakket: string | null
          heractivering_datum: string | null
          heractivering_door: string | null
          iban: string | null
          id: string
          ingangsdatum: string | null
          is_test: boolean
          kvk_nummer: string | null
          omzet: string | null
          opmerkingen: string | null
          opzeg_datum: string | null
          opzeg_door: string | null
          opzeg_reden: string | null
          opzeg_toelichting: string | null
          pauze_door: string | null
          pauze_reden: string | null
          pauze_reminder_verzonden_op: string | null
          pauze_start_datum: string | null
          pauze_toelichting: string | null
          polis_einddatum: string | null
          sepa_akkoord: boolean
          sepa_akkoord_datum: string | null
          status: Database["public"]["Enums"]["lead_status"]
          telefoon: string | null
          type: Database["public"]["Enums"]["lead_type"]
          updated_at: string
          vereist_handmatige_beoordeling: boolean
          verzekerd_bedrag: string | null
          verzekering_type: string | null
          voornaam: string
        }
        Insert: {
          achternaam: string
          activatie_log?: Json
          adres_huisnummer?: string | null
          adres_plaats?: string | null
          adres_postcode?: string | null
          adres_straat?: string | null
          assigned_to?: string | null
          bedrijfsnaam?: string | null
          beroep?: string | null
          branche?: string | null
          bron?: Database["public"]["Enums"]["lead_bron"]
          converted_at?: string | null
          created_at?: string
          eigen_risico?: string | null
          email: string
          exact_abonnement_id?: string | null
          exact_account_id?: string | null
          exact_credit_invoice_aangemaakt_op?: string | null
          exact_credit_invoice_aangemaakt_op_opzeg?: string | null
          exact_credit_invoice_bedrag?: number | null
          exact_credit_invoice_bedrag_opzeg?: number | null
          exact_credit_invoice_id_opzeg?: string | null
          exact_credit_invoice_id_pauze?: string | null
          exact_creditnota_amount?: number | null
          exact_creditnota_created_at?: string | null
          exact_creditnota_id?: string | null
          exact_factuur_aangemaakt_op_hervat?: string | null
          exact_factuur_bedrag_hervat?: number | null
          exact_factuur_id_hervat?: string | null
          exact_fout?: string | null
          exact_invoice_amount?: number | null
          exact_invoice_created_at?: string | null
          exact_invoice_id?: string | null
          exact_invoice_number?: string | null
          exact_invoice_status?: number | null
          exact_relatie_code?: string | null
          exact_relatie_id?: string | null
          exact_status?: string | null
          exact_sync_op?: string | null
          extra_data?: Json
          functie_bij_aanvraag?: string | null
          functie_bij_heractivering?: string | null
          geactiveerd_door?: string | null
          geactiveerd_op?: string | null
          geboortedatum?: string | null
          gekozen_pakket?: string | null
          heractivering_datum?: string | null
          heractivering_door?: string | null
          iban?: string | null
          id?: string
          ingangsdatum?: string | null
          is_test?: boolean
          kvk_nummer?: string | null
          omzet?: string | null
          opmerkingen?: string | null
          opzeg_datum?: string | null
          opzeg_door?: string | null
          opzeg_reden?: string | null
          opzeg_toelichting?: string | null
          pauze_door?: string | null
          pauze_reden?: string | null
          pauze_reminder_verzonden_op?: string | null
          pauze_start_datum?: string | null
          pauze_toelichting?: string | null
          polis_einddatum?: string | null
          sepa_akkoord?: boolean
          sepa_akkoord_datum?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          telefoon?: string | null
          type?: Database["public"]["Enums"]["lead_type"]
          updated_at?: string
          vereist_handmatige_beoordeling?: boolean
          verzekerd_bedrag?: string | null
          verzekering_type?: string | null
          voornaam: string
        }
        Update: {
          achternaam?: string
          activatie_log?: Json
          adres_huisnummer?: string | null
          adres_plaats?: string | null
          adres_postcode?: string | null
          adres_straat?: string | null
          assigned_to?: string | null
          bedrijfsnaam?: string | null
          beroep?: string | null
          branche?: string | null
          bron?: Database["public"]["Enums"]["lead_bron"]
          converted_at?: string | null
          created_at?: string
          eigen_risico?: string | null
          email?: string
          exact_abonnement_id?: string | null
          exact_account_id?: string | null
          exact_credit_invoice_aangemaakt_op?: string | null
          exact_credit_invoice_aangemaakt_op_opzeg?: string | null
          exact_credit_invoice_bedrag?: number | null
          exact_credit_invoice_bedrag_opzeg?: number | null
          exact_credit_invoice_id_opzeg?: string | null
          exact_credit_invoice_id_pauze?: string | null
          exact_creditnota_amount?: number | null
          exact_creditnota_created_at?: string | null
          exact_creditnota_id?: string | null
          exact_factuur_aangemaakt_op_hervat?: string | null
          exact_factuur_bedrag_hervat?: number | null
          exact_factuur_id_hervat?: string | null
          exact_fout?: string | null
          exact_invoice_amount?: number | null
          exact_invoice_created_at?: string | null
          exact_invoice_id?: string | null
          exact_invoice_number?: string | null
          exact_invoice_status?: number | null
          exact_relatie_code?: string | null
          exact_relatie_id?: string | null
          exact_status?: string | null
          exact_sync_op?: string | null
          extra_data?: Json
          functie_bij_aanvraag?: string | null
          functie_bij_heractivering?: string | null
          geactiveerd_door?: string | null
          geactiveerd_op?: string | null
          geboortedatum?: string | null
          gekozen_pakket?: string | null
          heractivering_datum?: string | null
          heractivering_door?: string | null
          iban?: string | null
          id?: string
          ingangsdatum?: string | null
          is_test?: boolean
          kvk_nummer?: string | null
          omzet?: string | null
          opmerkingen?: string | null
          opzeg_datum?: string | null
          opzeg_door?: string | null
          opzeg_reden?: string | null
          opzeg_toelichting?: string | null
          pauze_door?: string | null
          pauze_reden?: string | null
          pauze_reminder_verzonden_op?: string | null
          pauze_start_datum?: string | null
          pauze_toelichting?: string | null
          polis_einddatum?: string | null
          sepa_akkoord?: boolean
          sepa_akkoord_datum?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          telefoon?: string | null
          type?: Database["public"]["Enums"]["lead_type"]
          updated_at?: string
          vereist_handmatige_beoordeling?: boolean
          verzekerd_bedrag?: string | null
          verzekering_type?: string | null
          voornaam?: string
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          ip: string | null
          succes: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip?: string | null
          succes?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip?: string | null
          succes?: boolean
        }
        Relationships: []
      }
      monthly_invoices_log: {
        Row: {
          bedrag: number
          created_at: string
          error_message: string | null
          exact_invoice_id: string | null
          exact_invoice_number: string | null
          factuur_jaar: number
          factuur_maand: number
          id: string
          lead_id: string
          payload: Json | null
          periode_eind: string
          periode_start: string
          polis_einddatum: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bedrag: number
          created_at?: string
          error_message?: string | null
          exact_invoice_id?: string | null
          exact_invoice_number?: string | null
          factuur_jaar: number
          factuur_maand: number
          id?: string
          lead_id: string
          payload?: Json | null
          periode_eind: string
          periode_start: string
          polis_einddatum?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bedrag?: number
          created_at?: string
          error_message?: string | null
          exact_invoice_id?: string | null
          exact_invoice_number?: string | null
          factuur_jaar?: number
          factuur_maand?: number
          id?: string
          lead_id?: string
          payload?: Json | null
          periode_eind?: string
          periode_start?: string
          polis_einddatum?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_invoices_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "kpi_actieve_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_invoices_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      not_found_log: {
        Row: {
          aantal: number
          afgehandeld: boolean
          eerste_op: string
          id: string
          laatste_op: string
          laatste_referrer: string | null
          laatste_user_agent: string | null
          pad: string
        }
        Insert: {
          aantal?: number
          afgehandeld?: boolean
          eerste_op?: string
          id?: string
          laatste_op?: string
          laatste_referrer?: string | null
          laatste_user_agent?: string | null
          pad: string
        }
        Update: {
          aantal?: number
          afgehandeld?: boolean
          eerste_op?: string
          id?: string
          laatste_op?: string
          laatste_referrer?: string | null
          laatste_user_agent?: string | null
          pad?: string
        }
        Relationships: []
      }
      ondernemingen: {
        Row: {
          afas_contactpersoon: string | null
          afwijkingen: string[]
          branche: string | null
          bron: string | null
          created_at: string
          exact_account_id: string | null
          exact_account_naam: string | null
          exact_koppeling_status: string | null
          exact_naam_gelijkenis: number | null
          exact_relatie_code: string | null
          facturatie_blokkade: string | null
          facturatie_blokkade_reden: string | null
          iban: string | null
          id: string
          is_test: boolean
          kvk: string | null
          naam: string | null
          rechtsvorm: string | null
          sector: string | null
          updated_at: string
        }
        Insert: {
          afas_contactpersoon?: string | null
          afwijkingen?: string[]
          branche?: string | null
          bron?: string | null
          created_at?: string
          exact_account_id?: string | null
          exact_account_naam?: string | null
          exact_koppeling_status?: string | null
          exact_naam_gelijkenis?: number | null
          exact_relatie_code?: string | null
          facturatie_blokkade?: string | null
          facturatie_blokkade_reden?: string | null
          iban?: string | null
          id?: string
          is_test?: boolean
          kvk?: string | null
          naam?: string | null
          rechtsvorm?: string | null
          sector?: string | null
          updated_at?: string
        }
        Update: {
          afas_contactpersoon?: string | null
          afwijkingen?: string[]
          branche?: string | null
          bron?: string | null
          created_at?: string
          exact_account_id?: string | null
          exact_account_naam?: string | null
          exact_koppeling_status?: string | null
          exact_naam_gelijkenis?: number | null
          exact_relatie_code?: string | null
          facturatie_blokkade?: string | null
          facturatie_blokkade_reden?: string | null
          iban?: string | null
          id?: string
          is_test?: boolean
          kvk?: string | null
          naam?: string | null
          rechtsvorm?: string | null
          sector?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      personen: {
        Row: {
          achternaam: string | null
          created_at: string
          email_weergave: string | null
          genormaliseerd_email: string | null
          id: string
          is_test: boolean
          updated_at: string
          voornaam: string | null
        }
        Insert: {
          achternaam?: string | null
          created_at?: string
          email_weergave?: string | null
          genormaliseerd_email?: string | null
          id?: string
          is_test?: boolean
          updated_at?: string
          voornaam?: string | null
        }
        Update: {
          achternaam?: string | null
          created_at?: string
          email_weergave?: string | null
          genormaliseerd_email?: string | null
          id?: string
          is_test?: boolean
          updated_at?: string
          voornaam?: string | null
        }
        Relationships: []
      }
      persoon_bron_koppeling: {
        Row: {
          bron_id: string
          bron_tabel: string
          created_at: string
          id: string
          persoon_id: string
        }
        Insert: {
          bron_id: string
          bron_tabel: string
          created_at?: string
          id?: string
          persoon_id: string
        }
        Update: {
          bron_id?: string
          bron_tabel?: string
          created_at?: string
          id?: string
          persoon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "persoon_bron_koppeling_persoon_id_fkey"
            columns: ["persoon_id"]
            isOneToOne: false
            referencedRelation: "personen"
            referencedColumns: ["id"]
          },
        ]
      }
      persoon_onderneming: {
        Row: {
          created_at: string
          id: string
          onderneming_id: string
          persoon_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          onderneming_id: string
          persoon_id: string
        }
        Update: {
          created_at?: string
          id?: string
          onderneming_id?: string
          persoon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "persoon_onderneming_onderneming_id_fkey"
            columns: ["onderneming_id"]
            isOneToOne: false
            referencedRelation: "ondernemingen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persoon_onderneming_persoon_id_fkey"
            columns: ["persoon_id"]
            isOneToOne: false
            referencedRelation: "personen"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          avb_per_event: string
          avb_per_year: string
          bav_per_event: string
          bav_per_year: string
          certificate_holder: string
          certificate_number: string
          contract_duration: string
          coverage_area: string
          created_at: string
          id: string
          ingetrokken_door: string | null
          ingetrokken_op: string | null
          insured_name: string
          intrek_reden: string | null
          is_test: boolean
          issued_by: string
          issued_date: string
          lead_id: string | null
          onderneming_id: string | null
          own_risk: string
          package_type: string
          pdf_url: string | null
          profession: string
          start_date: string
          status: string
          updated_at: string
          user_id: string | null
          versie: number
        }
        Insert: {
          avb_per_event?: string
          avb_per_year?: string
          bav_per_event?: string
          bav_per_year?: string
          certificate_holder: string
          certificate_number: string
          contract_duration?: string
          coverage_area?: string
          created_at?: string
          id?: string
          ingetrokken_door?: string | null
          ingetrokken_op?: string | null
          insured_name: string
          intrek_reden?: string | null
          is_test?: boolean
          issued_by?: string
          issued_date?: string
          lead_id?: string | null
          onderneming_id?: string | null
          own_risk?: string
          package_type?: string
          pdf_url?: string | null
          profession: string
          start_date: string
          status?: string
          updated_at?: string
          user_id?: string | null
          versie?: number
        }
        Update: {
          avb_per_event?: string
          avb_per_year?: string
          bav_per_event?: string
          bav_per_year?: string
          certificate_holder?: string
          certificate_number?: string
          contract_duration?: string
          coverage_area?: string
          created_at?: string
          id?: string
          ingetrokken_door?: string | null
          ingetrokken_op?: string | null
          insured_name?: string
          intrek_reden?: string | null
          is_test?: boolean
          issued_by?: string
          issued_date?: string
          lead_id?: string | null
          onderneming_id?: string | null
          own_risk?: string
          package_type?: string
          pdf_url?: string | null
          profession?: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          versie?: number
        }
        Relationships: [
          {
            foreignKeyName: "policies_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "kpi_actieve_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_onderneming_id_fkey"
            columns: ["onderneming_id"]
            isOneToOne: false
            referencedRelation: "ondernemingen"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_versies: {
        Row: {
          actie: string
          certificate_number: string
          created_at: string
          id: string
          nieuwe_waarden: Json | null
          oude_pdf_pad: string | null
          oude_waarden: Json
          policy_id: string
          reden: string | null
          uitgevoerd_door: string | null
          uitgevoerd_door_email: string | null
          versie: number
        }
        Insert: {
          actie: string
          certificate_number: string
          created_at?: string
          id?: string
          nieuwe_waarden?: Json | null
          oude_pdf_pad?: string | null
          oude_waarden: Json
          policy_id: string
          reden?: string | null
          uitgevoerd_door?: string | null
          uitgevoerd_door_email?: string | null
          versie: number
        }
        Update: {
          actie?: string
          certificate_number?: string
          created_at?: string
          id?: string
          nieuwe_waarden?: Json | null
          oude_pdf_pad?: string | null
          oude_waarden?: Json
          policy_id?: string
          reden?: string | null
          uitgevoerd_door?: string | null
          uitgevoerd_door_email?: string | null
          versie?: number
        }
        Relationships: [
          {
            foreignKeyName: "policy_versies_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      polis_audit_log: {
        Row: {
          actie: string
          created_at: string
          details: Json
          exact_response: Json | null
          fout_melding: string | null
          id: string
          lead_id: string
          rol: string | null
          succes: boolean
          uitgevoerd_door: string | null
        }
        Insert: {
          actie: string
          created_at?: string
          details?: Json
          exact_response?: Json | null
          fout_melding?: string | null
          id?: string
          lead_id: string
          rol?: string | null
          succes?: boolean
          uitgevoerd_door?: string | null
        }
        Update: {
          actie?: string
          created_at?: string
          details?: Json
          exact_response?: Json | null
          fout_melding?: string | null
          id?: string
          lead_id?: string
          rol?: string | null
          succes?: boolean
          uitgevoerd_door?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "polis_audit_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "kpi_actieve_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polis_audit_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_auto_invite_claim: {
        Row: {
          bron: string | null
          created_at: string | null
          lead_id: string
        }
        Insert: {
          bron?: string | null
          created_at?: string | null
          lead_id: string
        }
        Update: {
          bron?: string | null
          created_at?: string | null
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_auto_invite_claim_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "kpi_actieve_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_auto_invite_claim_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          lead_id: string | null
          status: string
          token: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          lead_id?: string | null
          status?: string
          token?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          lead_id?: string | null
          status?: string
          token?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_invitations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "kpi_actieve_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_invitations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      screening_aanvragen: {
        Row: {
          aangemeld_op: string
          achternaam: string
          bedrag: number | null
          bedrijfsnaam: string | null
          beroep: string | null
          bijgewerkt_op: string
          email: string
          exact_fout: string | null
          exact_relatie_id: string | null
          exact_status: string
          exact_sync_op: string | null
          exact_transactie_id: string | null
          iban: string | null
          id: string
          incasso_akkoord: boolean
          incasso_akkoord_op: string | null
          incasso_status: string
          is_test: boolean
          kvk_nummer: string | null
          notities: string | null
          otentica_flow_id: string | null
          otentica_rapport_url: string | null
          otentica_status: string
          otentica_webhook_data: Json | null
          rekeninghouder: string | null
          screening_type: string | null
          sector: string | null
          status: string
          telefoon: string | null
          voornaam: string
        }
        Insert: {
          aangemeld_op?: string
          achternaam: string
          bedrag?: number | null
          bedrijfsnaam?: string | null
          beroep?: string | null
          bijgewerkt_op?: string
          email: string
          exact_fout?: string | null
          exact_relatie_id?: string | null
          exact_status?: string
          exact_sync_op?: string | null
          exact_transactie_id?: string | null
          iban?: string | null
          id?: string
          incasso_akkoord?: boolean
          incasso_akkoord_op?: string | null
          incasso_status?: string
          is_test?: boolean
          kvk_nummer?: string | null
          notities?: string | null
          otentica_flow_id?: string | null
          otentica_rapport_url?: string | null
          otentica_status?: string
          otentica_webhook_data?: Json | null
          rekeninghouder?: string | null
          screening_type?: string | null
          sector?: string | null
          status?: string
          telefoon?: string | null
          voornaam: string
        }
        Update: {
          aangemeld_op?: string
          achternaam?: string
          bedrag?: number | null
          bedrijfsnaam?: string | null
          beroep?: string | null
          bijgewerkt_op?: string
          email?: string
          exact_fout?: string | null
          exact_relatie_id?: string | null
          exact_status?: string
          exact_sync_op?: string | null
          exact_transactie_id?: string | null
          iban?: string | null
          id?: string
          incasso_akkoord?: boolean
          incasso_akkoord_op?: string | null
          incasso_status?: string
          is_test?: boolean
          kvk_nummer?: string | null
          notities?: string | null
          otentica_flow_id?: string | null
          otentica_rapport_url?: string | null
          otentica_status?: string
          otentica_webhook_data?: Json | null
          rekeninghouder?: string | null
          screening_type?: string | null
          sector?: string | null
          status?: string
          telefoon?: string | null
          voornaam?: string
        }
        Relationships: []
      }
      sensitive_audit_log: {
        Row: {
          actie: string
          created_at: string
          details: Json
          id: string
          nieuwe_waarde: string | null
          oude_waarde: string | null
          target_id: string | null
          target_table: string
          uitgevoerd_door: string | null
          uitgevoerd_door_email: string | null
          uitgevoerd_door_rol: string | null
          veld: string | null
        }
        Insert: {
          actie: string
          created_at?: string
          details?: Json
          id?: string
          nieuwe_waarde?: string | null
          oude_waarde?: string | null
          target_id?: string | null
          target_table: string
          uitgevoerd_door?: string | null
          uitgevoerd_door_email?: string | null
          uitgevoerd_door_rol?: string | null
          veld?: string | null
        }
        Update: {
          actie?: string
          created_at?: string
          details?: Json
          id?: string
          nieuwe_waarde?: string | null
          oude_waarde?: string | null
          target_id?: string | null
          target_table?: string
          uitgevoerd_door?: string | null
          uitgevoerd_door_email?: string | null
          uitgevoerd_door_rol?: string | null
          veld?: string | null
        }
        Relationships: []
      }
      sepa_machtiging_bewijs: {
        Row: {
          akkoord_op: string
          bevestigingsmail_id: string | null
          bevestigingsmail_verzonden_op: string | null
          bron_id: string
          bron_tabel: string
          client_akkoord_op: string | null
          created_at: string
          debiteur_adres: Json
          debiteur_naam: string
          dienst: string
          getoonde_tekst: string
          iban: string
          id: string
          incassant_id: string
          incassant_naam: string
          ip_adres: string | null
          mandaatkenmerk: string
          pagina_url: string | null
          reden: string
          tekst_hash: string
          tekst_versie: string
          type: string
          user_agent: string | null
        }
        Insert: {
          akkoord_op?: string
          bevestigingsmail_id?: string | null
          bevestigingsmail_verzonden_op?: string | null
          bron_id: string
          bron_tabel: string
          client_akkoord_op?: string | null
          created_at?: string
          debiteur_adres: Json
          debiteur_naam: string
          dienst: string
          getoonde_tekst: string
          iban: string
          id?: string
          incassant_id: string
          incassant_naam: string
          ip_adres?: string | null
          mandaatkenmerk: string
          pagina_url?: string | null
          reden: string
          tekst_hash: string
          tekst_versie: string
          type: string
          user_agent?: string | null
        }
        Update: {
          akkoord_op?: string
          bevestigingsmail_id?: string | null
          bevestigingsmail_verzonden_op?: string | null
          bron_id?: string
          bron_tabel?: string
          client_akkoord_op?: string | null
          created_at?: string
          debiteur_adres?: Json
          debiteur_naam?: string
          dienst?: string
          getoonde_tekst?: string
          iban?: string
          id?: string
          incassant_id?: string
          incassant_naam?: string
          ip_adres?: string | null
          mandaatkenmerk?: string
          pagina_url?: string | null
          reden?: string
          tekst_hash?: string
          tekst_versie?: string
          type?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      social_media_features: {
        Row: {
          active: boolean
          created_at: string
          featured_until: string | null
          id: string
          platform: string
          post_url: string
          preview_image_url: string | null
          preview_text: string | null
          published_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          featured_until?: string | null
          id?: string
          platform: string
          post_url: string
          preview_image_url?: string | null
          preview_text?: string | null
          published_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          featured_until?: string | null
          id?: string
          platform?: string
          post_url?: string
          preview_image_url?: string | null
          preview_text?: string | null
          published_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      exact_reconciliatie_v: {
        Row: {
          bron: string | null
          bron_rij: number | null
          contract_id: string | null
          crm_bedrag: number | null
          crm_eind: string | null
          crm_gefactureerd_tm: string | null
          crm_status: string | null
          cyclus: string | null
          entry_id: string | null
          exact_bedrag: number | null
          exact_cyclus: string | null
          exact_eind: string | null
          exact_invoiced_to: string | null
          exact_nummer: string | null
          exact_relatie_code: string | null
          invoiced_to_bron: string | null
          itemcode: string | null
          klant_naam: string | null
          klasse: string | null
          onderneming_id: string | null
          product: string | null
          regel_id: string | null
          verschillen: string[] | null
        }
        Relationships: []
      }
      klant_mandaat_v: {
        Row: {
          iban: string | null
          kenmerk: string | null
          ondertekend_op: string | null
          relatiecode: string | null
          status: string | null
        }
        Relationships: []
      }
      kpi_actieve_leads: {
        Row: {
          achternaam: string | null
          bedrijfsnaam: string | null
          betaalritme: string | null
          created_at: string | null
          email: string | null
          exact_invoice_amount: number | null
          geactiveerd_op: string | null
          gekozen_pakket: string | null
          id: string | null
          is_test: boolean | null
          omzet: string | null
          status: Database["public"]["Enums"]["lead_status"] | null
          voornaam: string | null
        }
        Insert: {
          achternaam?: string | null
          bedrijfsnaam?: string | null
          betaalritme?: never
          created_at?: string | null
          email?: string | null
          exact_invoice_amount?: number | null
          geactiveerd_op?: string | null
          gekozen_pakket?: string | null
          id?: string | null
          is_test?: boolean | null
          omzet?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          voornaam?: string | null
        }
        Update: {
          achternaam?: string | null
          bedrijfsnaam?: string | null
          betaalritme?: never
          created_at?: string | null
          email?: string | null
          exact_invoice_amount?: number | null
          geactiveerd_op?: string | null
          gekozen_pakket?: string | null
          id?: string | null
          is_test?: boolean | null
          omzet?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          voornaam?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_portal_invitation: { Args: { _token: string }; Returns: Json }
      anonimiseer_aanvraag_concepten: { Args: never; Returns: number }
      beoordeel_klant_certificaat: {
        Args: { _bevestigen: boolean; _id: string }
        Returns: Json
      }
      bepaal_opzegging_koppeling: { Args: { _id: string }; Returns: Json }
      bevestig_artikel_mapping: {
        Args: { _bevestigd: boolean; _id: string }
        Returns: boolean
      }
      cleanup_expired_oauth_states: { Args: never; Returns: undefined }
      dashboard_tellers: { Args: { _toon_test?: boolean }; Returns: Json }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      doorrol_startstand: { Args: { _preview?: boolean }; Returns: Json }
      eerste_vrije_certificaatnummer: {
        Args: { _start: number }
        Returns: number
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      exact_code_norm: { Args: { _c: string }; Returns: string }
      exact_koppel_accounts: { Args: never; Returns: Json }
      facturatie_kandidaten: {
        Args: { _tot: string; _van: string }
        Returns: {
          aantal: number
          achterstallig: boolean
          bedrag: number
          bedrag_per_periode: number
          bestaande_planning_status: string
          blokkade: string
          blokkade_soort: string
          btw_code: string
          cyclus: string
          exact_account_id: string
          exact_item_id: string
          gl_code: string
          itemcode: string
          klant_contract_id: string
          klantnaam: string
          onderneming_id: string
          periode_eind: string
          periode_start: string
          product: string
          relatiecode: string
        }[]
      }
      factuur_mapping_voor: {
        Args: { _itemcode: string }
        Returns: {
          bevestigd: boolean
          bevestigd_door: string | null
          bevestigd_op: string | null
          blokkade_reden: string | null
          btw_code: string
          created_at: string
          exact_item_code: string | null
          exact_item_id: string | null
          gl_code: string | null
          id: string
          itemcode_patroon: string
          notitie: string | null
          product: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "factuur_artikel_mapping"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      factuur_opnieuw_inplannen: {
        Args: { _planning_id: string }
        Returns: Json
      }
      factuur_periode_eind: {
        Args: { _cyclus: string; _start: string }
        Returns: string
      }
      factuur_periode_start: {
        Args: { _anker: string; _cyclus: string; _n: number }
        Returns: string
      }
      get_exact_config_status: { Args: never; Returns: Json }
      get_exact_koppeling_fout: { Args: never; Returns: string }
      get_klant_contracten_reconciliatie: { Args: never; Returns: Json }
      get_mijn_polissen: {
        Args: never
        Returns: {
          exact_invoice_status: number
          functie_bij_aanvraag: string
          id: string
          opzeg_datum: string
          pauze_reden: string
          pauze_start_datum: string
          status: Database["public"]["Enums"]["lead_status"]
        }[]
      }
      get_pilot_signup_count: { Args: { pilot: string }; Returns: number }
      get_portal_status: { Args: { _lead_id: string }; Returns: Json }
      get_user_role_label: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      herbeoordeel_opzeg_credits: { Args: never; Returns: number }
      importeer_afas_20261001: { Args: never; Returns: Json }
      importeer_certificaten_20261001: { Args: never; Returns: Json }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_supervisor_or_admin: { Args: { _user_id: string }; Returns: boolean }
      is_team_member: { Args: { _user_id: string }; Returns: boolean }
      koppel_opzegging: {
        Args: { _aanvraag_id: string; _onderneming_id: string }
        Returns: Json
      }
      log_not_found: {
        Args: { _pad: string; _referrer?: string; _user_agent?: string }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      neem_exact_stand_over: {
        Args: { _contract_ids: string[] }
        Returns: Json
      }
      nextval_text: { Args: { seq_name: string }; Returns: string }
      plan_opzeg_credit: {
        Args: { _aanvraag_id: string; _contract_id: string; _einddatum: string }
        Returns: Json
      }
      portal_user_id_by_email: { Args: { p_email: string }; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      verify_cron_secret: { Args: { p_secret: string }; Returns: boolean }
      verify_dba_certificate: {
        Args: { _token: string }
        Returns: {
          certificate_number: string
          certified_at: string
          client_name: string
          status: string
        }[]
      }
      verwerk_opzegging: {
        Args: { _aanvraag_id: string; _contract_ids: string[] }
        Returns: Json
      }
      zeker_opschonen: { Args: never; Returns: undefined }
      zeker_zoek_artikelen: {
        Args: { _q: string }
        Returns: {
          excerpt: string
          slug: string
          title: string
        }[]
      }
      zet_facturatie_actief: { Args: { _aan: boolean }; Returns: boolean }
      zet_opzeg_credits_actief: { Args: { _aan: boolean }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "medewerker"
        | "supervisor"
        | "verzekering"
        | "marketing"
      lead_bron: "website" | "telefoon" | "email"
      lead_status:
        | "nieuw"
        | "in_behandeling"
        | "afspraak_gepland"
        | "offerte_verstuurd"
        | "klant"
        | "afgewezen"
        | "nieuw_te_beoordelen"
        | "actief"
        | "gepauzeerd"
        | "opgezegd"
      lead_type: "contact" | "verzekering_aanvraag" | "offerte-aanvraag"
      note_type: "notitie" | "follow_up" | "telefoongesprek"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "medewerker",
        "supervisor",
        "verzekering",
        "marketing",
      ],
      lead_bron: ["website", "telefoon", "email"],
      lead_status: [
        "nieuw",
        "in_behandeling",
        "afspraak_gepland",
        "offerte_verstuurd",
        "klant",
        "afgewezen",
        "nieuw_te_beoordelen",
        "actief",
        "gepauzeerd",
        "opgezegd",
      ],
      lead_type: ["contact", "verzekering_aanvraag", "offerte-aanvraag"],
      note_type: ["notitie", "follow_up", "telefoongesprek"],
    },
  },
} as const
