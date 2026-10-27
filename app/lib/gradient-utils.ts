// Gradient color combinations for consistent user avatars and headers
// Greys only, told apart by depth, to keep to black, white and one red.
const gradientCombinations = [
  "from-zinc-300 to-zinc-600",
  "from-zinc-400 to-zinc-700",
  "from-neutral-300 to-neutral-600",
  "from-neutral-400 to-neutral-700",
  "from-stone-300 to-stone-600",
  "from-zinc-500 to-zinc-800",
  "from-neutral-500 to-neutral-800",
  "from-stone-400 to-stone-700",
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
