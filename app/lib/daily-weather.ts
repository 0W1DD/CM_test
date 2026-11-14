const morning = [
  ["clear", "맑은 아침", "전나무의 긴 그림자가 눈밭에 드리웁니다."],
  ["fog", "새벽 안개", "안개 너머로 광장의 등불이 희미하게 보입니다."],
  [
    "frost",
    "서리 내린 아침",
    "맑고 찬 공기 속에 솔잎마다 은빛 서리가 앉습니다.",
  ],
  ["snow", "포슬눈", "작은 눈송이가 전나무 가지에 내려앉습니다."],
  ["gold", "금빛 햇살", "첫 햇살이 전나무 꼭대기의 별을 비춥니다."],
  ["storm", "아침 눈보라", "산길을 가로지르는 눈발에 발자국이 금세 묻힙니다."],
] as const;

const afternoon = [
  ["pink", "장밋빛 노을", "해가 기울며 광장의 눈밭이 장밋빛으로 물듭니다."],
  ["storm", "눈보라", "비스듬한 눈발 사이로 등불이 새어 나옵니다."],
  ["clear", "갠 하늘", "맑게 갠 하늘 아래 전나무 너머 산등성이가 보입니다."],
  ["snow", "함박눈", "커다란 눈송이가 소리 없이 광장을 덮습니다."],
  ["fog", "숲안개", "숲에서 밀려온 안개가 눈길까지 번집니다."],
  [
    "gold",
    "포근한 볕",
    "낮은 겨울 햇살이 눈 덮인 산등성이를 꿀빛으로 물들입니다.",
  ],
] as const;

export const WEATHER_DAY_MS = 86_400_000;

// 09:00 in Seoul is 00:00 UTC, independent of the device's timezone.
export function weatherDay(now: number) {
  return Math.floor(now / WEATHER_DAY_MS);
}

// A fixed shuffled deck, shared by all visitors. No repeats within its 36-day cycle.
const deck = [
  11, 27, 8, 19, 2, 32, 13, 25, 4, 16, 30, 21, 10, 24, 17, 1, 35, 20, 9, 28, 3,
  12, 34, 23, 6, 15, 26, 5, 31, 18, 7, 29, 14, 0, 33, 22,
] as const;

export function forecastForDay(day: number) {
  const slot = ((day % deck.length) + deck.length) % deck.length;
  const pair = deck[slot]!;
  return [
    morning[Math.floor(pair / afternoon.length)]!,
    afternoon[pair % afternoon.length]!,
  ] as const;
}
