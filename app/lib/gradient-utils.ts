// The site's three colours only: the theme green in a few depths, and the
// accent red, so avatars without a picture stay in the palette.
const gradientCombinations = [
  "from-[#324e44] to-[#324e44]",
  "from-[#55695f] to-[#55695f]",
  "from-[#c2361a] to-[#c2361a]",
  "from-[#3f5a50] to-[#3f5a50]",
  "from-[#6d7f76] to-[#6d7f76]",
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
