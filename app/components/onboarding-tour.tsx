import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Button } from "~/components/ui/button";

/** Set once someone finished or skipped the tour, in this browser. */
const SEEN_KEY = "commung-tour-seen-v1";
/** Fired (on window) to show the tour again, from the settings page. */
export const REPLAY_EVENT = "commung:tour";

export function replayTour() {
  window.dispatchEvent(new Event(REPLAY_EVENT));
}

interface Step {
  /** The element to light up: `[data-tour="<target>"]`; none for a centred card. */
  target?: string;
  title: string;
  body: string;
}

/**
 * The stops, in order. A stop whose element is not on screen (another page,
 * the other layout, a menu only the staff have) is passed over, so one list
 * serves phones and computers alike.
 */
const STEPS: Step[] = [
  {
    title: "어서 오세요! 🎄",
    body: "처음 오셨네요. 커뮤에서 쓰는 메뉴를 하나씩 짚어 드릴게요. 언제든 '건너뛰기'로 닫을 수 있어요.",
  },
  {
    target: "profile-switcher",
    title: "프로필 바꾸기",
    body: "지금 활동하는 캐릭터 프로필이에요. 눌러서 다른 프로필로 바꿔 글을 쓸 수 있어요.",
  },
  {
    target: "composer",
    title: "글쓰기",
    body: "여기에 글을 써서 타임라인에 올려요. 사진을 붙이거나 @아이디로 멘션하고, /명령어도 쓸 수 있어요.",
  },
  {
    target: "nav-home",
    title: "홈",
    body: "모두의 글이 올라오는 타임라인이에요. 글을 누르면 답글까지 이어진 상세 보기가 열려요.",
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
    body: "프로필 바꾸기, 상점, 사용 로그, 북마크, 검색, 멤버 목록, 내 프로필, 설정은 여기서 열 수 있어요.",
  },
  {
    target: "nav-shop",
    title: "상점",
    body: "커뮤 화폐로 아이템을 사고, 가진 아이템을 확인해요.",
  },
  {
    target: "nav-uses",
    title: "사용 로그",
    body: "아이템을 쓰거나 다른 멤버에게 넘긴 기록이에요. 운영진이 확인하면 '승인됨'으로 바뀌어요.",
  },
  {
    target: "nav-bookmarks",
    title: "북마크",
    body: "글의 북마크 버튼을 누르면 여기에 모아 둘 수 있어요.",
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

/** The first element for `target` that is actually shown. */
function findTarget(target: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(
    `[data-tour="${target}"]`,
  )) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return el;
  }
  return null;
}

const visible = (step: Step) => !step.target || !!findTarget(step.target);

const PAD = 6;
const GAP = 12;
const EDGE = 12;

/**
 * A first-visit tour: the page dims, each menu in turn is lit with a ring,
 * and a card beside it says what it is for. Shown once per browser; the
 * settings page can show it again (replayTour).
 */
export function OnboardingTour() {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardStyle, setCardStyle] = useState<CSSProperties>({});
  const card = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const start = useCallback(() => {
    // Phones hide the top bar on scroll; start from the top so it is there.
    window.scrollTo({ top: 0 });
    setSteps(STEPS.filter(visible));
    setIndex(0);
  }, []);

  const close = useCallback(() => {
    setSteps(null);
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

  // Where the lit element is, kept up to date while the page moves.
  useEffect(() => {
    if (!step) return;
    const el = step.target ? findTarget(step.target) : null;
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
    const measure = () => setRect(el ? el.getBoundingClientRect() : null);
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step]);

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

  const next = useCallback(() => {
    if (!steps) return;
    if (index >= steps.length - 1) close();
    else setIndex(index + 1);
  }, [steps, index, close]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

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
              key={s.title}
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
