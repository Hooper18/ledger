// Auto-generated types for Supabase tables.
// Run `supabase gen types typescript` to regenerate after schema changes.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
    Tables: {
      users_profile: {
        Row: {
          id: string
          preferred_currency: string
          default_currency: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          preferred_currency?: string
          default_currency?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          preferred_currency?: string
          default_currency?: string
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          type: string
          amount: number
          currency: string
          category_id: string
          description: string | null
          date: string
          exchange_rate: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          amount: number
          currency: string
          category_id: string
          description?: string | null
          date: string
          exchange_rate?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          type?: string
          amount?: number
          currency?: string
          category_id?: string
          description?: string | null
          date?: string
          exchange_rate?: number | null
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          type: string
          icon: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: string
          icon?: string
          created_at?: string
        }
        Update: {
          name?: string
          type?: string
          icon?: string
        }
      }
      budgets: {
        Row: {
          id: string
          user_id: string
          category_id: string | null
          amount: number
          currency: string
          period: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category_id?: string | null
          amount: number
          currency: string
          period: string
          created_at?: string
        }
        Update: {
          category_id?: string | null
          amount?: number
          currency?: string
          period?: string
        }
      }
    }
  }
}
