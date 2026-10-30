import { useEffect, useState } from "react";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // Tick on the minute boundary, then every minute.
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(
      () => {
        setNow(new Date());
        interval = setInterval(() => setNow(new Date()), 60_000);
      },
      60_000 - (Date.now() % 60_000),
    );
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);
  return now;
}

/** A live clock beside an unchanging Christmas calendar. */
export function ClockCalendar() {
  const now = useNow();
  // Keep the weekday layout fixed too, even when the real year changes.
  // The reference year is only for layout and is never displayed.
  const year = 2026;
  const month = 11;
  const today = 25;
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");

  return (
    <div className="framed p-4">
      <p
        className="font-display text-4xl font-bold tabular-nums tracking-tight text-foreground"
      >
        {hh}
        <span className="text-primary">:</span>
        {mm}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        12월 25일
      </p>

      <div className="mt-4 border-t border-border pt-3">
        <p className="mb-2 text-sm font-semibold text-foreground">
          {month + 1}월
        </p>
        <div className="grid grid-cols-7 gap-y-1 text-center text-xs tabular-nums">
          {WEEKDAYS.map((day, i) => (
            <span
              key={day}
              className={`pb-1 font-semibold ${i === 0 ? "text-primary" : "text-muted-foreground"}`}
            >
              {day}
            </span>
          ))}
          {cells.map((day, i) =>
            day === null ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: blank leading cells
              <span key={`blank-${i}`} />
            ) : (
              <span
                key={day}
                aria-current={day === today ? "date" : undefined}
                className={`mx-auto flex h-6 w-6 items-center justify-center ${
                  day === today
                    ? "bg-primary font-bold text-primary-foreground"
                    : i % 7 === 0
                      ? "text-primary"
                      : "text-foreground"
                }`}
              >
                {day}
              </span>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
