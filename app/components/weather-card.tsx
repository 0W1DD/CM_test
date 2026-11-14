import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  forecastForDay,
  weatherDay,
  WEATHER_DAY_MS,
} from "~/lib/daily-weather";
import "./weather-card.css";

const trees = Array.from({ length: 22 }, (_, i) => ({
  left: `${((i * 17) % 104) - 3}%`,
  height: `${26 + ((i * 13) % 58)}%`,
  width: `${5 + (i % 5)}%`,
  opacity: 0.4 + (i % 4) * 0.09,
}));

const bulbs = [
  [47, 22],
  [39, 36],
  [57, 39],
  [32, 57],
  [46, 53],
  [62, 58],
  [26, 73],
  [51, 72],
  [70, 77],
] as const;

function Snow({ storm, morning }: { storm: boolean; morning: boolean }) {
  return Array.from({ length: storm ? 80 : 48 }, (_, i) => {
    const size = storm ? 0.45 : (morning ? 0.56 : 1.05) * (1 + (i % 3) * 0.25);
    return (
      <i
        key={i}
        className="flake"
        style={{
          left: `${((i * 43) % 109) - 3}%`,
          top: `${(i * i * 7 + i * 17) % 103}%`,
          width: `${size}cqw`,
          height: `${storm ? size * 5 : size}cqw`,
          animationDelay: `-${((i * 7) % 29) / 10}s`,
          animationDuration: `${storm ? 1.5 : 3 + (i % 3)}s`,
        }}
      />
    );
  });
}

export function WeatherCard({ linked = false }: { linked?: boolean }) {
  const [day, setDay] = useState(() => weatherDay(Date.now()));
  useEffect(() => {
    let timer: number;
    const refresh = () => {
      const now = Date.now();
      const current = weatherDay(now);
      setDay(current);
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, (current + 1) * WEATHER_DAY_MS - now);
    };
    refresh();
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return (
    <section className="daily-weather" aria-label="오늘의 오전·오후 날씨">
      <div className="headline">
        <span className="postdate">12월 25일</span>
        {linked && (
          <Link to="/weather" className="postdate underline">
            오늘의 날씨 열기
          </Link>
        )}
      </div>
      <div className="pair">
        {forecastForDay(day).map(([kind, title, description], index) => {
          const morning = index === 0;
          return (
            <article
              key={morning ? "am" : "pm"}
              className={morning ? "postcard am" : "postcard pm"}
            >
              <div className="scene" data-w={kind} aria-hidden="true">
                <div className="sun" />
                <div className="ridge" />
                <div className="trees">
                  {trees.map((style) => (
                    <i key={style.left} style={style} />
                  ))}
                </div>
                <div className="bank" />
                <div className="path" />
                <div className="fir">
                  <i className="needles" />
                  {bulbs.map(([x, y], i) => (
                    <i
                      key={x}
                      className="bulb"
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                        background: i % 2 ? "#dda959" : "#b3553d",
                      }}
                    />
                  ))}
                  <i className="star" />
                </div>
                <i className="lamp" />
                <div className="air">
                  {(kind === "snow" || kind === "storm") && (
                    <Snow storm={kind === "storm"} morning={morning} />
                  )}
                </div>
              </div>
              <div className="caption">
                <b>
                  <em>{morning ? "오전" : "오후"}</em>
                  {title}
                </b>
                <p>{description}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
