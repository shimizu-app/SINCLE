// このファイルは自動生成です。手で編集しないでください。
//   SUPABASE_ACCESS_TOKEN=sbp_xxx npm run types:gen
// 手で定義するユニオン型は types/db.ts にあります。

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
        Relationships: [
          {
            foreignKeyName: "agenda_actions_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_actions_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "agenda_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "booking_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_links_confirmed_event_id_fkey"
            columns: ["confirmed_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "channels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "companies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "dm_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "dm_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "dm_threads_member_a_fkey"
            columns: ["member_a"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_threads_member_b_fkey"
            columns: ["member_b"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_threads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "integrations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "invite_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "join_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "key_persons_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_persons_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "mails_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mails_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "memos_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memos_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "personal_todos_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_todos_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "referrals_key_person_id_fkey"
            columns: ["key_person_id"]
            isOneToOne: false
            referencedRelation: "key_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_to_company_id_fkey"
            columns: ["to_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "stages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      approve_join_request: { Args: { p_request_id: string }; Returns: string }
      calendar_items: {
        Args: {
          p_from: string
          p_scope?: string
          p_to: string
          p_workspace_id: string
        }
        Returns: {
          assignee_id: string
          at: string
          company_name: string
          done: boolean
          has_time: boolean
          id: string
          kind: string
          priority: string
          share: string
          title: string
        }[]
      }
      can_read_channel: { Args: { p_channel: string }; Returns: boolean }
      claim_membership: { Args: never; Returns: number }
      company_facets: {
        Args: { p_workspace_id: string }
        Returns: {
          count: number
          kind: string
          value: string
        }[]
      }
      company_timeline: {
        Args: {
          p_company_id: string
          p_filter?: string
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          at: string
          author_avatar: Json
          author_name: string
          body: string
          direction: string
          done: boolean
          id: string
          kind: string
          title: string
        }[]
      }
      complete_deal: {
        Args: { p_deal_id: string; p_note?: string }
        Returns: undefined
      }
      create_group_channel: {
        Args: {
          p_color?: string
          p_members?: string[]
          p_name: string
          p_shape?: string
          p_workspace_id: string
        }
        Returns: string
      }
      create_invite_link: {
        Args: { p_days?: number; p_max_uses?: number; p_workspace_id: string }
        Returns: {
          expires_at: string
          max_uses: number
          token: string
        }[]
      }
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
      customer_counts: {
        Args: { p_workspace_id: string }
        Returns: {
          companies: number
          open_tasks: number
          tier_a: number
          unreplied_mails: number
        }[]
      }
      find_similar_companies: {
        Args: { p_name: string; p_workspace_id: string }
        Returns: {
          contact_count: number
          employees: number
          exact: boolean
          id: string
          industry: string
          name: string
          tier: string
        }[]
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
      key_person_facets: {
        Args: { p_workspace_id: string }
        Returns: {
          count: number
          kind: string
          value: string
        }[]
      }
      list_channels: {
        Args: { p_workspace_id: string }
        Returns: {
          color: string
          company_id: string
          company_industry: string
          company_name: string
          id: string
          kind: string
          last_at: string
          last_is_system: boolean
          last_text: string
          member_count: number
          name: string
          shape: string
          unread: number
        }[]
      }
      list_deals: {
        Args: { p_sort?: string; p_workspace_id: string }
        Returns: {
          amount: string
          company_id: string
          company_industry: string
          company_name: string
          contact_name: string
          days_since_update: number
          deal_type: string
          id: string
          memo: string
          open_task_count: number
          owner_avatar: Json
          owner_id: string
          owner_name: string
          status: string
          updated_at: string
        }[]
      }
      list_dm_threads: {
        Args: { p_workspace_id: string }
        Returns: {
          id: string
          last_at: string
          last_text: string
          other_avatar: Json
          other_id: string
          other_name: string
          other_role: string
          unread: number
        }[]
      }
      list_key_persons: {
        Args: {
          p_genres?: string[]
          p_layers?: string[]
          p_prefs?: string[]
          p_scopes?: string[]
          p_workspace_id: string
        }
        Returns: {
          about: string
          city: string
          company_name: string
          genre: string
          id: string
          kana: string
          layers: string[]
          met: string
          name: string
          network: string
          pref: string
          referral_count: number
          scope: string
          sub_genres: string[]
          tags: string[]
          title: string
        }[]
      }
      list_members: {
        Args: { p_workspace_id: string }
        Returns: {
          avatar: Json
          company_count: number
          email: string
          id: string
          is_admin: boolean
          is_me: boolean
          name: string
          note: string
          open_task_count: number
          role: string
          status: string
        }[]
      }
      list_tasks: {
        Args: { p_assignee?: string; p_done?: boolean; p_workspace_id: string }
        Returns: {
          assignee_avatar: Json
          assignee_id: string
          assignee_name: string
          company_id: string
          company_name: string
          contact_name: string
          created_at: string
          done: boolean
          due_at: string
          due_has_time: boolean
          id: string
          priority: string
          share: string
          subtask_done: number
          subtask_total: number
          title: string
        }[]
      }
      log_activity: {
        Args: { p_company_id: string; p_text: string }
        Returns: string
      }
      mark_channel_read: { Args: { p_channel_id: string }; Returns: undefined }
      mark_dm_read: { Args: { p_thread_id: string }; Returns: undefined }
      my_admin_workspace_ids: { Args: never; Returns: string[] }
      my_channel_ids: { Args: never; Returns: string[] }
      my_dm_thread_ids: { Args: never; Returns: string[] }
      my_email: { Args: never; Returns: string }
      my_member_id: { Args: { ws: string }; Returns: string }
      my_member_ids: { Args: never; Returns: string[] }
      my_workspace_ids: { Args: never; Returns: string[] }
      normalize_company_name: { Args: { p_name: string }; Returns: string }
      open_dm: {
        Args: { p_other_id: string; p_workspace_id: string }
        Returns: string
      }
      recompute_company_tier: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      register_contact: {
        Args: {
          p_address?: string
          p_comment?: string
          p_company_id?: string
          p_company_name: string
          p_contact_name?: string
          p_deal_memo?: string
          p_deal_type?: string
          p_dept?: string
          p_email?: string
          p_employees?: number
          p_industry?: string
          p_make_primary?: boolean
          p_phone?: string
          p_revenue?: string
          p_tier_manual?: string
          p_title?: string
          p_web?: string
          p_workspace_id: string
        }
        Returns: Json
      }
      reject_join_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      search_companies: {
        Args: {
          p_deal_type?: string
          p_industry?: string
          p_limit?: number
          p_q?: string
          p_sort?: string
          p_tier?: string
          p_workspace_id: string
        }
        Returns: {
          comment: string
          contact_count: number
          created_at: string
          deal_status: string
          deal_type: string
          deal_updated_at: string
          employees: number
          id: string
          industry: string
          name: string
          open_task_count: number
          primary_contact_name: string
          primary_contact_title: string
          stage_name: string
          stage_position: number
          stage_total: number
          tags: string[]
          tier: string
          updated_at: string
        }[]
      }
      size_score: { Args: { p_employees: number }; Returns: number }
      tier_from_score: { Args: { p_total: number }; Returns: string }
      title_score: { Args: { p_title: string }; Returns: number }
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
