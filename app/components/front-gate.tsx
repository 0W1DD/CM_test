import DOMPurify from "dompurify";
import { type ReactNode, useMemo } from "react";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";

/**
 * The front gate: the community's picture and the owner's HTML, shown to a
 * visitor who is not a member yet, with the sign-in or apply button below
 * (home.tsx); `fallback` when the owner set neither. The HTML is sanitized
 * here, as it is shown: formatting, links and pictures stay; scripts, event
 * handlers, forms and frames go.
 */
export function FrontGate({
  action,
  fallback,
}: {
  action: ReactNode;
  fallback: ReactNode;
}) {
  const { gateHtml, gateImageUrl, instanceName } = useCurrentInstance();
  const html = useMemo(
    () =>
      gateHtml
        ? DOMPurify.sanitize(gateHtml, {
            USE_PROFILES: { html: true },
            FORBID_TAGS: ["style", "form", "input", "button", "textarea"],
          })
        : "",
    [gateHtml],
  );
  if (!html && !gateImageUrl) return fallback;
  return (
    <div className="space-y-4 text-center">
      {gateImageUrl && (
        <img
          src={gateImageUrl}
          alt={instanceName}
          className="mx-auto max-h-80 w-auto rounded-2xl object-contain"
        />
      )}
      {html && (
        <div
          className="prose prose-sm dark:prose-invert mx-auto max-w-none text-foreground"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by DOMPurify above
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
      <div className="flex justify-center pt-4">{action}</div>
    </div>
  );
}
