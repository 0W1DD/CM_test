// Gradient color combinations for consistent user avatars and headers
// One family of neon cyans, told apart by depth, to match the neon theme.
const gradientCombinations = [
  "from-cyan-300 to-sky-600",
  "from-cyan-400 to-sky-700",
  "from-cyan-500 to-teal-800",
  "from-sky-400 to-cyan-800",
  "from-teal-400 to-cyan-700",
  "from-sky-500 to-slate-800",
  "from-cyan-600 to-slate-900",
  "from-teal-500 to-slate-800",
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
