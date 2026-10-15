export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          event_name: string
          id: number
          occurred_at: string
          properties: NonNullable<Json>
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          event_name: string
          id?: never
          occurred_at?: string
          properties?: NonNullable<Json>
          user_id?: string | null
        }
        Update: {
          event_name?: string
          id?: never
          occurred_at?: string
          properties?: NonNullable<Json>
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          starts_at: string | null
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: NonNullable<Json>
          entity_id: string | null
          entity_type: string
          id: number
        }
        ComputedFields: never
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: NonNullable<Json>
          entity_id?: string | null
          entity_type: string
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: NonNullable<Json>
          entity_id?: string | null
          entity_type?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_confirmation_tokens: {
        Row: {
          booking_id: string
          confirmed_at: string | null
          created_at: string
          expires_at: string
          token_hash: string
        }
        ComputedFields: never
        Insert: {
          booking_id: string
          confirmed_at?: string | null
          created_at?: string
          expires_at: string
          token_hash: string
        }
        Update: {
          booking_id?: string
          confirmed_at?: string | null
          created_at?: string
          expires_at?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_confirmation_tokens_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_seats: {
        Row: {
          active: boolean
          booking_id: string
          created_at: string
          reserved_during: unknown
          seat_id: string
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          booking_id: string
          created_at?: string
          reserved_during: unknown
          seat_id: string
        }
        Update: {
          active?: boolean
          booking_id?: string
          created_at?: string
          reserved_during?: unknown
          seat_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_seats_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_seats_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "seats"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booking_date: string
          cancellation_reason: string | null
          cancelled_at: string | null
          confirmation_email_error: string | null
          confirmation_email_sent_at: string | null
          created_at: string
          duration_hours: number
          ends_at: string
          guest_email: string
          guest_name: string
          hold_expires_at: string | null
          id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          reservation_code: string
          seat_ids: string[]
          space: string
          start_time: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          subtotal_cents: number
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          booking_date: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmation_email_error?: string | null
          confirmation_email_sent_at?: string | null
          created_at?: string
          duration_hours: number
          ends_at: string
          guest_email: string
          guest_name: string
          hold_expires_at?: string | null
          id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          reservation_code: string
          seat_ids: string[]
          space?: string
          start_time: string
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          subtotal_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_date?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmation_email_error?: string | null
          confirmation_email_sent_at?: string | null
          created_at?: string
          duration_hours?: number
          ends_at?: string
          guest_email?: string
          guest_name?: string
          hold_expires_at?: string | null
          id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          reservation_code?: string
          seat_ids?: string[]
          space?: string
          start_time?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          subtotal_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      check_in_sessions: {
        Row: {
          booking_id: string
          checked_in_at: string
          checked_out_at: string | null
          created_at: string
          id: string
          overtime_charge_cents: number
          overtime_minutes: number
          qr_access_pass_id: string
          scheduled_end_at: string
          status: Database["public"]["Enums"]["check_in_status"]
          updated_at: string
          verified_by: string | null
        }
        ComputedFields: never
        Insert: {
          booking_id: string
          checked_in_at?: string
          checked_out_at?: string | null
          created_at?: string
          id?: string
          overtime_charge_cents?: number
          overtime_minutes?: number
          qr_access_pass_id: string
          scheduled_end_at: string
          status?: Database["public"]["Enums"]["check_in_status"]
          updated_at?: string
          verified_by?: string | null
        }
        Update: {
          booking_id?: string
          checked_in_at?: string
          checked_out_at?: string | null
          created_at?: string
          id?: string
          overtime_charge_cents?: number
          overtime_minutes?: number
          qr_access_pass_id?: string
          scheduled_end_at?: string
          status?: Database["public"]["Enums"]["check_in_status"]
          updated_at?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "check_in_sessions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_in_sessions_qr_access_pass_id_fkey"
            columns: ["qr_access_pass_id"]
            isOneToOne: false
            referencedRelation: "qr_access_passes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_in_sessions_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_business_metrics: {
        Row: {
          active_members: number
          available_seat_hours: number
          bookings_count: number
          checkins_count: number
          created_at: string
          daily_pass_revenue_cents: number
          hourly_revenue_cents: number
          metric_date: string
          monthly_revenue_cents: number
          occupied_seat_hours: number
          revenue_cents: number
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          active_members?: number
          available_seat_hours?: number
          bookings_count?: number
          checkins_count?: number
          created_at?: string
          daily_pass_revenue_cents?: number
          hourly_revenue_cents?: number
          metric_date: string
          monthly_revenue_cents?: number
          occupied_seat_hours?: number
          revenue_cents?: number
          updated_at?: string
        }
        Update: {
          active_members?: number
          available_seat_hours?: number
          bookings_count?: number
          checkins_count?: number
          created_at?: string
          daily_pass_revenue_cents?: number
          hourly_revenue_cents?: number
          metric_date?: string
          monthly_revenue_cents?: number
          occupied_seat_hours?: number
          revenue_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      flashcard_decks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_decks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_reviews: {
        Row: {
          card_id: string
          id: number
          rating: Database["public"]["Enums"]["flashcard_rating"]
          reviewed_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          card_id: string
          id?: never
          rating: Database["public"]["Enums"]["flashcard_rating"]
          reviewed_at?: string
          user_id?: string
        }
        Update: {
          card_id?: string
          id?: never
          rating?: Database["public"]["Enums"]["flashcard_rating"]
          reviewed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_reviews_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcard_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          back: string
          created_at: string
          deck_id: string
          front: string
          id: string
          position: number
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          back: string
          created_at?: string
          deck_id: string
          front: string
          id?: string
          position?: number
          updated_at?: string
        }
        Update: {
          back?: string
          created_at?: string
          deck_id?: string
          front?: string
          id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "flashcard_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_content: {
        Row: {
          body: NonNullable<Json>
          created_at: string
          created_by: string | null
          id: string
          published_at: string | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          body?: NonNullable<Json>
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: NonNullable<Json>
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_content_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_content_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_refunds: {
        Row: {
          amount_cents: number
          booking_id: string
          created_at: string
          currency: string
          failure_code: string | null
          failure_message: string | null
          finalized_at: string | null
          id: string
          idempotency_key: string
          payment_id: string
          provider_payload: NonNullable<Json>
          provider_refund_id: string | null
          reason: string
          status: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          amount_cents: number
          booking_id: string
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          finalized_at?: string | null
          id?: string
          idempotency_key: string
          payment_id: string
          provider_payload?: NonNullable<Json>
          provider_refund_id?: string | null
          reason?: string
          status: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          booking_id?: string
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          finalized_at?: string | null
          id?: string
          idempotency_key?: string
          payment_id?: string
          provider_payload?: NonNullable<Json>
          provider_refund_id?: string | null
          reason?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_refunds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          event_type: string
          id: string
          payload: NonNullable<Json>
          processed_at: string | null
          processing_error: string | null
          received_at: string
        }
        ComputedFields: never
        Insert: {
          event_type: string
          id: string
          payload: NonNullable<Json>
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
        }
        Update: {
          event_type?: string
          id?: string
          payload?: NonNullable<Json>
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          booking_id: string
          created_at: string
          currency: string
          failure_code: string | null
          failure_message: string | null
          id: string
          livemode: boolean | null
          method: Database["public"]["Enums"]["payment_method"]
          paid_at: string | null
          provider: string
          provider_checkout_id: string | null
          provider_payment_id: string | null
          provider_payment_intent_id: string | null
          provider_payment_method_id: string | null
          provider_status: string | null
          qr_expires_at: string | null
          refunded_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          amount_cents: number
          booking_id: string
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          livemode?: boolean | null
          method: Database["public"]["Enums"]["payment_method"]
          paid_at?: string | null
          provider?: string
          provider_checkout_id?: string | null
          provider_payment_id?: string | null
          provider_payment_intent_id?: string | null
          provider_payment_method_id?: string | null
          provider_status?: string | null
          qr_expires_at?: string | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          booking_id?: string
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          livemode?: boolean | null
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string | null
          provider?: string
          provider_checkout_id?: string | null
          provider_payment_id?: string | null
          provider_payment_intent_id?: string | null
          provider_payment_method_id?: string | null
          provider_status?: string | null
          qr_expires_at?: string | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          loyalty_points: number
          must_change_password: boolean
          phone: string | null
          role: Database["public"]["Enums"]["profile_role"]
          staff_permissions: Database["public"]["Enums"]["staff_permission"][]
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          is_active?: boolean
          loyalty_points?: number
          must_change_password?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          staff_permissions?: Database["public"]["Enums"]["staff_permission"][]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          loyalty_points?: number
          must_change_password?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          staff_permissions?: Database["public"]["Enums"]["staff_permission"][]
          updated_at?: string
        }
        Relationships: []
      }
      qr_access_passes: {
        Row: {
          booking_id: string
          created_at: string
          expires_at: string
          id: string
          last_scanned_at: string | null
          revoked_at: string | null
          token_hash: string
        }
        ComputedFields: never
        Insert: {
          booking_id: string
          created_at?: string
          expires_at: string
          id?: string
          last_scanned_at?: string | null
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          last_scanned_at?: string | null
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_access_passes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      seats: {
        Row: {
          code: string
          created_at: string
          hourly_rate_cents: number
          id: string
          is_active: boolean
          name: string
          seat_type: string
          status: Database["public"]["Enums"]["seat_status"]
          updated_at: string
          zone: string
        }
        ComputedFields: never
        Insert: {
          code: string
          created_at?: string
          hourly_rate_cents?: number
          id?: string
          is_active?: boolean
          name: string
          seat_type?: string
          status?: Database["public"]["Enums"]["seat_status"]
          updated_at?: string
          zone: string
        }
        Update: {
          code?: string
          created_at?: string
          hourly_rate_cents?: number
          id?: string
          is_active?: boolean
          name?: string
          seat_type?: string
          status?: Database["public"]["Enums"]["seat_status"]
          updated_at?: string
          zone?: string
        }
        Relationships: []
      }
      service_rate_plans: {
        Row: {
          category: string
          code: string
          created_at: string
          effective_from: string
          effective_until: string | null
          id: number
          is_active: boolean
          max_minutes: number | null
          min_minutes: number
          name: string
          price_cents: number
          sort_order: number
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          category?: string
          code: string
          created_at?: string
          effective_from?: string
          effective_until?: string | null
          id?: never
          is_active?: boolean
          max_minutes?: number | null
          min_minutes: number
          name: string
          price_cents: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          effective_from?: string
          effective_until?: string | null
          id?: never
          is_active?: boolean
          max_minutes?: number | null
          min_minutes?: number
          name?: string
          price_cents?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          completed: boolean
          completed_minutes: number | null
          created_at: string
          ended_at: string | null
          id: string
          notes: string | null
          planned_minutes: number
          started_at: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          completed?: boolean
          completed_minutes?: number | null
          created_at?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          planned_minutes: number
          started_at: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed?: boolean
          completed_minutes?: number | null
          created_at?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          planned_minutes?: number
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      walk_in_occupancies: {
        Row: {
          billable_minutes: number | null
          business_date: string
          charged_amount_cents: number | null
          created_at: string
          created_by: string
          ended_at: string | null
          ended_by: string | null
          guest_name: string | null
          id: string
          listed_price_cents: number | null
          notes: string | null
          payment_method: string | null
          payment_status: string
          price_override_reason: string | null
          rate_plan_id: number | null
          seat_id: string
          service_name: string | null
          started_at: string
          status: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          billable_minutes?: number | null
          business_date?: string
          charged_amount_cents?: number | null
          created_at?: string
          created_by: string
          ended_at?: string | null
          ended_by?: string | null
          guest_name?: string | null
          id?: string
          listed_price_cents?: number | null
          notes?: string | null
          payment_method?: string | null
          payment_status?: string
          price_override_reason?: string | null
          rate_plan_id?: number | null
          seat_id: string
          service_name?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          billable_minutes?: number | null
          business_date?: string
          charged_amount_cents?: number | null
          created_at?: string
          created_by?: string
          ended_at?: string | null
          ended_by?: string | null
          guest_name?: string | null
          id?: string
          listed_price_cents?: number | null
          notes?: string | null
          payment_method?: string | null
          payment_status?: string
          price_override_reason?: string | null
          rate_plan_id?: number | null
          seat_id?: string
          service_name?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "walk_in_occupancies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walk_in_occupancies_ended_by_fkey"
            columns: ["ended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walk_in_occupancies_rate_plan_id_fkey"
            columns: ["rate_plan_id"]
            isOneToOne: false
            referencedRelation: "service_rate_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walk_in_occupancies_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "seats"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_cancel_booking: {
        Args: { p_booking_id: string; p_reason?: string }
        Returns: undefined
      }
      cancel_booking: { Args: { p_booking_id: string }; Returns: undefined }
      checkout_walk_in: {
        Args: {
          p_charged_amount_cents?: number
          p_ended_at?: string
          p_override_reason?: string
          p_payment_method?: string
          p_payment_status?: string
          p_walk_in_id: string
        }
        Returns: {
          billable_minutes: number | null
          business_date: string
          charged_amount_cents: number | null
          created_at: string
          created_by: string
          ended_at: string | null
          ended_by: string | null
          guest_name: string | null
          id: string
          listed_price_cents: number | null
          notes: string | null
          payment_method: string | null
          payment_status: string
          price_override_reason: string | null
          rate_plan_id: number | null
          seat_id: string
          service_name: string | null
          started_at: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "walk_in_occupancies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_booking_from_token: {
        Args: { p_access_token_hash: string; p_token_hash: string }
        Returns: {
          booking_id: string
          confirmation_email_sent_at: string
          ends_at: string
          guest_email: string
          guest_name: string
          newly_confirmed: boolean
          reservation_code: string
          seat_ids: string[]
          starts_at: string
          subtotal_cents: number
        }[]
      }
      create_booking: {
        Args: {
          p_booking_date: string
          p_duration_hours: number
          p_guest_email: string
          p_guest_name: string
          p_seat_codes: string[]
          p_space: string
          p_start_time: string
        }
        Returns: {
          booking_date: string
          cancellation_reason: string | null
          cancelled_at: string | null
          confirmation_email_error: string | null
          confirmation_email_sent_at: string | null
          created_at: string
          duration_hours: number
          ends_at: string
          guest_email: string
          guest_name: string
          hold_expires_at: string | null
          id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          reservation_code: string
          seat_ids: string[]
          space: string
          start_time: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          subtotal_cents: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_booking_confirmation_token: {
        Args: { p_booking_id: string; p_token_hash: string; p_user_id: string }
        Returns: undefined
      }
      create_completed_walk_in: {
        Args: {
          p_charged_amount_cents?: number
          p_ended_at: string
          p_guest_name: string
          p_notes?: string
          p_override_reason?: string
          p_payment_method?: string
          p_payment_status?: string
          p_seat_code: string
          p_started_at: string
        }
        Returns: string
      }
      customer_update_booking: {
        Args: {
          p_booking_date: string
          p_booking_id: string
          p_seat_codes: string[]
          p_start_time: string
        }
        Returns: {
          booking_date: string
          cancellation_reason: string | null
          cancelled_at: string | null
          confirmation_email_error: string | null
          confirmation_email_sent_at: string | null
          created_at: string
          duration_hours: number
          ends_at: string
          guest_email: string
          guest_name: string
          hold_expires_at: string | null
          id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          reservation_code: string
          seat_ids: string[]
          space: string
          start_time: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          subtotal_cents: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_customer_booking_refund: {
        Args: {
          p_failure_code?: string
          p_failure_message?: string
          p_provider_payload?: Json
          p_provider_refund_id: string
          p_refund_id: string
          p_status: string
        }
        Returns: undefined
      }
      get_available_seats: {
        Args: { p_ends_at: string; p_starts_at: string }
        Returns: {
          code: string
          created_at: string
          hourly_rate_cents: number
          id: string
          is_active: boolean
          name: string
          seat_type: string
          status: Database["public"]["Enums"]["seat_status"]
          updated_at: string
          zone: string
        }[]
        SetofOptions: {
          from: "*"
          to: "seats"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_available_seats_for_booking: {
        Args: { p_booking_id: string; p_ends_at: string; p_starts_at: string }
        Returns: {
          code: string
          created_at: string
          hourly_rate_cents: number
          id: string
          is_active: boolean
          name: string
          seat_type: string
          status: Database["public"]["Enums"]["seat_status"]
          updated_at: string
          zone: string
        }[]
        SetofOptions: {
          from: "*"
          to: "seats"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_booking_confirmation_preview: {
        Args: { p_token_hash: string }
        Returns: {
          confirmed: boolean
          ends_at: string
          expires_at: string
          guest_email: string
          guest_name: string
          reservation_code: string
          seat_ids: string[]
          starts_at: string
          subtotal_cents: number
        }[]
      }
      get_business_report: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          available_seat_hours: number
          cash_revenue_cents: number
          checkins_count: number
          gcash_revenue_cents: number
          occupied_seat_hours: number
          other_revenue_cents: number
          outstanding_walk_in_cents: number
          qrph_revenue_cents: number
          report_date: string
          reservation_checkins: number
          reservation_count: number
          reservation_revenue_cents: number
          reservation_seat_hours: number
          revenue_cents: number
          total_visits: number
          walk_in_checkins: number
          walk_in_count: number
          walk_in_revenue_cents: number
          walk_in_seat_hours: number
        }[]
      }
      get_customer_booking_pass: {
        Args: { p_booking_id: string; p_user_id: string }
        Returns: {
          booking_id: string
          expires_at: string
          reservation_code: string
        }[]
      }
      get_kiosk_active_sessions: {
        Args: Record<PropertyKey, never>
        Returns: {
          booking_id: string
          checked_in_at: string
          guest_name: string
          scheduled_end: string
          seats: string[]
        }[]
      }
      get_kiosk_recent_activity: {
        Args: Record<PropertyKey, never>
        Returns: {
          activity_id: string
          activity_type: string
          booking_id: string
          guest_name: string
          occurred_at: string
          seats: string[]
        }[]
      }
      log_admin_access: { Args: { p_action?: string }; Returns: undefined }
      mark_booking_confirmation_email: {
        Args: { p_booking_id: string; p_error?: string }
        Returns: undefined
      }
      prepare_booking_pass_resend: {
        Args: { p_booking_id: string; p_user_id: string }
        Returns: {
          booking_id: string
          confirmation_email_sent_at: string
          ends_at: string
          guest_email: string
          guest_name: string
          reservation_code: string
          seat_ids: string[]
          starts_at: string
          subtotal_cents: number
        }[]
      }
      prepare_customer_booking_cancellation: {
        Args: { p_booking_id: string; p_user_id: string }
        Returns: {
          amount_cents: number
          booking_id: string
          idempotency_key: string
          payment_livemode: boolean
          provider_payment_id: string
          provider_refund_id: string
          refund_id: string
          refund_status: string
          requires_refund: boolean
          reservation_code: string
        }[]
      }
      prepare_paymongo_payment: {
        Args: { p_booking_id: string; p_user_id: string }
        Returns: {
          amount_cents: number
          booking_id: string
          ends_at: string
          guest_email: string
          guest_name: string
          livemode: boolean
          payment_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          provider_payment_intent_id: string
          provider_payment_method_id: string
          provider_status: string
          qr_expires_at: string
          reservation_code: string
          seat_ids: string[]
          starts_at: string
        }[]
      }
      process_kiosk_scan: {
        Args: { p_token_hash: string }
        Returns: {
          action: string
          booking_id: string
          guest_name: string
          reservation_code: string
          scanned_at: string
          scheduled_end: string
          scheduled_start: string
          seat_ids: string[]
        }[]
      }
      process_paymongo_event: {
        Args: {
          p_access_token_hash: string
          p_amount_cents: number
          p_currency: string
          p_event_id: string
          p_event_type: string
          p_livemode: boolean
          p_paid_at: string
          p_payload: Json
          p_payment_id: string
          p_payment_intent_id: string
        }
        Returns: {
          booking_id: string
          confirmation_email_sent_at: string
          ends_at: string
          guest_email: string
          guest_name: string
          newly_confirmed: boolean
          requires_review: boolean
          reservation_code: string
          seat_ids: string[]
          starts_at: string
          subtotal_cents: number
        }[]
      }
      process_paymongo_refund_event: {
        Args: {
          p_event_id: string
          p_event_type: string
          p_internal_refund_id?: string
          p_livemode: boolean
          p_payload: Json
          p_refund_id: string
          p_status: string
        }
        Returns: undefined
      }
      save_paymongo_qr: {
        Args: {
          p_booking_id: string
          p_livemode: boolean
          p_payment_intent_id: string
          p_payment_method_id: string
          p_provider_status: string
          p_qr_expires_at: string
          p_user_id: string
        }
        Returns: undefined
      }
      start_walk_in: {
        Args: { p_guest_name?: string; p_notes?: string; p_seat_code: string }
        Returns: string
      }
      sync_booking_account_email: {
        Args: { p_booking_id: string; p_user_id: string }
        Returns: string
      }
      toggle_walk_in_occupancy: {
        Args: { p_guest_name?: string; p_seat_code: string }
        Returns: boolean
      }
      void_walk_in: {
        Args: { p_reason: string; p_walk_in_id: string }
        Returns: undefined
      }
    }
    Enums: {
      booking_status:
        | "pending"
        | "confirmed"
        | "checked_in"
        | "completed"
        | "cancelled"
        | "declined"
        | "no_show"
      check_in_status: "checked_in" | "checked_out" | "overtime" | "no_show"
      content_status: "draft" | "published" | "archived"
      flashcard_rating: "learned" | "needs_review"
      payment_method: "gcash" | "qrph"
      payment_status:
        | "pending"
        | "processing"
        | "paid"
        | "failed"
        | "refunded"
        | "not_required"
      profile_role: "customer" | "staff" | "admin"
      seat_status: "available" | "reserved" | "occupied" | "maintenance"
      staff_permission: "seating" | "reservations" | "announcements"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      booking_status: [
        "pending",
        "confirmed",
        "checked_in",
        "completed",
        "cancelled",
        "declined",
        "no_show",
      ],
      check_in_status: ["checked_in", "checked_out", "overtime", "no_show"],
      content_status: ["draft", "published", "archived"],
      flashcard_rating: ["learned", "needs_review"],
      payment_method: ["gcash", "qrph"],
      payment_status: [
        "pending",
        "processing",
        "paid",
        "failed",
        "refunded",
        "not_required",
      ],
      profile_role: ["customer", "staff", "admin"],
      seat_status: ["available", "reserved", "occupied", "maintenance"],
      staff_permission: ["seating", "reservations", "announcements"],
    },
  },
} as const
