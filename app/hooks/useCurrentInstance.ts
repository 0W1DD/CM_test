import { useQuery } from "@tanstack/react-query";
import { useSession } from "~/hooks/useSession";
import { query } from "~/lib/naru";

interface PublicInstance {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  banner_image_url: string | null;
  theme_key_color: string | null;
  is_set_up: boolean;
}

/**
 * The community: from the member's session when signed in, else as any
 * visitor sees it (`me:instance`).
 */
export function useCurrentInstance() {
  const session = useSession();
  const publicInstance = useQuery({
    queryKey: ["instance"],
    queryFn: () => query<PublicInstance>("me:instance"),
    enabled: !session.isLoading && !session.data,
    staleTime: 15 * 60 * 1000,
  });
  const currentInstance = session.data?.instance ?? null;
  const instance = currentInstance ?? publicInstance.data ?? null;
  const role = currentInstance?.role ?? null;

  return {
    currentInstance,
    instanceName: instance?.name || "",
    instanceSlug: instance?.slug || "",
    userRole: role,
    isOwner: role === "owner",
    isModerator: role === "moderator" || role === "owner",
    showAllReplies: currentInstance?.show_all_replies ?? false,
    themeKeyColor: instance?.theme_key_color ?? null,
    isLoading: session.isLoading || publicInstance.isLoading,
    refetch: session.refetch,
  };
}
