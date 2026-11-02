import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { PostCard } from "~/components/post-card";
import { Button } from "~/components/ui/button";
import { useAuth } from "~/hooks/useAuth";
import type { Post } from "~/types/post";

/** Set once someone finished or skipped the tour, in this browser. */
const SEEN_KEY = "commung-tour-seen-v1";
/** Fired (on window) to show the tour again, from the settings page. */
export const REPLAY_EVENT = "commung:tour";
/** Fired (on window, detail true or false) to open or close the phone menu. */
export const MENU_EVENT = "commung:menu";

export function replayTour() {
  window.dispatchEvent(new Event(REPLAY_EVENT));
}

const setMenu = (open: boolean) =>
  window.dispatchEvent(new CustomEvent(MENU_EVENT, { detail: open }));

interface Step {
  /** The element to light up: `[data-tour="<target>"]`; none for a centred card. */
  target?: string;
  title: string;
  body: string;
  /** An example screen shown for this stop, its target inside it. */
  demo?: "post" | "item";
}

/** Stops whose element, on phones, is inside the side menu. */
const MENU_TARGETS = new Set([
  "profile-switcher",
  "balance",
  "nav-shop",
  "nav-uses",
  "nav-bookmarks",
  "nav-search",
  "nav-profiles",
  "nav-profile",
  "nav-settings",
  "nav-admin",
]);

/**
 * The stops, in order. A stop whose element is not on screen (another page,
 * the other layout, a menu only the staff have) is passed over, so one list
 * serves phones and computers alike. On phones the side menu opens for the
 * stops inside it, and closes after.
 */
const STEPS: Step[] = [
  {
    title: "어서 오세요! 🎄",
    body: "처음 오셨네요. 커뮤에서 쓰는 메뉴를 하나씩 짚어 드릴게요. 언제든 '건너뛰기'로 닫을 수 있어요.",
  },
  {
    target: "composer",
    title: "글쓰기",
    body: "여기에 글을 써서 타임라인에 올려요. 사진을 붙이거나 @아이디로 멘션하고, /명령어도 쓸 수 있어요.",
  },
  {
    demo: "post",
    target: "demo-post",
    title: "게시물",
    body: "타임라인의 글은 이렇게 보여요. 글을 누르면 답글까지 이어진 상세 보기가 열려요.",
  },
  {
    demo: "post",
    target: "post-reply",
    title: "답글",
    body: "글에 답글을 달아요. 숫자는 지금까지 달린 답글 수예요.",
  },
  {
    demo: "post",
    target: "post-bookmark",
    title: "북마크",
    body: "나중에 다시 볼 글을 모아 둬요. 북마크 메뉴에서 볼 수 있어요.",
  },
  {
    demo: "post",
    target: "post-message",
    title: "메시지 보내기",
    body: "이 글을 쓴 사람에게 1:1 메시지를 보내요.",
  },
  {
    demo: "post",
    target: "post-react",
    title: "반응",
    body: "이모지로 가볍게 반응을 남겨요. 누른 반응은 글 아래에 모여요.",
  },
  {
    target: "nav-home",
    title: "홈",
    body: "모두의 글이 올라오는 타임라인이에요.",
  },
  {
    target: "nav-notifications",
    title: "알림",
    body: "답글·멘션·반응, 그리고 선물 도착이나 아이템 사용 승인 같은 소식이 여기로 와요.",
  },
  {
    target: "nav-messages",
    title: "메시지",
    body: "다른 멤버와 1:1로 대화하거나, 여럿이 함께하는 그룹 채팅을 만들 수 있어요.",
  },
  {
    target: "nav-announcements",
    title: "공지사항",
    body: "운영진의 공지가 모여 있어요. 새 공지는 꼭 확인해 주세요!",
  },
  {
    target: "nav-boards",
    title: "게시판",
    body: "타임라인과 따로, 주제별로 글을 모아 두는 곳이에요.",
  },
  {
    target: "menu",
    title: "전체 메뉴",
    body: "나머지 메뉴는 여기에 있어요. 열어서 하나씩 볼게요.",
  },
  {
    target: "profile-switcher",
    title: "프로필 바꾸기",
    body: "지금 활동하는 캐릭터 프로필이에요. 눌러서 다른 프로필로 바꿔 글을 쓸 수 있어요.",
  },
  {
    target: "balance",
    title: "잔액",
    body: "지금 가진 커뮤 화폐예요. 상점에서 아이템을 살 때 써요.",
  },
  {
    target: "nav-shop",
    title: "상점",
    body: "화폐로 아이템을 사고, 가진 아이템을 확인해요.",
  },
  {
    target: "nav-uses",
    title: "사용 로그",
    body: "아이템을 쓰거나 다른 멤버에게 넘긴 기록이 모여요.",
  },
  {
    target: "nav-bookmarks",
    title: "북마크",
    body: "북마크한 글이 모여 있어요.",
  },
  {
    target: "nav-search",
    title: "검색",
    body: "글 내용이나 #해시태그로 찾아봐요.",
  },
  {
    target: "nav-profiles",
    title: "멤버",
    body: "커뮤에 있는 프로필들을 둘러보고, 바로 메시지를 보낼 수도 있어요.",
  },
  {
    target: "nav-profile",
    title: "내 프로필",
    body: "내가 쓴 글이 모이는 프로필 페이지예요.",
  },
  {
    target: "nav-settings",
    title: "설정",
    body: "프로필과 계정을 관리해요. 이 안내도 설정에서 다시 볼 수 있어요.",
  },
  {
    target: "nav-admin",
    title: "커뮤 관리",
    body: "운영진 전용 메뉴예요. 가입 신청, 멤버, 상점, 한꺼번에 지우기 등을 관리해요.",
  },
  {
    demo: "item",
    target: "demo-item-buy",
    title: "아이템 사기",
    body: "상점에는 이렇게 상품이 있어요. 가진 화폐로 '구매'를 누르면 내 보유 상품에 들어가요.",
  },
  {
    demo: "item",
    target: "demo-item-use",
    title: "아이템 쓰기 · 넘기기",
    body: "보유 상품에서 '사용'하거나, 다른 멤버에게 '양도'할 수 있어요. 비밀로 쓸 수도 있어요.",
  },
  {
    demo: "item",
    target: "demo-item-log",
    title: "사용 로그와 승인",
    body: "쓰거나 넘긴 아이템은 사용 로그에 남아요. 운영진이 확인하면 '승인됨'으로 바뀌고 알림이 와요.",
  },
  {
    target: "calendar",
    title: "커뮤 속 시간",
    body: "커뮤 안의 날짜는 늘 12월 25일이에요. 시계만 흘러가요.",
  },
  {
    target: "campfire",
    title: "벽난로",
    body: "누르면 불이 붙고 잔잔한 음악이 흘러나와요. 소리가 나니 주의하세요!",
  },
  {
    title: "준비 끝!",
    body: "이제 마음껏 즐겨 주세요. 이 안내는 설정 → '사용법 다시 보기'에서 언제든 다시 볼 수 있어요.",
  },
];

