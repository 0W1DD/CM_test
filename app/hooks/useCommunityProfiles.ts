import { useQuery } from "@tanstack/react-query";
import { query } from "~/lib/naru";

export interface CommunityProfile {
  id: string;
  name: string;
  username: string;
  bio: string | null;
  profile_picture_url: string | null;
  created_at: string;
  updated_at: string;
  is_primary: boolean;
  user_group_key: string;
  user_role: "owner" | "moderator" | "member";
}

export const COMMUNITY_PROFILES_KEY = ["profiles"] as const;

/** Every active profile in the community (`profiles:list`), for signed-in members. */
export function useCommunityProfilesQuery(enabled = true) {
  return useQuery({
    queryKey: COMMUNITY_PROFILES_KEY,
    queryFn: () => query<CommunityProfile[]>("profiles:list"),
    staleTime: 30000,
    enabled,
  });
}

export function useCommunityProfiles() {
  const { data, isLoading, refetch } = useCommunityProfilesQuery();

  return {
    profiles: data ?? [],
    loading: isLoading,
    refetch,
  };
}
