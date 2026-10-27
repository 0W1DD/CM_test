import { useEffect, useState } from "react";
import type { NaruError } from "~/lib/naru";
import { subscribe } from "~/lib/naru";

/**
 * A live query's latest answer for the messages pages: `subscribe` while
 * `args` is set, closed on change or unmount; null args pause it. With
 * `keepPrevious`, the last answer stays while new args load (a longer page).
 */
export function useLive<R>(
  name: string,
  args: object | null,
  { keepPrevious = false } = {},
) {
  const key = args ? JSON.stringify(args) : null;
  const [state, setState] = useState<{
    key: string | null;
    data: R | undefined;
    error: NaruError | null;
  }>({ key: null, data: undefined, error: null });

  useEffect(() => {
    if (key === null) return;
    return subscribe<R>(
      name,
      JSON.parse(key),
      (data) => setState({ key, data, error: null }),
      (error) => setState((prev) => ({ ...prev, key, error })),
    );
  }, [name, key]);

  const current = state.key === key;
  return {
    data: current || keepPrevious ? state.data : undefined,
    error: current ? state.error : null,
    /** No answer yet for these args. */
    isLoading:
      key !== null && !(current && (state.data !== undefined || state.error)),
  };
}
