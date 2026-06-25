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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      articles: {
        Row: {
          category: string
          content: string | null
          created_at: string
          excerpt: string | null
          id: string
          image_url: string | null
          is_published: boolean | null
          published_at: string | null
          read_time: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          source_name: string | null
          source_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          published_at?: string | null
          read_time?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          source_name?: string | null
          source_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          published_at?: string | null
          read_time?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          source_name?: string | null
          source_url?: string | null
          title?: string
          updated_at?: string
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
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
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
          naam: string | null
          status: string
          suggestie: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          naam?: string | null
          status?: string
          suggestie: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          naam?: string | null
          status?: string
          suggestie?: string
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
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
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
          id: string
          is_actief: boolean
          laatste_sync: string | null
          last_error: string | null
          last_sync_at: string | null
          redirect_uri: string | null
          refresh_token: string | null
          refresh_token_obtained_at: string | null
          token_expires_at: string | null
          updated_at: string
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
          id?: string
          is_actief?: boolean
          laatste_sync?: string | null
          last_error?: string | null
          last_sync_at?: string | null
          redirect_uri?: string | null
          refresh_token?: string | null
          refresh_token_obtained_at?: string | null
          token_expires_at?: string | null
          updated_at?: string
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
          id?: string
          is_actief?: boolean
          laatste_sync?: string | null
          last_error?: string | null
          last_sync_at?: string | null
          redirect_uri?: string | null
          refresh_token?: string | null
          refresh_token_obtained_at?: string | null
          token_expires_at?: string | null
          updated_at?: string
          webhook_secret?: string | null
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
      klant_service_aanvragen: {
        Row: {
          achternaam: string
          behandeld_door: string | null
          behandeld_op: string | null
          created_at: string
          details: Json
          email: string
          id: string
          notities: string | null
          polisnummer: string
          status: string
          telefoon: string
          type: string
          updated_at: string
          voornaam: string
        }
        Insert: {
          achternaam: string
          behandeld_door?: string | null
          behandeld_op?: string | null
          created_at?: string
          details?: Json
          email: string
          id?: string
          notities?: string | null
          polisnummer: string
          status?: string
          telefoon: string
          type: string
          updated_at?: string
          voornaam: string
        }
        Update: {
          achternaam?: string
          behandeld_door?: string | null
          behandeld_op?: string | null
          created_at?: string
          details?: Json
          email?: string
          id?: string
          notities?: string | null
          polisnummer?: string
          status?: string
          telefoon?: string
          type?: string
          updated_at?: string
          voornaam?: string
        }
        Relationships: []
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
            referencedRelation: "leads"
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
          insured_name: string
          issued_by: string
          issued_date: string
          lead_id: string | null
          own_risk: string
          package_type: string
          pdf_url: string | null
          profession: string
          start_date: string
          updated_at: string
          user_id: string | null
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
          insured_name: string
          issued_by?: string
          issued_date?: string
          lead_id?: string | null
          own_risk?: string
          package_type?: string
          pdf_url?: string | null
          profession: string
          start_date: string
          updated_at?: string
          user_id?: string | null
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
          insured_name?: string
          issued_by?: string
          issued_date?: string
          lead_id?: string | null
          own_risk?: string
          package_type?: string
          pdf_url?: string | null
          profession?: string
          start_date?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "policies_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
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
          bedrijfsnaam: string | null
          beroep: string | null
          bijgewerkt_op: string
          email: string
          id: string
          kvk_nummer: string | null
          notities: string | null
          otentica_flow_id: string | null
          otentica_rapport_url: string | null
          otentica_status: string
          otentica_webhook_data: Json | null
          screening_type: string | null
          sector: string | null
          status: string
          telefoon: string | null
          voornaam: string
        }
        Insert: {
          aangemeld_op?: string
          achternaam: string
          bedrijfsnaam?: string | null
          beroep?: string | null
          bijgewerkt_op?: string
          email: string
          id?: string
          kvk_nummer?: string | null
          notities?: string | null
          otentica_flow_id?: string | null
          otentica_rapport_url?: string | null
          otentica_status?: string
          otentica_webhook_data?: Json | null
          screening_type?: string | null
          sector?: string | null
          status?: string
          telefoon?: string | null
          voornaam: string
        }
        Update: {
          aangemeld_op?: string
          achternaam?: string
          bedrijfsnaam?: string | null
          beroep?: string | null
          bijgewerkt_op?: string
          email?: string
          id?: string
          kvk_nummer?: string | null
          notities?: string | null
          otentica_flow_id?: string | null
          otentica_rapport_url?: string | null
          otentica_status?: string
          otentica_webhook_data?: Json | null
          screening_type?: string | null
          sector?: string | null
          status?: string
          telefoon?: string | null
          voornaam?: string
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
      [_ in never]: never
    }
    Functions: {
      accept_portal_invitation: { Args: { _token: string }; Returns: Json }
      cleanup_expired_oauth_states: { Args: never; Returns: undefined }
      get_pilot_signup_count: { Args: { pilot: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_team_member: { Args: { _user_id: string }; Returns: boolean }
      nextval_text: { Args: { seq_name: string }; Returns: string }
      verify_dba_certificate: {
        Args: { _token: string }
        Returns: {
          certificate_number: string
          certified_at: string
          client_name: string
          status: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "medewerker"
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
    Enums: {
      app_role: ["admin", "medewerker"],
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
