import { useEffect, useMemo, useState } from "react";
import { mutate, subscribe } from "~/lib/naru";

interface OnlineStatusResponse {
  profile_id: string;
  is_online: boolean;
  /** When the profile stops counting as online without another heartbeat. */
  online_until: string | null;
}

/**
 * Online status for a list of profile IDs, kept live (`profiles:onlineStatus`
 * re-runs whenever a heartbeat is written); a profile drops offline on time
 * from its `online_until`, without asking again.
 */
export function useOnlineStatus(profileIds: string[]) {
  const key = useMemo(
    () => [...new Set(profileIds)].sort().join(","),
    [profileIds],
  );
  const [statuses, setStatuses] = useState<OnlineStatusResponse[] | undefined>(
    undefined,
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!key) {
      setStatuses([]);
      return;
    }
    setStatuses(undefined);
    return subscribe<OnlineStatusResponse[]>(
      "profiles:onlineStatus",
      { profile_ids: key.split(",") },
      (result) => {
        setNow(Date.now());
        setStatuses(result);
      },
      () => setStatuses([]),
    );
  }, [key]);

  // Re-evaluates `online_until` as time passes; no request.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const data = useMemo(
    () =>
      statuses?.map((status) => ({
        ...status,
        is_online:
          status.is_online &&
          status.online_until !== null &&
          Date.parse(status.online_until) > now,
      })),
    [statuses, now],
  );

  return { data, isLoading: key !== "" && statuses === undefined };
}

/**
 * Hook to get online status for a single profile
 */
export function useProfileOnlineStatus(profileId: string | undefined) {
  const ids = useMemo(() => (profileId ? [profileId] : []), [profileId]);
  const { data } = useOnlineStatus(ids);

  if (!profileId || !data) {
    return false;
  }

  return (
    data.find((status) => status.profile_id === profileId)?.is_online ?? false
  );
}

/** How often a visible page reports its acting profile active. */
const HEARTBEAT_MS = 2 * 60 * 1000;

/**
 * Reports `profileId` active while the page is visible
 * (`profiles:heartbeat`), as commung's timeline reads did; mount it once in
 * the layout with the current profile.
 */
export function useActivityHeartbeat(profileId: string | null | undefined) {
  useEffect(() => {
    if (!profileId) return;
    const beat = () => {
      if (document.visibilityState === "visible")
        mutate("profiles:heartbeat", { profile_id: profileId }).catch(() => {});
    };
    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [profileId]);
}
