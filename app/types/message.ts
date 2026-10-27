/**
 * Message and conversation types: what the site's messages and groupChats
 * calls answer (naru/queries/messages.ts, groupChats.ts).
 */
import type { Profile } from "~/types/profile";

/** A profile as messages show it. */
export interface MessageProfile {
  id: string;
  name: string;
  username: string;
  profile_picture_url: string | null;
}

export interface MessageImage {
  id: string;
  url: string;
  width: number;
  height: number;
  filename: string;
  created_at: string | null;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  profiles: MessageProfile[];
}

export interface Conversation {
  other_profile?: {
    id: string;
    username: string;
    name: string;
    profile_picture_url?: string | null;
  };
  last_message?: {
    id: string;
    content: string;
    created_at: string;
    is_sender: boolean;
  };
  unread_count: string;
}

export interface GroupChat {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  created_by_id: string;
  member_count: number;
  members: MessageProfile[];
  last_message?: {
    id: string;
    content: string;
    created_at: string;
    sender: MessageProfile;
    is_sender: boolean;
  } | null;
  unread_count: number;
}

/** `groupChats:get`. */
export interface GroupChatInfo {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  created_by_id: string;
  members: MessageProfile[];
  member_count: number;
}

export interface DirectMessage {
  id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  is_sender: boolean;
  sender: MessageProfile;
  /** Absent on a just-sent message (`messages:send`). */
  receiver?: MessageProfile;
  reactions: MessageReaction[];
  images: MessageImage[];
}

/** `messages:conversation`. */
export interface ConversationThread {
  other_profile: Profile;
  messages: DirectMessage[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
    total_count: number;
  };
}

export interface GroupChatMessage {
  id: string;
  content: string;
  created_at: string;
  sender: MessageProfile;
  is_sender: boolean;
  /** Absent on a just-sent message (`groupChats:send`). */
  reactions?: MessageReaction[];
  images: MessageImage[];
}

/** `groupChats:messages`. */
export interface GroupChatMessagePage {
  messages: GroupChatMessage[];
  pagination: { next_cursor: string | null; has_more: boolean };
}