/** The first element for `target` that is shown, inside `scope` when given. */
function findTarget(target: string, scope?: string): HTMLElement | null {
  const root = scope
    ? document.querySelector(`[data-tour-scope="${scope}"]`)
    : document;
  if (!root) return null;
  for (const el of root.querySelectorAll<HTMLElement>(
    `[data-tour="${target}"]`,
  )) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return el;
  }
  return null;
}

/** A stop as shown here: where to look for its element. */
interface Stop extends Step {
  /** Inside the phone's side menu, opened for it. */
  inMenu?: boolean;
}

/**
 * The stops for this screen. A stop in the side menu is kept on phones (the
 * menu opens for it; if it is not there after all, it is passed over then).
 */
function stopsHere(): Stop[] {
  const phoneMenu = !!findTarget("menu");
  return STEPS.flatMap((step): Stop[] => {
    if (!step.target || step.demo) return [step];
    if (phoneMenu && MENU_TARGETS.has(step.target))
      return [{ ...step, inMenu: true }];
    return findTarget(step.target) ? [step] : [];
  });
}

const DEMO_AUTHOR = {
  id: "tour-demo-author",
  name: "산타",
  username: "santa",
  profile_picture_url: null,
};

/** A made-up post, for the example screen only. */
const DEMO_POST: Post = {
  id: "tour-demo-post",
  content: "메리 크리스마스! 🎄 오늘 밤 벽난로 앞에서 핫초코 한 잔 어때요?",
  created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  updated_at: null,
  announcement: false,
  content_warning: null,
  pinned_at: null,
  author: DEMO_AUTHOR,
  images: [],
  in_reply_to_id: null,
  depth: 0,
  root_post_id: null,
  is_bookmarked: false,
  replies: [],
  reply_count: 2,
  has_more_replies: false,
  reactions: [
    { emoji: "🎄", user: { id: "a", username: "rudolph", name: "루돌프" } },
    { emoji: "☕", user: { id: "b", username: "elf", name: "요정" } },
  ],
};

