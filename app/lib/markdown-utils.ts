import mention from "@fedify/markdown-it-mention";
import MarkdownIt from "markdown-it";
import { query } from "~/lib/naru";

// Cache for profile existence checks
const profileExistsCache = new Map<string, boolean>();

// Singleton markdown instance for read-only content (posts in feeds)
// This instance treats all mentions as valid to avoid creating a new instance per post
let readOnlyMarkdownInstance: MarkdownIt | null = null;

/**
 * Get or create the singleton read-only markdown instance
 * This is used for rendering posts in feeds where we don't need mention validation
 */
export function getReadOnlyMarkdownInstance(): MarkdownIt {
  if (readOnlyMarkdownInstance) {
    return readOnlyMarkdownInstance;
  }

  readOnlyMarkdownInstance = new MarkdownIt({ linkify: true }).use(mention, {
    localDomain: (_bareHandle: string) => {
      // Return the current app domain for bare handles like @miro
      if (typeof window !== "undefined") {
        return window.location.hostname;
      }
      return "localhost"; // fallback for SSR
    },
    link: (handle: string) => {
      // Extract just the username part (before @domain if present)
      const username = handle.startsWith("@")
        ? (handle.slice(1).split("@")[0] ?? "")
        : (handle.split("@")[0] ?? "");

      // Always create links for read-only mode (assume all mentions are valid)
      return `/@${username}`;
    },
    linkAttributes: () => ({
      class: "text-primary hover:text-primary/80 font-medium",
    }),
  });

  return readOnlyMarkdownInstance;
}

/**
 * Extract mentions from text using regex
 * @param text - Text to extract mentions from
 * @returns Array of unique usernames mentioned
 */
export function extractMentions(text: string): string[] {
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const mentions: string[] = [];
  let match: RegExpExecArray | null = mentionRegex.exec(text);
  while (match !== null) {
    if (match[1]) {
      mentions.push(match[1]);
    }
    match = mentionRegex.exec(text);
  }
  return [...new Set(mentions)]; // Remove duplicates
}

/**
 * Validate if profiles exist
 * @param usernames - Array of usernames to validate
 * @returns Map of username to existence status
 */
export async function validateProfiles(
  usernames: string[],
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  // Check cache first
  const uncachedUsernames = usernames.filter(
    (username) => !profileExistsCache.has(username),
  );

  // Copy cached results
  usernames.forEach((username) => {
    const cached = profileExistsCache.get(username);
    if (cached !== undefined) {
      results.set(username, cached);
    }
  });

  // Validate uncached usernames
  if (uncachedUsernames.length > 0) {
    await Promise.all(
      uncachedUsernames.map(async (username) => {
        try {
          await query("profiles:get", { username });
          profileExistsCache.set(username, true);
          results.set(username, true);
        } catch {
          profileExistsCache.set(username, false);
          results.set(username, false);
        }
      }),
    );
  }

  return results;
}

/**
 * Validate username existence using the username check endpoint
 * @param usernames - Array of usernames to validate
 * @returns Map of username to existence status
 */
export async function validateProfilesViaUsername(
  usernames: string[],
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  // Check cache first
  const uncachedUsernames = usernames.filter(
    (username) => !profileExistsCache.has(username),
  );

  // Copy cached results
  usernames.forEach((username) => {
    const cached = profileExistsCache.get(username);
    if (cached !== undefined) {
      results.set(username, cached);
    }
  });

  // Validate uncached usernames
  if (uncachedUsernames.length > 0) {
    await Promise.all(
      uncachedUsernames.map(async (username) => {
        try {
          const result = await query<{ exists: boolean }>("username:get", {
            username,
          });
          profileExistsCache.set(username, result.exists);
          results.set(username, result.exists);
        } catch {
          profileExistsCache.set(username, false);
          results.set(username, false);
        }
      }),
    );
  }

  return results;
}

/**
 * Create markdown instance with validation results
 * @param validProfiles - Map of usernames to their validation status
 * @returns Configured MarkdownIt instance
 */
export function createMarkdownInstance(
  validProfiles: Map<string, boolean>,
): MarkdownIt {
  return new MarkdownIt({ linkify: true }).use(mention, {
    localDomain: (_bareHandle: string) => {
      // Return the current app domain for bare handles like @miro
      if (typeof window !== "undefined") {
        return window.location.hostname;
      }
      return "localhost"; // fallback for SSR
    },
    link: (handle: string) => {
      // Extract just the username part (before @domain if present)
      const username = handle.startsWith("@")
        ? (handle.slice(1).split("@")[0] ?? "")
        : (handle.split("@")[0] ?? "");

      // Only create link if profile exists
      const exists = validProfiles.get(username);
      return exists ? `/@${username}` : null;
    },
    linkAttributes: () => ({
      class: "text-primary hover:text-primary/80 font-medium",
    }),
  });
}

/**
 * Clear the profile existence cache
 * Useful for testing or when profile data changes
 */
export function clearProfileCache(): void {
  profileExistsCache.clear();
}
