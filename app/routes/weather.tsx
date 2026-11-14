import { WeatherCard } from "~/components/weather-card";

export function meta() {
  return [{ title: "오늘의 날씨" }];
}

export default function Weather() {
  return (
    <main className="mx-auto max-w-2xl p-4">
      <WeatherCard />
    </main>
  );
}
