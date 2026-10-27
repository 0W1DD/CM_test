export interface PostImage {
  id: string;
  url: string;
  width: number;
  height: number;
  filename: string;
}

export interface PostAuthor {
  id: string;
  name: string;
  username: string;
  profile_picture_url: string | null;
}

export interface PostReaction {
  emoji: string;
  user: {
    id: string;
    username: string;
    name: string;
  };
}

export interface PostHistoryEntry {
  id: string;
  content: string;
  content_warning: string | null;
  edited_at: string;
  edited_by: PostAuthor;
  images: PostImage[];
}

// Matches the unified post shape returned by all API endpoints
export interface Post {
  id: string;
  content: string;
  created_at: string | null;
  updated_at: string | null;
  announcement: boolean;
  content_warning: string | null;
  pinned_at: string | null;
  author: PostAuthor;
  images: PostImage[];
  in_reply_to_id: string | null;
  depth: number;
  root_post_id: string | null;
  is_bookmarked: boolean;
  replies: Post[];
  reply_count: number;
  has_more_replies: boolean;
  reactions: PostReaction[];
  // Endpoint-specific extras
  scheduled_at?: string | null;
  published_at?: string | null;
  parent_thread?: Post[];
  bookmarked_at?: string | null;
  parent_summary?: {
    id: string;
    content_excerpt: string;
    author: { id: string; name: string; username: string };
  } | null;
}

/** A page of a cursor-paged list, as the posts queries answer. */
export interface Page<T> {
  data: T[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
    total_count?: number;
  };
}

// Component props interfaces
export interface PostCardProps {
  post: Post;
  currentProfileId?: string;
  onDelete?: () => void;
  onRefresh?: () => void;
  isCommunityOwner?: boolean;
  isModerator?: boolean;
  hideBorder?: boolean;
  isProfileView?: boolean;
  displayDepth?: number;
  isContinuation?: boolean;
}

export interface PostListRef {
  refresh: () => void;
}
