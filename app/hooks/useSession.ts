import { useQuery } from "@tanstack/react-query";
import { query } from "~/lib/naru";
import type { Profile } from "~/types/profile";

export interface SessionInstance {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  banner_image_url: string | null;
  theme_key_color: string | null;
  is_set_up: boolean;
  role: "owner" | "moderator" | "member" | null;
  starts_at: string | null;
  ends_at: string | null;
  is_recruiting: boolean;
  recruiting_starts_at: string | null;
  recruiting_ends_at: string | null;
  minimum_birth_year: number | null;
  show_all_replies: boolean;
  bump_on_reply: boolean;
}

/** The signed-in member as the site's code sees them (`me:session`). */
export interface Session {
  id: string;
  role: "owner" | "moderator" | "member" | null;
  is_member: boolean;
  application: {
    id: string;
    status: "pending" | "approved" | "rejected";
    rejection_reason: string | null;
    created_at: string;
  } | null;
  instance: SessionInstance;
  profiles: Profile[];
}

export const SESSION_KEY = ["session"] as const;

/** The member's session, or null for a visitor. */
export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: () => query<Session | null>("me:session"),
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}
