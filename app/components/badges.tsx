// Badges (naru/queries/badges.ts): the featured one by a profile's name,
// and a profile's whole set, where its owner picks which one to feature.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage, mutate, query } from "~/lib/naru";

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string | null;
}

/** Every featured badge, by profile ID: one small call shared by all names. */
export function useFeaturedBadges() {
  return useQuery({
    queryKey: ["badges", "featured"],
    queryFn: () => query<Record<string, Badge>>("badges:featured"),
    staleTime: 5 * 60_000,
  });
}

/** The badge a profile features, by its name; nothing when it has none. */
export function FeaturedBadge({
  profileId,
  className = "",
}: {
  profileId: string;
  className?: string;
}) {
  const badge = useFeaturedBadges().data?.[profileId];
  if (!badge) return null;
  return (
    <span
      className={`profile-badge ${className}`}
      title={
        badge.description ? `${badge.name}: ${badge.description}` : badge.name
      }
    >
      <span aria-hidden>{badge.emoji}</span>
      <span>{badge.name}</span>
    </span>
  );
}

/**
 * A profile's badges on its page. Its owner taps one to feature it by the
 * name (tapping the featured one again shows none).
 */
export function ProfileBadges({
  profileId,
  own,
}: {
  profileId: string;
  own: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: badges = [] } = useQuery({
    queryKey: ["badges", "profile", profileId],
    queryFn: () =>
      query<(Badge & { featured: boolean })[]>("badges:ofProfile", {
        profile_id: profileId,
      }),
  });
  const feature = useMutation({
    mutationFn: async (badgeId: string | null) => {
      try {
        await mutate("badges:feature", {
          profile_id: profileId,
          badge_id: badgeId,
        });
      } catch (error) {
        throw new Error(errorMessage(error, "대표 뱃지를 바꾸지 못했습니다"));
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["badges"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  if (badges.length === 0) return null;
  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {badges.map((b) =>
          own ? (
            <button
              key={b.id}
              type="button"
              disabled={feature.isPending}
              onClick={() => feature.mutate(b.featured ? null : b.id)}
              className={`profile-badge profile-badge-lg ${b.featured ? "is-featured" : ""}`}
              title={b.description ?? b.name}
              aria-pressed={b.featured}
            >
              <span aria-hidden>{b.emoji}</span>
              <span>{b.name}</span>
            </button>
          ) : (
            <span
              key={b.id}
              className={`profile-badge profile-badge-lg ${b.featured ? "is-featured" : ""}`}
              title={b.description ?? b.name}
            >
              <span aria-hidden>{b.emoji}</span>
              <span>{b.name}</span>
            </span>
          ),
        )}
      </div>
      {own && (
        <p className="text-xs text-white/80">
          뱃지를 누르면 이름 옆에 보일 대표 뱃지가 됩니다.
        </p>
      )}
    </div>
  );
}
