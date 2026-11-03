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
  custom_css: string | null;
  owner_files: boolean;
  gate_html: string | null;
  gate_image_url: string | null;
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
    // A sub-owner (부소유자) may do what the owner does; only handing the
    // community over and changing the owner stay the owner's.
    isOwner: role === "owner" || role === "co_owner",
    isRealOwner: role === "owner",
    isModerator:
      role === "moderator" || role === "owner" || role === "co_owner",
    showAllReplies: currentInstance?.show_all_replies ?? false,
    themeKeyColor: instance?.theme_key_color ?? null,
    // The site owner's own look: 사용자 CSS and the /_owner/ files, once the
    // community is known (the page's head has both until then).
    customCss: instance?.custom_css ?? null,
    ownerFiles: instance?.owner_files ?? false,
    lookLoaded: instance !== null,
    // The front gate (components/front-gate.tsx).
    gateHtml: instance?.gate_html ?? null,
    gateImageUrl: instance?.gate_image_url ?? null,
    isLoading: session.isLoading || publicInstance.isLoading,
    refetch: session.refetch,
  };
}
