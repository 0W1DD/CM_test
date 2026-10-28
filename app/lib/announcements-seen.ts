/**
 * Which announcements this browser has seen: the time of the newest one
 * when the reader last looked, kept in localStorage. Before any visit,
 * every announcement counts as new.
 */
const KEY = "announcements-seen-at";

function seenAt(): number {
  try {
    const value = localStorage.getItem(KEY);
    return value ? Date.parse(value) || 0 : 0;
  } catch {
    return 0;
  }
}

/** How many of these announcements are newer than the last look. */
export function unseenAnnouncements(
  posts: { created_at: string | null }[],
): number {
  const since = seenAt();
  return posts.filter(
    (post) => post.created_at && Date.parse(post.created_at) > since,
  ).length;
}

/** Marks everything up to the newest of these announcements as seen. */
export function markAnnouncementsSeen(posts: { created_at: string | null }[]) {
  const newest = posts[0]?.created_at;
  if (!newest) return;
  try {
    localStorage.setItem(KEY, newest);
  } catch {
    // Private windows may refuse; the dot then simply stays.
  }
}
