// Shapes the admin pages share.

/** An application as `applications:list` and `applications:get` answer it. */
export interface ReviewedApplication {
  id: string;
  status: "pending" | "approved" | "rejected";
  profile_name: string;
  profile_username: string;
  message: string | null;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  applicant: { profile_id: string | null };
  reviewed_by: { profile_id: string | null } | null;
  attachments: Array<{
    id: string;
    image_id: string;
    image_url: { url: string };
  }>;
  is_own?: boolean;
}

export const APPLICATIONS_KEY = ["applications"] as const;

/** The settings as `community:settings` answers them. */
export interface CommunitySettings {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  banner_image_url: string | null;
  banner_image_id: string | null;
  theme_key_color: string | null;
  gate_html: string | null;
  gate_image_id: string | null;
  gate_image_url: string | null;
  is_set_up: boolean;
  starts_at: string | null;
  ends_at: string | null;
  is_recruiting: boolean;
  recruiting_starts_at: string | null;
  recruiting_ends_at: string | null;
  minimum_birth_year: number | null;
  mute_new_members: boolean;
  show_all_replies: boolean;
  bump_on_reply: boolean;
  auto_approve: boolean;
}
