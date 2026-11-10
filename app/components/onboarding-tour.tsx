import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import { setTourDemo, type TourDemo } from "~/lib/tour-demo";

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
  /** The page this stop is on; the tour goes there for it. */
  page?: string;
  /** The page's example entries shown for this stop (lib/tour-demo.ts). */
  demo?: TourDemo;
  /** Only where the right rail is not shown (phones and narrow screens). */
  narrowOnly?: boolean;
}

/** Stops whose element, on phones, is inside the side menu. */
const MENU_TARGETS = new Set([
  "profile-switcher",
  "balance",
  "nav-shop",
  "nav-uses",
  "nav-events",
  "nav-bookmarks",
  "nav-search",
  "nav-profiles",
  "nav-profile",
  "nav-settings",
  "nav-admin",
]);

/**
 * The stops, in order. A stop whose element is not on screen (the other
 * layout, a menu only the staff have) is passed over, so one list serves
 * phones and computers alike. On phones the side menu opens for the stops
 * inside it, and closes after. Stops with a page go to that page, which
 * shows a few examples beside its own entries for them.
 */
const STEPS: Step[] = [
  {
    page: "/",
    title: "어서 오세요! 🎄",
    body: "커뮤에서 쓰는 메뉴를 하나씩 짚어 드리겠습니다. '건너뛰기'로 닫을 수 있습니다.",
  },
  {
    page: "/",
    target: "composer",
    title: "글쓰기",
    body: "글을 써서 타임라인에 올리는 곳입니다. 사진을 붙이거나 @아이디로 멘션할 수 있고, /명령어도 쓸 수 있습니다.",
  },
  {
    page: "/",
    demo: "post",
    target: "demo-post",
    title: "게시물",
    body: "타임라인의 글입니다. 글을 누르면 답글까지 이어진 상세 보기가 열립니다.",
  },
  {
    page: "/",
    demo: "post",
    target: "post-reply",
    title: "답글",
    body: "답글 버튼입니다.",
  },
  {
    page: "/",
    demo: "post",
    target: "post-bookmark",
    title: "북마크",
    body: "북마크 버튼입니다. 북마크 메뉴에서 볼 수 있습니다.",
  },
  {
    page: "/",
    demo: "post",
    target: "post-message",
    title: "메시지 보내기",
    body: "이 글을 쓴 사람에게 1:1 메시지를 보낼 수 있습니다.",
  },
  {
    page: "/",
    demo: "post",
    target: "post-react",
    title: "반응",
    body: "이모지로 반응을 남길 수 있습니다.",
  },
  {
    target: "nav-home",
    title: "홈",
    body: "모두의 글이 올라오는 타임라인입니다.",
  },
  {
    target: "nav-notifications",
    title: "알림",
    body: "답글·멘션·반응, 그리고 선물 도착이나 아이템 사용 승인 같은 알림이 옵니다.",
  },
  {
    page: "/notifications",
    demo: "notifications",
    target: "demo-notification-gift",
    title: "선물 알림",
    body: "다른 멤버가 아이템을 보내면 이렇게 알림이 옵니다. 누르면 사용 로그로 이동합니다.",
  },
  {
    page: "/notifications",
    demo: "notifications",
    target: "demo-notification-approved",
    title: "승인 알림",
    body: "아이템 사용이나 양도가 운영진에게 승인되면 알림이 옵니다.",
  },
  {
    page: "/notifications",
    demo: "notifications",
    target: "demo-notification-reply",
    title: "답글 알림",
    body: "내 글에 답글이 달리거나 멘션되면 알림이 옵니다. 누르면 그 글로 이동합니다.",
  },
  {
    target: "nav-messages",
    title: "메시지",
    body: "1:1로 대화하거나, 그룹 채팅을 할 수 있습니다.",
  },
  {
    target: "nav-announcements",
    title: "공지사항",
    body: "운영진의 공지가 모여 있습니다. 새 공지는 꼭 확인해주시길 바랍니다.",
  },
  {
    target: "nav-boards",
    title: "게시판",
    body: "게시판 기능을 이용할 수 있습니다.",
  },
  {
    target: "menu",
    title: "전체 메뉴",
    body: "나머지 메뉴는 여기에 있습니다. 열어서 하나씩 보겠습니다.",
  },
  {
    target: "profile-switcher",
    title: "프로필 바꾸기",
    body: "지금 활동하는 캐릭터 프로필입니다. 눌러서 다른 프로필로 바꿔 글을 쓸 수 있습니다.",
  },
  {
    target: "balance",
    title: "잔액",
    body: "지금 가진 코인입니다. 상점에서 아이템을 살 때 씁니다.",
  },
  {
    target: "nav-shop",
    title: "상점",
    body: "코인으로 아이템을 사고, 가진 아이템을 확인할 수 있습니다.",
  },
  {
    target: "nav-uses",
    title: "사용 로그",
    body: "아이템을 쓰거나 다른 멤버에게 넘긴 기록이 모여 있습니다.",
  },
  {
    target: "nav-events",
    title: "이벤트",
    body: "매일 오전 출석체크로 코인을 받고, 주간 선물 교환식에 참여할 수 있습니다.",
  },
  {
    target: "nav-bookmarks",
    title: "북마크",
    body: "북마크한 글이 모여 있습니다.",
  },
  {
    target: "nav-search",
    title: "검색",
    body: "글 내용이나 #해시태그로 찾을 수 있습니다.",
  },
  {
    target: "nav-profiles",
    title: "멤버",
    body: "커뮤에 있는 프로필을 둘러보고, 바로 메시지를 보낼 수 있습니다.",
  },
  {
    target: "nav-profile",
    title: "내 프로필",
    body: "내가 쓴 글이 모이는 프로필 페이지입니다.",
  },
  {
    target: "nav-settings",
    title: "설정",
    body: "프로필과 계정을 관리합니다. 이 안내도 설정에서 다시 볼 수 있습니다.",
  },
  {
    page: "/shop",
    demo: "shop",
    target: "demo-shop-item",
    title: "아이템 사기",
    body: "상점의 상품입니다. 가진 코인으로 '구매'를 누르면 보유 상품에 들어갑니다.",
  },
  {
    page: "/shop",
    demo: "shop",
    target: "demo-shop-owned",
    title: "아이템 쓰기 · 넘기기",
    body: "보유 상품은 '사용'하거나 다른 멤버에게 '양도'할 수 있습니다. 비밀로 쓸 수도 있습니다.",
  },
  {
    page: "/uses",
    demo: "uses",
    target: "demo-tour-demo-use",
    title: "사용 기록",
    body: "아이템을 쓰면 사용 로그에 남습니다. 운영진이 확인하기 전까지는 '승인 대기'입니다.",
  },
  {
    page: "/uses",
    demo: "uses",
    target: "demo-tour-demo-use-transfer",
    title: "양도 기록",
    body: "다른 멤버와 주고받은 기록도 남습니다. 운영진이 확인하면 '승인됨'으로 바뀌고 알림이 옵니다.",
  },
  {
    target: "calendar",
    title: "커뮤 속 시간",
    body: "커뮤 안의 날짜는 항상 12월 25일입니다. 시간만 흘러갑니다.",
  },
  // The right rail's stops, on wide screens only (passed over elsewhere).
  {
    target: "rail-check-in",
    title: "출석체크",
    body: "매일 오전 0시부터 12시 사이에 출석체크를 하면 코인 1개를 받습니다.",
  },
  {
    target: "rail-gift",
    title: "주간 선물 교환식",
    body: "월요일부터 토요일까지 신청을 받습니다. 신청이 마감되면 받을 사람이 랜덤으로 정해지고, 일요일 밤 11시 30분까지 선물을 써 두면 월요일 오전 8시에 열어볼 수 있습니다. 받을 사람은 공개되지 않으며, 참여하면 코인 5개를 받습니다.",
  },
  {
    target: "rail-carol",
    title: "크리스마스 캐럴",
    body: "누르면 크리스마스 캐럴이 작은 창으로 열립니다. 다른 페이지로 옮겨도 계속 나오고, 접으면 화면 아래에 숨긴 채로 들을 수 있습니다.",
  },
  {
    page: "/events",
    target: "events-tabs",
    narrowOnly: true,
    title: "이벤트",
    body: "이벤트 페이지에는 탭이 세 개 있습니다. '이벤트'에서는 출석체크(매일 오전 0시~12시, 코인 1개)와 주간 선물 교환식 신청을, '도감'에서는 크리스마스 도감을, '음악'에서는 크리스마스 캐럴을 들을 수 있습니다. 캐럴은 작은 창으로 열려서 다른 페이지로 옮겨도 계속 나옵니다.",
  },
  {
    page: "/events",
    target: "box-book",
    title: "크리스마스 도감",
    body: "상점에서 하루에 한 번 크리스마스 랜덤박스를 살 수 있습니다. 열면 나온 물건이 인벤토리에 들어오고, '도감 등록'을 누르면 모두가 함께 채우는 도감에 이름이 남습니다. 처음 등록하면 코인 2개를 받습니다. 도감은 이벤트 페이지의 '도감' 탭에 있고, 새로 등록된 물건이 있으면 빨간 점이 뜹니다.",
  },
  {
    target: "campfire",
    title: "벽난로",
    body: "누르면 불이 붙고 잔잔한 음악이 흘러나옵니다. 소리가 나니 주의해주시길 바랍니다. 휴대폰은 꾹 누르고, 컴퓨터는 마우스 오른쪽 버튼을 누르면 불 소리와 음악 크기를 따로 조절할 수 있습니다.",
  },
  {
    title: "준비 끝!",
    body: "이제 마음껏 즐겨주시길 바랍니다. 이 안내는 설정 → '사용법 다시 보기'에서 언제든 다시 볼 수 있습니다.",
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
 * menu opens for it), and one with examples or on another page always is;
 * any is passed over then if its element is not there after all. A
 * narrowOnly stop is left out where the right rail shows.
 */
function stopsHere(): Stop[] {
  const phoneMenu = !!findTarget("menu");
  const wide = !!findTarget("rail-check-in");
  return STEPS.flatMap((step): Stop[] => {
    if (step.narrowOnly && wide) return [];
    if (!step.target || step.demo || step.page) return [step];
    if (phoneMenu && MENU_TARGETS.has(step.target))
      return [{ ...step, inMenu: true }];
    return findTarget(step.target) ? [step] : [];
  });
}

const PAD = 6;
const GAP = 12;
const EDGE = 12;

/**
 * A first-visit tour: the page dims, each menu in turn is lit with a ring,
 * and a card beside it says what it is for. It goes through the pages too
 * (notifications, the shop, the use log), which show made-up examples while
 * it is there, since a newcomer has no posts or items yet; at the end it
 * takes them home with everything as it was. Shown once per browser, on the
 * home timeline; the settings page can show it again (replayTour, which
 * goes home first).
 */
export function OnboardingTour() {
  const [steps, setSteps] = useState<Stop[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardStyle, setCardStyle] = useState<CSSProperties>({});
  const card = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Which way the last move went, to pass over a stop that is not there.
  const direction = useRef<1 | -1>(1);
  const usedMenu = useRef(false);
  const running = useRef(false);

  const start = useCallback(() => {
    // Phones hide the top bar on scroll; start from the top so it is there.
    window.scrollTo({ top: 0 });
    direction.current = 1;
    running.current = true;
    setSteps(stopsHere());
    setIndex(0);
  }, []);

  const close = useCallback(() => {
    setSteps(null);
    setTourDemo(null);
    if (usedMenu.current) setMenu(false);
    usedMenu.current = false;
    running.current = false;
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    // Back where it began, as it was.
    navigate("/");
    window.scrollTo({ top: 0 });
  }, [navigate]);

  // The tour runs on the home timeline, where the composer is: on a first
  // visit, or when asked for again (replayTour), it waits until the page
  // is home and has settled, then begins.
  const [asked, setAsked] = useState(false);
  useEffect(() => {
    const ask = () => setAsked(true);
    window.addEventListener(REPLAY_EVENT, ask);
    return () => window.removeEventListener(REPLAY_EVENT, ask);
  }, []);
  useEffect(() => {
    if (pathname !== "/" || running.current) return;
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {}
    if (seen && !asked) return;
    const timer = setTimeout(() => {
      setAsked(false);
      start();
    }, 800);
    return () => clearTimeout(timer);
  }, [pathname, asked, start]);

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

  // Go to the stop's page and show its examples; open the phone menu for
  // the stops in it and close it for the rest. Then find the lit element
  // and keep its place up to date. A stop whose element never shows up is
  // passed over, the way the last move went.
  useEffect(() => {
    if (!step || !steps) return;
    setTourDemo(step.demo ?? null);
    if (step.page && window.location.pathname !== step.page) {
      navigate(step.page);
      window.scrollTo({ top: 0 });
    }
    if (step.inMenu) {
      usedMenu.current = true;
      setMenu(true);
    } else if (usedMenu.current) {
      usedMenu.current = false;
      setMenu(false);
    }
    const scope =
      step.demo === "post" ? "demo" : step.inMenu ? "menu" : undefined;
    // A page may take a moment to load; the menu to slide in.
    const patience = step.page ? 60 : 10;
    let el: HTMLElement | null = null;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    let frame = 0;
    const measure = () => setRect(el ? el.getBoundingClientRect() : null);
    const look = () => {
      el = step.target ? findTarget(step.target, scope) : null;
      if (step.target && !el) {
        if (++tries < patience) {
          timer = setTimeout(look, 60);
          return;
        }
        // Taken out of the list, so the count stays true; going back, the
        // one before it is shown, going forward the one after takes its place.
        const goingBack = direction.current === -1;
        if (
          (goingBack && index === 0) ||
          (!goingBack && index === steps.length - 1)
        )
          close();
        else {
          setSteps(steps.filter((_, i) => i !== index));
          if (goingBack) setIndex(index - 1);
        }
        return;
      }
      // Into the middle of the screen, so the card beside it fits too; once
      // more after the page settles (examples drawn, menus slid in).
      const center = () =>
        el?.scrollIntoView({ block: "center", inline: "nearest" });
      center();
      timer = setTimeout(center, 350);
      // Follow it for a moment, while the menu slides in or the page settles.
      const until = performance.now() + 900;
      const follow = () => {
        measure();
        if (performance.now() < until) frame = requestAnimationFrame(follow);
      };
      follow();
    };
    look();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, steps, index, close, navigate]);

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
      {step.demo && (
        <p className="tour-demo-badge absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] md:bottom-6 flex justify-center pointer-events-none">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground shadow-marsh">
            <Sparkles className="h-4 w-4" />
            지금은 예시 화면입니다!
          </span>
        </p>
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
