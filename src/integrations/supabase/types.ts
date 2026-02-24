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
          kvk_check_result: Json | null
          kvk_file_url: string | null
          kvk_filename: string | null
          kvk_text: string | null
          lead_id: string | null
          missing_fields: Json | null
          opdrachtgever: string | null
          optie_verlenging: string | null
          original_filename: string | null
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
          kvk_check_result?: Json | null
          kvk_file_url?: string | null
          kvk_filename?: string | null
          kvk_text?: string | null
          lead_id?: string | null
          missing_fields?: Json | null
          opdrachtgever?: string | null
          optie_verlenging?: string | null
          original_filename?: string | null
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
          kvk_check_result?: Json | null
          kvk_file_url?: string | null
          kvk_filename?: string | null
          kvk_text?: string | null
          lead_id?: string | null
          missing_fields?: Json | null
          opdrachtgever?: string | null
          optie_verlenging?: string | null
          original_filename?: string | null
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
      leads: {
        Row: {
          achternaam: string
          assigned_to: string | null
          bedrijfsnaam: string | null
          beroep: string | null
          bron: Database["public"]["Enums"]["lead_bron"]
          converted_at: string | null
          created_at: string
          eigen_risico: string | null
          email: string
          geboortedatum: string | null
          id: string
          ingangsdatum: string | null
          kvk_nummer: string | null
          omzet: string | null
          opmerkingen: string | null
          status: Database["public"]["Enums"]["lead_status"]
          telefoon: string | null
          type: Database["public"]["Enums"]["lead_type"]
          updated_at: string
          verzekerd_bedrag: string | null
          verzekering_type: string | null
          voornaam: string
        }
        Insert: {
          achternaam: string
          assigned_to?: string | null
          bedrijfsnaam?: string | null
          beroep?: string | null
          bron?: Database["public"]["Enums"]["lead_bron"]
          converted_at?: string | null
          created_at?: string
          eigen_risico?: string | null
          email: string
          geboortedatum?: string | null
          id?: string
          ingangsdatum?: string | null
          kvk_nummer?: string | null
          omzet?: string | null
          opmerkingen?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          telefoon?: string | null
          type?: Database["public"]["Enums"]["lead_type"]
          updated_at?: string
          verzekerd_bedrag?: string | null
          verzekering_type?: string | null
          voornaam: string
        }
        Update: {
          achternaam?: string
          assigned_to?: string | null
          bedrijfsnaam?: string | null
          beroep?: string | null
          bron?: Database["public"]["Enums"]["lead_bron"]
          converted_at?: string | null
          created_at?: string
          eigen_risico?: string | null
          email?: string
          geboortedatum?: string | null
          id?: string
          ingangsdatum?: string | null
          kvk_nummer?: string | null
          omzet?: string | null
          opmerkingen?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          telefoon?: string | null
          type?: Database["public"]["Enums"]["lead_type"]
          updated_at?: string
          verzekerd_bedrag?: string | null
          verzekering_type?: string | null
          voornaam?: string
        }
        Relationships: []
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
      lead_type: "contact" | "verzekering_aanvraag"
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
      ],
      lead_type: ["contact", "verzekering_aanvraag"],
      note_type: ["notitie", "follow_up", "telefoongesprek"],
    },
  },
} as const
