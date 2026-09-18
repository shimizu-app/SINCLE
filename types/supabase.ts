// このファイルは自動生成です。手で編集しないでください。
//   npm run types:gen
// で再生成します（SUPABASE_ACCESS_TOKEN が必要）。
// 注意: Relationships はネスト select の型推論用だが、ここでは空配列にしてある。
// 完全な形が必要になったら types:gen で再生成すること。
// 手で定義するユニオン型は types/db.ts にあります。

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
      agenda_actions: {
        Row: {
          agenda_item_id: string
          assignee_id: string | null
          done: boolean
          id: string
          position: number
          text: string
        }
        Insert: {
          agenda_item_id: string
          assignee_id?: string | null
          done?: boolean
          id?: string
          position?: number
          text: string
        }
        Update: {
          agenda_item_id?: string
          assignee_id?: string | null
          done?: boolean
          id?: string
          position?: number
          text?: string
        }
        Relationships: []
      }
      agenda_items: {
        Row: {
          created_at: string
          decided_at: string | null
          decision: string | null
          dept: string
          id: string
          month: number
          participants: string[]
          scheduled_text: string | null
          state: string
          title: string
          workspace_id: string
          year: number
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decision?: string | null
          dept: string
          id?: string
          month: number
          participants?: string[]
          scheduled_text?: string | null
          state?: string
          title: string
          workspace_id: string
          year: number
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decision?: string | null
          dept?: string
          id?: string
          month?: number
          participants?: string[]
          scheduled_text?: string | null
          state?: string
          title?: string
          workspace_id?: string
          year?: number
        }
        Relationships: []
      }
      booking_links: {
        Row: {
          company_id: string
          confirmed_event_id: string | null
          created_at: string
          duration_min: number
          expires_at: string
          format: string
          id: string
          slots: Json
          token: string
          workspace_id: string
        }
        Insert: {
          company_id: string
          confirmed_event_id?: string | null
          created_at?: string
          duration_min?: number
          expires_at: string
          format: string
          id?: string
          slots: Json
          token: string
          workspace_id: string
        }
        Update: {
          company_id?: string
          confirmed_event_id?: string | null
          created_at?: string
          duration_min?: number
          expires_at?: string
          format?: string
          id?: string
          slots?: Json
          token?: string
          workspace_id?: string
        }
        Relationships: []
      }
      channel_members: {
        Row: {
          channel_id: string
          last_read_at: string | null
          member_id: string
        }
        Insert: {
          channel_id: string
          last_read_at?: string | null
          member_id: string
        }
        Update: {
          channel_id?: string
          last_read_at?: string | null
          member_id?: string
        }
        Relationships: []
      }
      channels: {
        Row: {
          color: string | null
          company_id: string | null
          created_at: string
          id: string
          kind: string
          name: string | null
          shape: string | null
          workspace_id: string
        }
        Insert: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          kind: string
          name?: string | null
          shape?: string | null
          workspace_id: string
        }
        Update: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          name?: string | null
          shape?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          archived_at: string | null
          comment: string | null
          created_at: string
          deal_type: string | null
          employees: number | null
          id: string
          industry: string | null
          name: string
          name_normalized: string
          owner_id: string | null
          primary_contact_id: string | null
          revenue: string | null
          stage_id: string | null
          tags: string[]
          tier: string | null
          tier_manual: string | null
          updated_at: string
          web: string | null
          workspace_id: string
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          comment?: string | null
          created_at?: string
          deal_type?: string | null
          employees?: number | null
          id?: string
          industry?: string | null
          name: string
          name_normalized?: string
          owner_id?: string | null
          primary_contact_id?: string | null
          revenue?: string | null
          stage_id?: string | null
          tags?: string[]
          tier?: string | null
          tier_manual?: string | null
          updated_at?: string
          web?: string | null
          workspace_id: string
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          comment?: string | null
          created_at?: string
          deal_type?: string | null
          employees?: number | null
          id?: string
          industry?: string | null
          name?: string
          name_normalized?: string
          owner_id?: string | null
          primary_contact_id?: string | null
          revenue?: string | null
          stage_id?: string | null
          tags?: string[]
          tier?: string | null
          tier_manual?: string | null
          updated_at?: string
          web?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          archived_at: string | null
          card_image_url: string | null
          company_id: string
          created_at: string
          dept: string | null
          email: string | null
          id: string
          mail_watch: boolean
          name: string
          phone: string | null
          title: string | null
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          card_image_url?: string | null
          company_id: string
          created_at?: string
          dept?: string | null
          email?: string | null
          id?: string
          mail_watch?: boolean
          name: string
          phone?: string | null
          title?: string | null
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          card_image_url?: string | null
          company_id?: string
          created_at?: string
          dept?: string | null
          email?: string | null
          id?: string
          mail_watch?: boolean
          name?: string
          phone?: string | null
          title?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          active: boolean
          amount: string | null
          company_id: string
          created_at: string
          id: string
          memo: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          amount?: string | null
          company_id: string
          created_at?: string
          id?: string
          memo?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          amount?: string | null
          company_id?: string
          created_at?: string
          id?: string
          memo?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      dm_messages: {
        Row: {
          author_id: string
          created_at: string
          id: string
          read_at: string | null
          text: string
          thread_id: string
          workspace_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          text: string
          thread_id: string
          workspace_id: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          text?: string
          thread_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      dm_threads: {
        Row: {
          created_at: string
          id: string
          member_a: string
          member_b: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_a: string
          member_b: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_a?: string
          member_b?: string
          workspace_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          company_id: string
          created_at: string
          id: string
          kind: string
          mime_type: string | null
          name: string
          note: string | null
          pinned: boolean
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
          workspace_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          kind?: string
          mime_type?: string | null
          name: string
          note?: string | null
          pinned?: boolean
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
          workspace_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          kind?: string
          mime_type?: string | null
          name?: string
          note?: string | null
          pinned?: boolean
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          duration_min: number
          format: string
          gcal_event_id: string | null
          id: string
          meet_url: string | null
          starts_at: string
          title: string
          workspace_id: string
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          duration_min?: number
          format?: string
          gcal_event_id?: string | null
          id?: string
          meet_url?: string | null
          starts_at: string
          title: string
          workspace_id: string
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          duration_min?: number
          format?: string
          gcal_event_id?: string | null
          id?: string
          meet_url?: string | null
          starts_at?: string
          title?: string
          workspace_id?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          access_token: string
          calendar_ids: Json
          created_at: string
          expires_at: string | null
          gmail_scope: string
          id: string
          last_sync_at: string | null
          member_id: string
          provider: string
          refresh_token: string | null
          scopes: string[]
          workspace_id: string
        }
        Insert: {
          access_token: string
          calendar_ids?: Json
          created_at?: string
          expires_at?: string | null
          gmail_scope?: string
          id?: string
          last_sync_at?: string | null
          member_id: string
          provider: string
          refresh_token?: string | null
          scopes?: string[]
          workspace_id: string
        }
        Update: {
          access_token?: string
          calendar_ids?: Json
          created_at?: string
          expires_at?: string | null
          gmail_scope?: string
          id?: string
          last_sync_at?: string | null
          member_id?: string
          provider?: string
          refresh_token?: string | null
          scopes?: string[]
          workspace_id?: string
        }
        Relationships: []
      }
      invite_links: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          max_uses: number
          token: string
          uses: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          max_uses?: number
          token: string
          uses?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          max_uses?: number
          token?: string
          uses?: number
          workspace_id?: string
        }
        Relationships: []
      }
      join_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          via: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string | null
          via: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          via?: string
          workspace_id?: string
        }
        Relationships: []
      }
      key_persons: {
        Row: {
          about: string | null
          city: string | null
          company_name: string | null
          contact_id: string | null
          created_at: string
          genre: string
          id: string
          kana: string | null
          layers: string[]
          met: string | null
          name: string
          network: string | null
          pref: string | null
          scope: string
          sub_genres: string[]
          tags: string[]
          title: string | null
          workspace_id: string
        }
        Insert: {
          about?: string | null
          city?: string | null
          company_name?: string | null
          contact_id?: string | null
          created_at?: string
          genre?: string
          id?: string
          kana?: string | null
          layers?: string[]
          met?: string | null
          name: string
          network?: string | null
          pref?: string | null
          scope?: string
          sub_genres?: string[]
          tags?: string[]
          title?: string | null
          workspace_id: string
        }
        Update: {
          about?: string | null
          city?: string | null
          company_name?: string | null
          contact_id?: string | null
          created_at?: string
          genre?: string
          id?: string
          kana?: string | null
          layers?: string[]
          met?: string | null
          name?: string
          network?: string | null
          pref?: string | null
          scope?: string
          sub_genres?: string[]
          tags?: string[]
          title?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      mails: {
        Row: {
          body: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          direction: string
          excerpt: string | null
          from_email: string | null
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          replied: boolean
          sent_at: string
          subject: string
          to_email: string | null
          workspace_id: string
        }
        Insert: {
          body?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          direction: string
          excerpt?: string | null
          from_email?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          replied?: boolean
          sent_at: string
          subject: string
          to_email?: string | null
          workspace_id: string
        }
        Update: {
          body?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          direction?: string
          excerpt?: string | null
          from_email?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          replied?: boolean
          sent_at?: string
          subject?: string
          to_email?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      memos: {
        Row: {
          color: string
          created_at: string
          id: string
          member_id: string
          pinned: boolean
          text: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          member_id: string
          pinned?: boolean
          text: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          member_id?: string
          pinned?: boolean
          text?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          author_id: string | null
          channel_id: string
          created_at: string
          id: string
          is_system: boolean
          mentions: string[]
          text: string
          workspace_id: string
        }
        Insert: {
          author_id?: string | null
          channel_id: string
          created_at?: string
          id?: string
          is_system?: boolean
          mentions?: string[]
          text: string
          workspace_id: string
        }
        Update: {
          author_id?: string | null
          channel_id?: string
          created_at?: string
          id?: string
          is_system?: boolean
          mentions?: string[]
          text?: string
          workspace_id?: string
        }
        Relationships: []
      }
      personal_todos: {
        Row: {
          created_at: string
          done: boolean
          due_at: string | null
          due_has_time: boolean
          id: string
          member_id: string
          priority: string
          title: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          due_at?: string | null
          due_has_time?: boolean
          id?: string
          member_id: string
          priority?: string
          title: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          due_at?: string | null
          due_has_time?: boolean
          id?: string
          member_id?: string
          priority?: string
          title?: string
          workspace_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          happened_at: string | null
          id: string
          key_person_id: string
          result: string
          to_company_id: string | null
          to_name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          happened_at?: string | null
          id?: string
          key_person_id: string
          result?: string
          to_company_id?: string | null
          to_name: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          happened_at?: string | null
          id?: string
          key_person_id?: string
          result?: string
          to_company_id?: string | null
          to_name?: string
          workspace_id?: string
        }
        Relationships: []
      }
      stages: {
        Row: {
          id: string
          name: string
          position: number
          workspace_id: string
        }
        Insert: {
          id?: string
          name: string
          position: number
          workspace_id: string
        }
        Update: {
          id?: string
          name?: string
          position?: number
          workspace_id?: string
        }
        Relationships: []
      }
      subtasks: {
        Row: {
          at: string | null
          done: boolean
          id: string
          position: number
          task_id: string
          text: string
        }
        Insert: {
          at?: string | null
          done?: boolean
          id?: string
          position?: number
          task_id: string
          text: string
        }
        Update: {
          at?: string | null
          done?: boolean
          id?: string
          position?: number
          task_id?: string
          text?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          done: boolean
          due_at: string | null
          due_has_time: boolean
          id: string
          priority: string
          share: string
          title: string
          workspace_id: string
        }
        Insert: {
          assignee_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          done?: boolean
          due_at?: string | null
          due_has_time?: boolean
          id?: string
          priority?: string
          share?: string
          title: string
          workspace_id: string
        }
        Update: {
          assignee_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          done?: boolean
          due_at?: string | null
          due_has_time?: boolean
          id?: string
          priority?: string
          share?: string
          title?: string
          workspace_id?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          avatar: Json
          cover: Json | null
          created_at: string
          email: string
          id: string
          is_admin: boolean
          name: string
          note: string | null
          role: string
          status: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          avatar?: Json
          cover?: Json | null
          created_at?: string
          email: string
          id?: string
          is_admin?: boolean
          name: string
          note?: string | null
          role?: string
          status?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          avatar?: Json
          cover?: Json | null
          created_at?: string
          email?: string
          id?: string
          is_admin?: boolean
          name?: string
          note?: string | null
          role?: string
          status?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          color: string
          created_at: string
          domain: string | null
          id: string
          name: string
          open_join: boolean
          shape: string
          slug: string
        }
        Insert: {
          color?: string
          created_at?: string
          domain?: string | null
          id?: string
          name: string
          open_join?: boolean
          shape?: string
          slug: string
        }
        Update: {
          color?: string
          created_at?: string
          domain?: string | null
          id?: string
          name?: string
          open_join?: boolean
          shape?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read_channel: { Args: { p_channel: string }; Returns: boolean }
      claim_membership: { Args: never; Returns: number }
      create_workspace: {
        Args: {
          p_avatar?: Json
          p_color?: string
          p_member_name?: string
          p_name: string
          p_open_join?: boolean
          p_role?: string
          p_shape?: string
          p_slug: string
          p_use_domain?: boolean
        }
        Returns: string
      }
      find_workspaces_by_domain: {
        Args: never
        Returns: {
          color: string
          id: string
          member_count: number
          name: string
          open_join: boolean
          requested: boolean
          shape: string
          slug: string
        }[]
      }
      get_booking: { Args: { p_token: string }; Returns: Json }
      in_dm_thread: { Args: { p_thread: string }; Returns: boolean }
      integration_status: {
        Args: never
        Returns: {
          calendar_ids: Json
          expires_at: string
          gmail_scope: string
          last_sync_at: string
          provider: string
          scopes: string[]
          workspace_id: string
        }[]
      }
      is_corporate_domain: { Args: { p_domain: string }; Returns: boolean }
      is_member: { Args: { ws: string }; Returns: boolean }
      is_slug_available: { Args: { p_slug: string }; Returns: boolean }
      is_ws_admin: { Args: { ws: string }; Returns: boolean }
      join_by_domain: {
        Args: { p_name?: string; p_workspace_id: string }
        Returns: string
      }
      join_via_invite: {
        Args: { p_name?: string; p_token: string }
        Returns: string
      }
      my_email: { Args: never; Returns: string }
      my_member_id: { Args: { ws: string }; Returns: string }
      normalize_company_name: { Args: { p_name: string }; Returns: string }
      ws_from_path: { Args: { p_name: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]

export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]

export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]
