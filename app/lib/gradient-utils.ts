// Gradient color combinations for consistent user avatars and headers
const gradientCombinations = [
  "from-blue-500 to-indigo-600",
  "from-indigo-500 to-violet-600",
  "from-violet-500 to-purple-600",
  "from-slate-500 to-indigo-600",
  "from-orange-500 to-amber-600",
  "from-amber-500 to-yellow-600",
  "from-yellow-500 to-lime-600",
  "from-lime-500 to-green-600",
  "from-green-500 to-emerald-600",
  "from-emerald-500 to-teal-600",
  "from-teal-500 to-cyan-600",
  "from-cyan-500 to-sky-600",
  "from-sky-500 to-blue-600",
  "from-stone-500 to-amber-700",
  "from-purple-500 to-indigo-700",
  "from-slate-600 to-stone-700",
  "from-red-600 to-orange-700",
  "from-slate-500 to-gray-600",
  "from-zinc-500 to-stone-600",
  "from-neutral-500 to-gray-600",
];

// Simple hash function to generate consistent index from string
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Generate consistent gradient based on username or name
export function getGradientForUser(username?: string, name?: string): string {
  const identifier = username || name || "";
  const hash = hashString(identifier.toLowerCase());
  const index = hash % gradientCombinations.length;
  const gradient = gradientCombinations[index];
  return (
    gradient ??
    gradientCombinations[0] ??
    "bg-gradient-to-br from-gray-400 to-gray-600"
  );
}
