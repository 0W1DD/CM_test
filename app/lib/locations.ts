export const LOCATIONS = [
  {
    id: "fireplace",
    name: "벽난로 앞",
    background: "#986043",
    accent: "#cda96c",
    description:
      "따뜻한 벽난로와 축음기에서 들려오는 늘 똑같은 음악. 크리스마스 트리와 장식들이 있다.",
  },
  {
    id: "kitchen",
    name: "부엌",
    background: "#80533c",
    accent: "#bd825b",
    description:
      "꺼지지 않는 가스불과 뭉근하게 영원히 끓는 스튜. 바닥은 조금 차갑다.",
  },
  {
    id: "library",
    name: "서재",
    background: "#405449",
    accent: "#8fa481",
    description: "서재에서 무슨 일이 일어나고 있나요?",
  },
  {
    id: "yard",
    name: "마당",
    background: "#385861",
    accent: "#89b5ba",
    description: "마당에서 무슨 일이 일어나고 있나요?",
  },
  {
    id: "attic",
    name: "다락방",
    background: "#61516a",
    accent: "#b69ba9",
    description: "다락방에서 무슨 일이 일어나고 있나요?",
  },
] as const;

export type LocationId = (typeof LOCATIONS)[number]["id"];
export function locationOf(id?: string | null) {
  return LOCATIONS.find((location) => location.id === id) ?? LOCATIONS[0];
}
