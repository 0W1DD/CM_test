import { useEffect, useMemo, useState } from "react";
import {
  createMarkdownInstance,
  extractMentions,
  getReadOnlyMarkdownInstance,
  validateProfiles,
  validateProfilesViaUsername,
} from "~/lib/markdown-utils";

interface UseMarkdownWithMentionsOptions {
  /**
   * The text content to process
   */
  content: string;
  /**
   * Whether to use the username validation endpoint instead of profile lookup
   * @default false
   */
  useUsernameValidation?: boolean;
}

/**
 * Custom hook to handle markdown rendering with mention validation
 * Extracts mentions, validates them, and returns a configured markdown instance
 */
export function useMarkdownWithMentions({
  content,
  useUsernameValidation = false,
}: UseMarkdownWithMentionsOptions) {
  const [validProfiles, setValidProfiles] = useState<Map<string, boolean>>(
    new Map(),
  );

  // Extract mentions and validate them (skip validation for read-only content)
  useEffect(() => {
    // For read-only content, we don't need to validate mentions
    // We'll use the singleton instance instead
    if (useUsernameValidation === false) {
      return;
    }

    async function validateMentions() {
      const mentions = extractMentions(content);

      if (mentions.length === 0) {
        setValidProfiles(new Map());
        return;
      }

      const validationResults = useUsernameValidation
        ? await validateProfilesViaUsername(mentions)
        : await validateProfiles(mentions);
      setValidProfiles(validationResults);
    }

    validateMentions();
  }, [content, useUsernameValidation]);

  // Use singleton instance for read-only content, otherwise create a custom instance
  const md = useMemo(() => {
    if (useUsernameValidation === false) {
      // Use shared singleton instance for read-only posts (in feeds)
      return getReadOnlyMarkdownInstance();
    }
    // Create custom instance with validation for editable content
    return createMarkdownInstance(validProfiles);
  }, [useUsernameValidation, validProfiles]);

  return { md, validProfiles };
}
