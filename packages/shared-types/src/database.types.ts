// Generated placeholder — replace with: pnpm db:types
// (pnpm supabase gen types typescript --project-id <id> --schema api > packages/shared-types/src/database.types.ts)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  api: {
    Views: {
      v_me: {
        Row: {
          user_id: string;
          status: string;
          theme: string;
          person: Json;
          permissions: string[];
          roles: Json[];
        };
      };
      v_my_permissions: {
        Row: { permission_code: string };
      };
      v_my_notifications: {
        Row: {
          id: string;
          created_at: string;
          kind: string;
          title: string;
          body: string | null;
          link: string | null;
          read_at: string | null;
        };
      };
    };
    Functions: {
      me: { Args: Record<never, never>; Returns: Json };
      notifications_mark_read: { Args: { p_ids: string[] }; Returns: void };
    };
  };
}