/** The example screens, shown above the dimmed page and taken away after. */
function TourDemo({ kind }: { kind: "post" | "item" }) {
  const { currentProfile } = useAuth();
  return (
    <div
      className="tour-demo absolute inset-x-0 top-[8vh] mx-auto px-3"
      style={{ maxWidth: 560 }}
      data-tour-scope="demo"
      // Only to look at: nothing in it can be pressed.
      inert
    >
      <div
        data-tour={kind === "post" ? "demo-post" : undefined}
        className="rounded-2xl"
      >
        <p className="mb-2 flex items-center justify-center gap-1.5 text-sm font-bold text-primary-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 shadow-marsh">
            <Sparkles className="h-4 w-4" />
            지금은 예시 화면이에요!
          </span>
        </p>
        {kind === "post" ? (
          <div className="framed overflow-hidden">
            <PostCard
              post={DEMO_POST}
              currentProfileId={currentProfile?.id}
              noFold
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div
              data-tour="demo-item-buy"
              className="framed bg-card p-4 flex items-center gap-3"
            >
              <span className="text-3xl" aria-hidden>
                ☕
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">핫초코</p>
                <p className="text-xs text-muted-foreground">
                  몸이 따뜻해지는 한 잔
                </p>
                <p className="mt-0.5 text-sm text-foreground">30 코인</p>
              </div>
              <Button size="sm" tabIndex={-1}>
                구매
              </Button>
            </div>
            <div
              data-tour="demo-item-use"
              className="framed bg-card p-4 flex items-center gap-3"
            >
              <span className="text-2xl" aria-hidden>
                ☕
              </span>
              <p className="min-w-0 flex-1 text-sm text-foreground">
                <strong>핫초코</strong> ×1
                <span className="block text-xs text-muted-foreground">
                  보유 상품
                </span>
              </p>
              <Button size="sm" variant="outline" tabIndex={-1}>
                양도
              </Button>
              <Button size="sm" tabIndex={-1}>
                사용
              </Button>
            </div>
            <div
              data-tour="demo-item-log"
              className="framed bg-card p-4 flex items-start gap-3 text-sm"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-foreground">
                  <strong>{currentProfile?.name ?? "나"}</strong> ·{" "}
                  <strong>핫초코</strong>을(를) 사용했습니다.
                </p>
                <p className="text-foreground inline-flex flex-wrap items-center gap-1">
                  <strong>핫초코</strong>
                  <ArrowRight className="h-3.5 w-3.5 text-primary" />
                  <strong>산타</strong>님에게 양도했습니다.
                </p>
              </div>
              <div className="shrink-0 space-y-2 text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  승인 대기
                </span>
                <span className="flex items-center gap-1 font-semibold text-primary">
                  <Check className="h-3.5 w-3.5" />
                  승인됨
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const PAD = 6;
const GAP = 12;
const EDGE = 12;

/**
 * A first-visit tour: the page dims, each menu in turn is lit with a ring,
 * and a card beside it says what it is for. Things a newcomer has none of
 * yet (a post, an item) are shown on example screens, gone again after.
 * Shown once per browser; the settings page can show it again (replayTour).
 */
export function OnboardingTour() {
  const [steps, setSteps] = useState<Stop[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardStyle, setCardStyle] = useState<CSSProperties>({});
  const card = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Which way the last move went, to pass over a stop that is not there.
  const direction = useRef<1 | -1>(1);
  const usedMenu = useRef(false);

  const start = useCallback(() => {
    // Phones hide the top bar on scroll; start from the top so it is there.
    window.scrollTo({ top: 0 });
    direction.current = 1;
    setSteps(stopsHere());
    setIndex(0);
  }, []);

  const close = useCallback(() => {
    setSteps(null);
    if (usedMenu.current) setMenu(false);
    usedMenu.current = false;
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
  }, []);

  // First visit: wait for the page to settle, then begin.
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {}
    const timer = seen ? undefined : setTimeout(start, 800);
    window.addEventListener(REPLAY_EVENT, start);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(REPLAY_EVENT, start);
    };
  }, [start]);

  const step = steps?.[index];

  const next = useCallback(() => {
    if (!steps) return;
    direction.current = 1;
    if (index >= steps.length - 1) close();
    else setIndex(index + 1);
  }, [steps, index, close]);
  const back = useCallback(() => {
    direction.current = -1;
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  // Open the phone menu for the stops in it and close it for the rest;
  // then find the lit element and keep its place up to date. A stop whose
  // element never shows up is passed over, the way the last move went.
  useEffect(() => {
    if (!step || !steps) return;
    if (step.inMenu) {
      usedMenu.current = true;
      setMenu(true);
    } else if (usedMenu.current) {
      usedMenu.current = false;
      setMenu(false);
    }
    const scope = step.demo ? "demo" : step.inMenu ? "menu" : undefined;
    let el: HTMLElement | null = null;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const measure = () => setRect(el ? el.getBoundingClientRect() : null);
    const look = () => {
      el = step.target ? findTarget(step.target, scope) : null;
      if (step.target && !el) {
        // The menu or the example screen may still be coming in.
        if (++tries < 8) {
          timer = setTimeout(look, 60);
          return;
        }
        // Taken out of the list, so the count stays true; going back, the
        // one before it is shown, going forward the one after takes its place.
        const back = direction.current === -1;
        if ((back && index === 0) || (!back && index === steps.length - 1))
          close();
        else {
          setSteps(steps.filter((_, i) => i !== index));
          if (back) setIndex(index - 1);
        }
        return;
      }
      el?.scrollIntoView({ block: "nearest", inline: "nearest" });
      // Follow it for a moment, while the menu slides in.
      const until = performance.now() + 900;
      const follow = () => {
        measure();
        if (performance.now() < until) frame = requestAnimationFrame(follow);
      };
      follow();
    };
    let frame = 0;
    look();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, steps, index, close]);

  // The card goes below the lit element, or above when there is no room,
  // kept inside the screen; with nothing lit it sits in the middle.
  useLayoutEffect(() => {
    if (!step || !card.current) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(340, vw - EDGE * 2);
    const height = card.current.offsetHeight;
    if (!rect) {
      setCardStyle({
        width,
        left: (vw - width) / 2,
        top: Math.max(EDGE, (vh - height) / 2),
      });
      return;
    }
    const below = rect.bottom + PAD + GAP;
    const above = rect.top - PAD - GAP - height;
    const roomBelow = below + height <= vh - EDGE;
    // Beside it when it is a tall thing in a side column (wide screens).
    const side = rect.right + PAD + GAP;
    let top: number;
    let left: number;
    if (!roomBelow && above < EDGE && side + width <= vw - EDGE) {
      left = side;
      top = Math.min(Math.max(EDGE, rect.top), vh - height - EDGE);
    } else {
      top = roomBelow ? below : Math.max(EDGE, above);
      left = rect.left + rect.width / 2 - width / 2;
    }
    left = Math.min(Math.max(EDGE, left), vw - width - EDGE);
    setCardStyle({ width, left, top });
  }, [step, rect]);

  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" || e.key === "Enter") next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, close, next, back]);

  if (!steps || !step) return null;
  const last = index === steps.length - 1;

  return (
    <div
      className="tour-root fixed inset-0 z-[80]"
      // The open menu makes the rest of the page unclickable; not the tour.
      style={{ pointerEvents: "auto" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {step.demo && <TourDemo kind={step.demo} />}
      {rect ? (
        <div
          className="tour-spotlight"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/70" />
      )}
      <div
        ref={card}
        className="tour-card absolute rounded-2xl border border-border bg-card text-card-foreground shadow-marsh-lg p-4"
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold text-primary tabular-nums">
            {index + 1} / {steps.length}
          </p>
          <button
            type="button"
            onClick={close}
            className="-mt-1 -mr-1 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
            aria-label="안내 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 id={titleId} className="mt-1 text-base font-bold text-foreground">
          {step.title}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {step.body}
        </p>
        <div className="mt-4 flex items-center justify-between gap-2">
          {last ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={close}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              건너뛰기
            </button>
          )}
          <div className="flex gap-2">
            {index > 0 && (
              <Button variant="outline" size="sm" onClick={back}>
                <ChevronLeft className="h-4 w-4" />
                이전
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {last ? "시작하기" : "다음"}
              {!last && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="mt-3 flex justify-center gap-1" aria-hidden>
          {steps.map((s, i) => (
            <span
              key={`${s.title}-${s.target ?? i}`}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-4 bg-primary" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
