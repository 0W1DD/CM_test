import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { SESSION_KEY, type Session, useSession } from "~/hooks/useSession";
import { errorMessage, mutate, signIn, signOut } from "~/lib/naru";
import { useCurrentProfileState } from "~/providers/CurrentProfileProvider";

import type { CreateProfileRequest, Profile } from "~/types/profile";

interface AuthState {
  /** The signed-in Naru member, or null for a visitor. */
  user: Session | null;
  currentProfile: Profile | null;
  availableProfiles: Profile[];
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Signed in and an approved member of the community. */
  belongsToCurrentInstance: boolean;
  /** Where a signed-in non-member applies (commung's console apply page). */
  consoleUrl: string;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => void;
  switchProfile: (profileId: string) => Promise<void>;
  createProfile: (profileData: CreateProfileRequest) => Promise<Profile>;
  refreshProfiles: () => void;
}

export function useAuth(): AuthState {
  const queryClient = useQueryClient();
  const { data: user, isLoading, refetch: refetchSession } = useSession();
  const availableProfiles = user?.profiles ?? [];

  // Use shared current profile state
  const {
    currentProfileId,
    setCurrentProfileId,
    hasSetInitialProfile,
    setHasSetInitialProfile,
  } = useCurrentProfileState();

  // Get current profile from available profiles, defaulting to primary profile
  // A remembered profile that is gone (another account, deleted) falls back
  // to the primary one too.
  const currentProfile =
    (currentProfileId &&
      availableProfiles.find((profile) => profile.id === currentProfileId)) ||
    availableProfiles.find((profile) => profile.is_primary) ||
    availableProfiles[0];

  // Set initial profile to primary when profiles are loaded (only once),
  // unless the profile remembered from before a reload is still ours.
  useEffect(() => {
    const remembered =
      currentProfileId !== null &&
      availableProfiles.some((profile) => profile.id === currentProfileId);
    if (availableProfiles.length > 0 && !remembered && !hasSetInitialProfile) {
      const primaryProfile = availableProfiles.find(
        (profile) => profile.is_primary,
      );
      const initialProfile = primaryProfile || availableProfiles[0];
      if (initialProfile) {
        setCurrentProfileId(initialProfile.id);
        setHasSetInitialProfile(true);
      }
    }
  }, [
    availableProfiles,
    currentProfileId,
    hasSetInitialProfile,
    setCurrentProfileId,
    setHasSetInitialProfile,
  ]);

  const logout = async () => {
    try {
      await signOut();
    } finally {
      queryClient.setQueryData(SESSION_KEY, null);
      queryClient.invalidateQueries();
    }
  };

  const switchProfile = async (profileId: string) => {
    // Verify the profile exists in available profiles
    const targetProfile = availableProfiles.find(
      (profile) => profile.id === profileId,
    );
    if (!targetProfile) {
      toast.error("유효하지 않은 프로필입니다");
      return;
    }

    setCurrentProfileId(profileId);

    toast.success("프로필 전환이 완료되었습니다!");
  };

  const createProfile = async (
    profileData: CreateProfileRequest,
  ): Promise<Profile> => {
    try {
      const profile = await mutate<Profile>("profiles:create", profileData);
      queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      toast.success("프로필이 성공적으로 생성되었습니다!");
      return profile;
    } catch (error) {
      toast.error(errorMessage(error, "프로필 생성에 실패했습니다"));
      throw error;
    }
  };

  const refetch = useCallback(() => {
    refetchSession();
  }, [refetchSession]);

  return {
    user: user || null,
    currentProfile: currentProfile || null,
    availableProfiles,
    isLoading,
    isAuthenticated: !!user,
    belongsToCurrentInstance: !!user?.is_member,
    consoleUrl: "/apply",
    login: signIn,
    logout,
    refetch,
    switchProfile,
    createProfile,
    refreshProfiles: refetch,
  };
}
