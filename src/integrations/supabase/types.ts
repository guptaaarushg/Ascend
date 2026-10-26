export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
                                                                        
                                                                            
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cohorts: {
        Row: {
          counselor_id: string
          created_at: string
          id: string
          invite_code: string
          name: string
          updated_at: string
        }
        Insert: {
          counselor_id: string
          created_at?: string
          id?: string
          invite_code: string
          name: string
          updated_at?: string
        }
        Update: {
          counselor_id?: string
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_name: string
          body: string
          category: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author_name: string
          body: string
          category: string
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author_name?: string
          body?: string
          category?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      community_replies: {
        Row: {
          author_name: string
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          author_name: string
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          topic: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          topic?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          topic?: string
          user_id?: string | null
        }
        Relationships: []
      }
      matches: {
        Row: {
          future_reason: string | null
          generated_at: string
          id: string
          is_future: boolean
          opportunity_id: string
          ready_in: string | null
          reasoning: string
          score: number
          user_id: string
          why_qualify: string | null
        }
        Insert: {
          future_reason?: string | null
          generated_at?: string
          id?: string
          is_future?: boolean
          opportunity_id: string
          ready_in?: string | null
          reasoning: string
          score: number
          user_id: string
          why_qualify?: string | null
        }
        Update: {
          future_reason?: string | null
          generated_at?: string
          id?: string
          is_future?: boolean
          opportunity_id?: string
          ready_in?: string | null
          reasoning?: string
          score?: number
          user_id?: string
          why_qualify?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_digest_enabled: boolean
          frequency: string
          id: string
          last_sent_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_digest_enabled?: boolean
          frequency?: string
          id?: string
          last_sent_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_digest_enabled?: boolean
          frequency?: string
          id?: string
          last_sent_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          application_fee: number | null
          category: string
          competitiveness: string | null
          created_at: string
          deadline: string | null
          description: string
          eligibility: string
          equipment_needed: string | null
          fee_waiver_available: boolean | null
          format: string | null
          link_checked_at: string | null
          link_fail_count: number
          link_status: string
          id: string
          location: string | null
          organization: string
          pathway_unlocks: string[]
          related_orgs: string[]
          related_skills: string[]
          remote: boolean
          status: string
          tags: string[]
          title: string
          travel_required: boolean | null
          underrepresented: boolean
          updated_at: string
          url: string | null
          value_usd: number | null
        }
        Insert: {
          application_fee?: number | null
          category: string
          competitiveness?: string | null
          created_at?: string
          deadline?: string | null
          description: string
          eligibility: string
          equipment_needed?: string | null
          fee_waiver_available?: boolean | null
          format?: string | null
          link_checked_at?: string | null
          link_fail_count?: number
          link_status?: string
          id?: string
          location?: string | null
          organization: string
          pathway_unlocks?: string[]
          related_orgs?: string[]
          related_skills?: string[]
          remote?: boolean
          status?: string
          tags?: string[]
          title: string
          travel_required?: boolean | null
          underrepresented?: boolean
          updated_at?: string
          url?: string | null
          value_usd?: number | null
        }
        Update: {
          application_fee?: number | null
          category?: string
          competitiveness?: string | null
          created_at?: string
          deadline?: string | null
          description?: string
          eligibility?: string
          equipment_needed?: string | null
          fee_waiver_available?: boolean | null
          format?: string | null
          link_checked_at?: string | null
          link_fail_count?: number
          link_status?: string
          id?: string
          location?: string | null
          organization?: string
          pathway_unlocks?: string[]
          related_orgs?: string[]
          related_skills?: string[]
          remote?: boolean
          status?: string
          tags?: string[]
          title?: string
          travel_required?: boolean | null
          underrepresented?: boolean
          updated_at?: string
          url?: string | null
          value_usd?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          academic_interests: string[]
          age_range: string | null
          applying_with_financial_aid: boolean | null
          bio: string | null
          career_interests: string[]
          certifications: string[]
          cohort_id: string | null
          college_application_year: string | null
          college_notes: string | null
          country: string | null
          created_at: string
          display_name: string | null
          dream_colleges: string[]
          education_level: string | null
          extracurriculars: string[]
          foster_youth_status: boolean | null
          housing_insecure_status: boolean | null
          id: string
          immigration_status_note: string | null
          intended_major: string | null
          languages: string[]
          last_discovered_at: string | null
          location: string | null
          long_term_goals: string | null
          needs_full_ride: boolean | null
          onboarded: boolean
          professional_experience: string | null
          safety_colleges: string[]
          skills: string[]
          socioeconomic_info: string | null
          target_colleges: string[]
          updated_at: string
          zero_barrier_filter_enabled: boolean
          zero_barrier_filter_used: boolean
        }
        Insert: {
          academic_interests?: string[]
          age_range?: string | null
          applying_with_financial_aid?: boolean | null
          bio?: string | null
          career_interests?: string[]
          certifications?: string[]
          cohort_id?: string | null
          college_application_year?: string | null
          college_notes?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          dream_colleges?: string[]
          education_level?: string | null
          extracurriculars?: string[]
          foster_youth_status?: boolean | null
          housing_insecure_status?: boolean | null
          id: string
          immigration_status_note?: string | null
          intended_major?: string | null
          languages?: string[]
          last_discovered_at?: string | null
          location?: string | null
          long_term_goals?: string | null
          needs_full_ride?: boolean | null
          onboarded?: boolean
          professional_experience?: string | null
          safety_colleges?: string[]
          skills?: string[]
          socioeconomic_info?: string | null
          target_colleges?: string[]
          updated_at?: string
          zero_barrier_filter_enabled?: boolean
          zero_barrier_filter_used?: boolean
        }
        Update: {
          academic_interests?: string[]
          age_range?: string | null
          applying_with_financial_aid?: boolean | null
          bio?: string | null
          career_interests?: string[]
          certifications?: string[]
          cohort_id?: string | null
          college_application_year?: string | null
          college_notes?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          dream_colleges?: string[]
          education_level?: string | null
          extracurriculars?: string[]
          foster_youth_status?: boolean | null
          housing_insecure_status?: boolean | null
          id?: string
          immigration_status_note?: string | null
          intended_major?: string | null
          languages?: string[]
          last_discovered_at?: string | null
          location?: string | null
          long_term_goals?: string | null
          needs_full_ride?: boolean | null
          onboarded?: boolean
          professional_experience?: string | null
          safety_colleges?: string[]
          skills?: string[]
          socioeconomic_info?: string | null
          target_colleges?: string[]
          updated_at?: string
          zero_barrier_filter_enabled?: boolean
          zero_barrier_filter_used?: boolean
        }
        Relationships: []
      }
      system_events: {
        Row: {
          created_at: string
          detail: Json
          duration_ms: number | null
          event: string
          id: string
          ok: boolean
        }
        Insert: {
          created_at?: string
          detail?: Json
          duration_ms?: number | null
          event: string
          id?: string
          ok?: boolean
        }
        Update: {
          created_at?: string
          detail?: Json
          duration_ms?: number | null
          event?: string
          id?: string
          ok?: boolean
        }
        Relationships: []
      }
      user_opportunities: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          opportunity_id: string
          status: Database["public"]["Enums"]["opportunity_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          opportunity_id: string
          status?: Database["public"]["Enums"]["opportunity_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          opportunity_id?: string
          status?: Database["public"]["Enums"]["opportunity_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_opportunities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
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
          role?: Database["public"]["Enums"]["app_role"]
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
      counselor_cohort_stats: {
        Args: { _cohort_id: string }
        Returns: {
          deadlines_this_week: number
          strong_matches: number
          students_onboarded: number
          zero_barrier_users: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      catalog_count: { Args: never; Returns: number }
      impact_summary: {
        Args: never
        Returns: {
          students_served: number
          total_accepted: number
          total_applied: number
          total_matches: number
          zero_barrier_users: number
        }[]
      }
      redeem_cohort_code: { Args: { _code: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "user" | "counselor"
      opportunity_status: "saved" | "applied" | "accepted" | "declined"
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
      app_role: ["admin", "user", "counselor"],
      opportunity_status: ["saved", "applied", "accepted", "declined"],
    },
  },
} as const
