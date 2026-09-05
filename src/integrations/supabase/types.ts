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
      admin_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          email: string | null
          id: string
          password_hash: string
          role: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          password_hash: string
          role?: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          password_hash?: string
          role?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      catalog_audit_findings: {
        Row: {
          action: string
          auto_repair_safe: boolean
          created_at: string
          evidence: string
          id: string
          model: string
          problem: string
          problem_code: string
          product_id: string | null
          product_label: string
          reference_id: string | null
          repaired_at: string | null
          run_id: string
          severity: string
          source_url: string | null
        }
        Insert: {
          action?: string
          auto_repair_safe?: boolean
          created_at?: string
          evidence?: string
          id?: string
          model?: string
          problem?: string
          problem_code: string
          product_id?: string | null
          product_label?: string
          reference_id?: string | null
          repaired_at?: string | null
          run_id: string
          severity?: string
          source_url?: string | null
        }
        Update: {
          action?: string
          auto_repair_safe?: boolean
          created_at?: string
          evidence?: string
          id?: string
          model?: string
          problem?: string
          problem_code?: string
          product_id?: string | null
          product_label?: string
          reference_id?: string | null
          repaired_at?: string | null
          run_id?: string
          severity?: string
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_audit_findings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "catalog_audit_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_audit_runs: {
        Row: {
          checked: number
          created_at: string
          created_by: string
          deep: boolean
          id: string
          incorrect: number
          needs_review: number
          scope: string
          state: string
          summary: Json
          updated_at: string
          verified: number
        }
        Insert: {
          checked?: number
          created_at?: string
          created_by?: string
          deep?: boolean
          id?: string
          incorrect?: number
          needs_review?: number
          scope?: string
          state?: string
          summary?: Json
          updated_at?: string
          verified?: number
        }
        Update: {
          checked?: number
          created_at?: string
          created_by?: string
          deep?: boolean
          id?: string
          incorrect?: number
          needs_review?: number
          scope?: string
          state?: string
          summary?: Json
          updated_at?: string
          verified?: number
        }
        Relationships: []
      }
      catalog_nodes: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          level: number
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          level: number
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          level?: number
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "catalog_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_rebuild_items: {
        Row: {
          attempts: number
          created_at: string
          detail: Json
          error: string
          id: string
          job_id: string
          label: string
          position: number
          product_id: string | null
          reference_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          detail?: Json
          error?: string
          id?: string
          job_id: string
          label?: string
          position?: number
          product_id?: string | null
          reference_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          detail?: Json
          error?: string
          id?: string
          job_id?: string
          label?: string
          position?: number
          product_id?: string | null
          reference_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_rebuild_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "catalog_rebuild_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_rebuild_items_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "catalog_references"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_rebuild_jobs: {
        Row: {
          created_at: string
          created_by: string
          current_label: string
          delete_products: boolean
          error: string
          failed: number
          id: string
          label: string
          needs_review: number
          processed: number
          products_deleted: number
          references_preserved: number
          state: string
          total: number
          updated_at: string
          verified: number
        }
        Insert: {
          created_at?: string
          created_by?: string
          current_label?: string
          delete_products?: boolean
          error?: string
          failed?: number
          id?: string
          label?: string
          needs_review?: number
          processed?: number
          products_deleted?: number
          references_preserved?: number
          state?: string
          total?: number
          updated_at?: string
          verified?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          current_label?: string
          delete_products?: boolean
          error?: string
          failed?: number
          id?: string
          label?: string
          needs_review?: number
          processed?: number
          products_deleted?: number
          references_preserved?: number
          state?: string
          total?: number
          updated_at?: string
          verified?: number
        }
        Relationships: []
      }
      catalog_references: {
        Row: {
          active: boolean
          brand: string
          canonical_url: string | null
          created_at: string
          id: string
          last_error: string
          last_status: string
          last_verified_at: string | null
          manufacturer: string
          model: string
          name: string
          node_id: string | null
          node_path: string
          notes: string
          official_url: string | null
          product_id: string | null
          product_type: string
          reference: string
          region: string
          requires_discovery: boolean
          source: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand?: string
          canonical_url?: string | null
          created_at?: string
          id?: string
          last_error?: string
          last_status?: string
          last_verified_at?: string | null
          manufacturer?: string
          model?: string
          name?: string
          node_id?: string | null
          node_path?: string
          notes?: string
          official_url?: string | null
          product_id?: string | null
          product_type?: string
          reference?: string
          region?: string
          requires_discovery?: boolean
          source?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand?: string
          canonical_url?: string | null
          created_at?: string
          id?: string
          last_error?: string
          last_status?: string
          last_verified_at?: string | null
          manufacturer?: string
          model?: string
          name?: string
          node_id?: string | null
          node_path?: string
          notes?: string
          official_url?: string | null
          product_id?: string | null
          product_type?: string
          reference?: string
          region?: string
          requires_discovery?: boolean
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_references_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "catalog_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_references_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      cindy_actions: {
        Row: {
          action: string
          admin_username: string
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          label: string
          undone_at: string | null
        }
        Insert: {
          action: string
          admin_username: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          label: string
          undone_at?: string | null
        }
        Update: {
          action?: string
          admin_username?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          label?: string
          undone_at?: string | null
        }
        Relationships: []
      }
      cindy_cache: {
        Row: {
          brand: string
          cache_key: string
          created_at: string
          hits: number
          id: string
          images: Json
          model: string
          product: Json
          query: string
          searches_used: number
          sources: Json
          updated_at: string
        }
        Insert: {
          brand?: string
          cache_key: string
          created_at?: string
          hits?: number
          id?: string
          images?: Json
          model?: string
          product: Json
          query: string
          searches_used?: number
          sources?: Json
          updated_at?: string
        }
        Update: {
          brand?: string
          cache_key?: string
          created_at?: string
          hits?: number
          id?: string
          images?: Json
          model?: string
          product?: Json
          query?: string
          searches_used?: number
          sources?: Json
          updated_at?: string
        }
        Relationships: []
      }
      cindy_sessions: {
        Row: {
          admin_username: string
          created_at: string
          id: string
          messages: Json
          mode: string
          title: string
          updated_at: string
        }
        Insert: {
          admin_username: string
          created_at?: string
          id?: string
          messages?: Json
          mode?: string
          title?: string
          updated_at?: string
        }
        Update: {
          admin_username?: string
          created_at?: string
          id?: string
          messages?: Json
          mode?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_translations: {
        Row: {
          created_at: string
          lang: string
          source: string
          source_hash: string
          translated: string
        }
        Insert: {
          created_at?: string
          lang: string
          source: string
          source_hash: string
          translated: string
        }
        Update: {
          created_at?: string
          lang?: string
          source?: string
          source_hash?: string
          translated?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          created_at: string
          failed: number
          id: string
          needs_review: number
          processed: number
          state: string
          total: number
          updated_at: string
          verified: number
        }
        Insert: {
          created_at?: string
          failed?: number
          id?: string
          needs_review?: number
          processed?: number
          state?: string
          total?: number
          updated_at?: string
          verified?: number
        }
        Update: {
          created_at?: string
          failed?: number
          id?: string
          needs_review?: number
          processed?: number
          state?: string
          total?: number
          updated_at?: string
          verified?: number
        }
        Relationships: []
      }
      manufacturer_profiles: {
        Row: {
          brand: string
          corrections: Json
          created_at: string
          domain: string
          gallery_patterns: Json
          id: string
          notes: string
          page_patterns: Json
          quirks: Json
          spec_terms: Json
          updated_at: string
        }
        Insert: {
          brand?: string
          corrections?: Json
          created_at?: string
          domain: string
          gallery_patterns?: Json
          id?: string
          notes?: string
          page_patterns?: Json
          quirks?: Json
          spec_terms?: Json
          updated_at?: string
        }
        Update: {
          brand?: string
          corrections?: Json
          created_at?: string
          domain?: string
          gallery_patterns?: Json
          id?: string
          notes?: string
          page_patterns?: Json
          quirks?: Json
          spec_terms?: Json
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          address: string
          city: string
          created_at: string
          full_name: string
          id: string
          items: Json
          note: string
          paid_at: string | null
          payment_state: string
          phone: string
          reference: string
          status: string
          total: number | null
          updated_at: string
        }
        Insert: {
          address: string
          city?: string
          created_at?: string
          full_name: string
          id?: string
          items?: Json
          note?: string
          paid_at?: string | null
          payment_state?: string
          phone: string
          reference?: string
          status?: string
          total?: number | null
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          full_name?: string
          id?: string
          items?: Json
          note?: string
          paid_at?: string | null
          payment_state?: string
          phone?: string
          reference?: string
          status?: string
          total?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      popular_searches: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          term: string
        }
        Insert: {
          created_at?: string
          id?: string
          sort_order?: number
          term: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          term?: string
        }
        Relationships: []
      }
      product_imports: {
        Row: {
          batch_id: string | null
          brand: string
          canonical_url: string | null
          created_at: string
          domain: string
          error: string
          fetch_method: string
          fields: Json
          gallery: Json
          id: string
          model: string
          name: string
          payload: Json
          product_id: string | null
          status: string
          updated_at: string
          url: string
        }
        Insert: {
          batch_id?: string | null
          brand?: string
          canonical_url?: string | null
          created_at?: string
          domain?: string
          error?: string
          fetch_method?: string
          fields?: Json
          gallery?: Json
          id?: string
          model?: string
          name?: string
          payload?: Json
          product_id?: string | null
          status?: string
          updated_at?: string
          url: string
        }
        Update: {
          batch_id?: string | null
          brand?: string
          canonical_url?: string | null
          created_at?: string
          domain?: string
          error?: string
          fetch_method?: string
          fields?: Json
          gallery?: Json
          id?: string
          model?: string
          name?: string
          payload?: Json
          product_id?: string | null
          status?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      product_nodes: {
        Row: {
          created_at: string
          id: string
          node_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          node_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          node_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_nodes_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "catalog_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_nodes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string
          characteristics: string
          created_at: string
          extraction_evidence: Json
          featured: boolean
          gallery: Json
          id: string
          image_url: string | null
          marketing_sections: Json
          name: string
          node_id: string
          price: number | null
          review_state: string
          serial_number: string
          sort_order: number
          source_name: string | null
          source_url: string | null
          specifications: Json
          stock: number
          updated_at: string
        }
        Insert: {
          brand?: string
          characteristics?: string
          created_at?: string
          extraction_evidence?: Json
          featured?: boolean
          gallery?: Json
          id?: string
          image_url?: string | null
          marketing_sections?: Json
          name: string
          node_id: string
          price?: number | null
          review_state?: string
          serial_number?: string
          sort_order?: number
          source_name?: string | null
          source_url?: string | null
          specifications?: Json
          stock?: number
          updated_at?: string
        }
        Update: {
          brand?: string
          characteristics?: string
          created_at?: string
          extraction_evidence?: Json
          featured?: boolean
          gallery?: Json
          id?: string
          image_url?: string | null
          marketing_sections?: Json
          name?: string
          node_id?: string
          price?: number | null
          review_state?: string
          serial_number?: string
          sort_order?: number
          source_name?: string | null
          source_url?: string | null
          specifications?: Json
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "catalog_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      site_secrets: {
        Row: {
          ai_api_key: string | null
          created_at: string
          id: string
          search_api_key: string | null
          updated_at: string
        }
        Insert: {
          ai_api_key?: string | null
          created_at?: string
          id?: string
          search_api_key?: string | null
          updated_at?: string
        }
        Update: {
          ai_api_key?: string | null
          created_at?: string
          id?: string
          search_api_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          ai_model: string
          ai_provider: string
          id: string
          primary_color: string
          search_model: string
          search_provider: string
          secondary_color: string
          site_mode: string
          text_color: string
          updated_at: string
        }
        Insert: {
          ai_model?: string
          ai_provider?: string
          id?: string
          primary_color?: string
          search_model?: string
          search_provider?: string
          secondary_color?: string
          site_mode?: string
          text_color?: string
          updated_at?: string
        }
        Update: {
          ai_model?: string
          ai_provider?: string
          id?: string
          primary_color?: string
          search_model?: string
          search_provider?: string
          secondary_color?: string
          site_mode?: string
          text_color?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_snapshots: {
        Row: {
          created_at: string
          created_by: string
          id: string
          label: string
          payload: Json
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          label?: string
          payload?: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          label?: string
          payload?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
