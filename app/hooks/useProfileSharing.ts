import { useCallback, useEffect, useState } from "react";
import { mutate, query } from "~/lib/naru";
import type { SharedUser } from "~/types/profile";

/** Who a profile is shared with (`profiles:users`), and sharing it. */
export function useProfileSharing(profileId: string) {
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSharedUsers = useCallback(async () => {
    if (!profileId) return;

    setLoading(true);
    try {
      const result = await query<{ users: SharedUser[] }>("profiles:users", {
        profile_id: profileId,
      });
      setSharedUsers(result.users ?? []);
    } catch {
      setSharedUsers([]);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  const addUser = async (
    profileId: string,
    username: string,
    role: "admin",
  ) => {
    await mutate("profiles:addUser", { profile_id: profileId, username, role });
    await fetchSharedUsers();
  };

  const removeUser = async (profileId: string, sharedProfileId: string) => {
    await mutate("profiles:removeUser", {
      profile_id: profileId,
      shared_profile_id: sharedProfileId,
    });
    await fetchSharedUsers();
  };

  const reload = () => {
    fetchSharedUsers();
  };

  useEffect(() => {
    fetchSharedUsers();
  }, [fetchSharedUsers]);

  return {
    sharedUsers,
    loading,
    addUser,
    removeUser,
    reload,
  };
}
