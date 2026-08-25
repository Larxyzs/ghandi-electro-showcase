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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
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
      orders: {
        Row: {
          address: string
          city: string
          created_at: string
          full_name: string
          id: string
          items: Json
          note: string
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
      products: {
        Row: {
          brand: string
          characteristics: string
          created_at: string
          featured: boolean
          gallery: Json
          id: string
          image_url: string | null
          marketing_sections: Json
          name: string
          node_id: string
          price: number | null
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
          featured?: boolean
          gallery?: Json
          id?: string
          image_url?: string | null
          marketing_sections?: Json
          name: string
          node_id: string
          price?: number | null
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
          featured?: boolean
          gallery?: Json
          id?: string
          image_url?: string | null
          marketing_sections?: Json
          name?: string
          node_id?: string
          price?: number | null
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
      site_settings: {
        Row: {
          id: string
          primary_color: string
          search_api_key: string | null
          search_provider: string
          secondary_color: string
          site_mode: string
          text_color: string
          updated_at: string
        }
        Insert: {
          id?: string
          primary_color?: string
          search_api_key?: string | null
          search_provider?: string
          secondary_color?: string
          site_mode?: string
          text_color?: string
          updated_at?: string
        }
        Update: {
          id?: string
          primary_color?: string
          search_api_key?: string | null
          search_provider?: string
          secondary_color?: string
          site_mode?: string
          text_color?: string
          updated_at?: string
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
