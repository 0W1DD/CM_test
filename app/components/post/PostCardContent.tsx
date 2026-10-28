import { AlertTriangle, Eye } from "lucide-react";
import type MarkdownIt from "markdown-it";
import { type MouseEvent, useState } from "react";
import { useNavigate } from "react-router";

interface PostCardContentProps {
  content: string;
  contentWarning?: string | null;
  md: MarkdownIt;
  isReply?: boolean;
  showContentWarningContent?: boolean;
  onToggleContentWarning?: (show: boolean) => void;
}

export function PostCardContent({
  content,
  contentWarning,
  md,
  isReply = false,
  showContentWarningContent: externalShowContentWarningContent,
  onToggleContentWarning,
}: PostCardContentProps) {
  const [
    internalShowContentWarningContent,
    setInternalShowContentWarningContent,
  ] = useState(false);

  const navigate = useNavigate();

  // Links into the community (#tags, @mentions) open in the app without
  // reloading the page; others, and clicks with a modifier, as usual.
  const openInApp = (event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link =
      event.target instanceof Element ? event.target.closest("a") : null;
    const href = link?.getAttribute("href");
    if (!href?.startsWith("/") || href.startsWith("//") || link?.target) return;
    event.preventDefault();
    navigate(href);
  };

  const showContentWarningContent =
    externalShowContentWarningContent ?? internalShowContentWarningContent;
  const setShowContentWarningContent =
    onToggleContentWarning ?? setInternalShowContentWarningContent;

  // Content Warning handling
  if (contentWarning && !showContentWarningContent) {
    return (
      <div
        className={`${
          isReply ? "my-1" : "my-2"
        } bg-accent border border-border rounded-lg p-4 text-center`}
      >
        <div className="flex items-center justify-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <span
            className={`${isReply ? "text-xs" : "text-sm"} font-medium text-foreground`}
          >
            콘텐츠 경고
          </span>
        </div>
        <p
          className={`${isReply ? "text-xs" : "text-sm"} text-muted-foreground mb-3`}
        >
          {contentWarning}
        </p>
        <button
          type="button"
          onClick={() => setShowContentWarningContent(true)}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <Eye className="h-4 w-4" />
          <span>콘텐츠 보기</span>
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Only catches clicks on the links inside, which keep their own keyboard use. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: see above */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: see above */}
      <div
        className={`post-body prose dark:prose-invert ${
          isReply ? "prose-sm text-[14px]" : "prose-sm text-[15px]"
        } max-w-none text-foreground leading-relaxed ${isReply ? "my-1" : "my-2"}`}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized html
        dangerouslySetInnerHTML={{ __html: md.render(content) }}
        onClick={openInApp}
      />

      {/* Show a small indicator if content warning was revealed */}
      {contentWarning && showContentWarningContent && (
        <div
          className={`${isReply ? "mt-1" : "mt-2"} flex items-center gap-1 text-muted-foreground`}
        >
          <AlertTriangle className="h-3 w-3" />
          <span className="text-xs">경고: {contentWarning}</span>
        </div>
      )}
    </>
  );
}
