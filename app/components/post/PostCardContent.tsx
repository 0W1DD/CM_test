import { AlertTriangle, Eye } from "lucide-react";
import type MarkdownIt from "markdown-it";
import {
  createContext,
  type MouseEvent,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { WeatherCard } from "~/components/weather-card";
import { useNavigate } from "react-router";

/** How many lines a long post shows before "더보기". */
const LINES = 4;

/** Inside it (a post's own page), posts show in full instead of folding long text. */
export const FullPostContext = createContext(false);

interface PostCardContentProps {
  content: string;
  contentWarning?: string | null;
  md: MarkdownIt;
  isReply?: boolean;
  showContentWarningContent?: boolean;
  onToggleContentWarning?: (show: boolean) => void;
  /** Fold text longer than four lines behind a "더보기" button. */
  clamp?: boolean;
}

export function PostCardContent({
  content,
  contentWarning,
  md,
  isReply = false,
  showContentWarningContent: externalShowContentWarningContent,
  onToggleContentWarning,
  clamp: clampProp = true,
}: PostCardContentProps) {
  const fullPost = useContext(FullPostContext);
  const clamp = clampProp && !fullPost;
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const folded = clamp && !expanded;
  const html = md.render(content);

  const [
    internalShowContentWarningContent,
    setInternalShowContentWarningContent,
  ] = useState(false);

  const navigate = useNavigate();

  // Links into the community (#tags, @mentions) open in the app without
  // reloading the page; others, and clicks with a modifier, as usual.
  const openInApp = (event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
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
  const bodyShown = !contentWarning || showContentWarningContent;

  // Folded, the text stops at the bottom of its fourth line (measured, so
  // paragraphs, mentions and line breaks all count as they look), and the
  // "더보기" button shows only when there is more below it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: measure again when the text changes
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    if (!folded) {
      el.style.maxHeight = "";
      return;
    }
    let width = -1;
    const measure = () => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      el.style.maxHeight = "";
      const top = el.getBoundingClientRect().top;
      const bottoms: number[] = [];
      const add = (rect: DOMRect) => {
        if (!rect.width || !rect.height) return;
        const bottom = rect.bottom - top;
        if (!bottoms.some((b) => Math.abs(b - bottom) < 6))
          bottoms.push(bottom);
      };
      const walker = document.createTreeWalker(
        el,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      );
      const range = document.createRange();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node instanceof Element) {
          if (node.matches("img, video, iframe, hr"))
            add(node.getBoundingClientRect());
          continue;
        }
        if (!node.textContent?.trim()) continue;
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) add(rect);
      }
      bottoms.sort((a, b) => a - b);
      const fourth = bottoms[LINES - 1];
      const more = bottoms.length > LINES && fourth !== undefined;
      if (more) el.style.maxHeight = `${Math.ceil(fourth)}px`;
      setOverflowing(more);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [folded, html, bodyShown]);

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

  if (content.trim() === "[오늘의 날씨](/weather)") {
    return <WeatherCard linked />;
  }

  return (
    <>
      <div className={`relative ${isReply ? "my-1" : "my-2"}`}>
        {/* Only catches clicks on the links inside, which keep their own keyboard use. */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: see above */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: see above */}
        <div
          ref={bodyRef}
          className={`post-body prose${folded ? " post-body-folded" : ""} dark:prose-invert ${
            isReply ? "prose-sm text-[14px]" : "prose-sm text-[15px]"
          } max-w-none text-foreground leading-relaxed`}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized html
          dangerouslySetInnerHTML={{ __html: html }}
          onClick={openInApp}
        />
        {folded && overflowing && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className={`post-more absolute right-0 bottom-0 ${
              isReply ? "text-[14px]" : "text-[15px]"
            } leading-relaxed text-primary font-medium hover:underline`}
          >
            <span className="text-foreground">…</span> 더보기
          </button>
        )}
      </div>

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
