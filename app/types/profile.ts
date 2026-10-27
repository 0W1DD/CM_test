// Local Profile type definitions
export interface Profile {
  id: string;
  name: string;
  username: string;
  bio: string | null;
  profile_picture_url: string | null;
  created_at: string;
  updated_at: string;
  active?: string | null;
  is_active?: boolean;
  is_primary?: boolean;
  user_group?: string;
  post_count?: number;
  // Online status fields
  online_status_visible?: boolean;
  last_active_at?: string | null;
  // Shared profile fields
  is_owned?: boolean;
  role?: "owner" | "admin";
}

// Shared profile types
export interface SharedUser {
  primary_profile_id: string | null;
  profiles: {
    id: string;
    name: string;
    username: string;
    profile_picture_url: string | null;
    is_primary: boolean;
  }[];
  role: "owner" | "admin";
  added_at: string;
}

export interface ShareProfileRequest {
  username: string;
  role: "admin";
}

// Component props interfaces
export interface CreateProfileRequest {
  name: string;
  username: string;
  bio?: string;
  is_primary?: boolean;
  profile_picture_id?: string;
}
