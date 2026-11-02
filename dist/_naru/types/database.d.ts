// Written by naru dev from the site's tables: do not edit.

/** Table community_links. */
export interface CommunityLinks {
  id: string;
  title: string;
  url: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

/** Table images. */
export interface Images {
  id: string;
  url: string;
  width: number;
  height: number;
  filename: string;
  member: string | null;
  created_at: number;
  deleted_at: number | null;
}

/** Table members. */
export interface Members {
  member: string;
  role: string;
  application_id: string | null;
  created_at: number;
  updated_at: number;
  activated_at: number | null;
}

/** Table applications. */
export interface Applications {
  id: string;
  member: string;
  message: string | null;
  status: string;
  profile_name: string;
  profile_username: string;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: number | null;
  created_at: number;
  updated_at: number;
  profile_id: string | null;
}

/** Table application_attachments. */
export interface ApplicationAttachments {
  id: string;
  application_id: string;
  image_id: string;
  created_at: number;
}

/** Table member_blocks. */
export interface MemberBlocks {
  blocker: string;
  blocked: string;
  created_at: number;
  profile_id: string | null;
}

/** Table profiles. */
export interface Profiles {
  id: string;
  name: string;
  username: string;
  bio: string | null;
  picture_id: string | null;
  is_primary: number;
  muted_at: number | null;
  muted_by_id: string | null;
  online_status_visible: number;
  activated_at: number | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

/** Table profile_owners. */
export interface ProfileOwners {
  profile_id: string;
  member: string;
  role: string;
  created_at: number;
  created_by: string;
}

/** Table profile_activity. */
export interface ProfileActivity {
  profile_id: string;
  last_active_at: number;
}

/** Table posts. */
export interface Posts {
  id: string;
  content: string;
  content_warning: string | null;
  announcement: number;
  author_id: string;
  created_by: string;
  in_reply_to_id: string | null;
  root_post_id: string | null;
  depth: number;
  scheduled_at: number | null;
  published_at: number | null;
  pinned_at: number | null;
  bumped_at: number | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  location: string;
}

/** Table post_images. */
export interface PostImages {
  post_id: string;
  image_id: string;
  position: number;
}

/** Table post_reactions. */
export interface PostReactions {
  post_id: string;
  profile_id: string;
  emoji: string;
  created_at: number;
}

/** Table post_bookmarks. */
export interface PostBookmarks {
  profile_id: string;
  post_id: string;
  created_at: number;
}

/** Table post_history. */
export interface PostHistory {
  id: string;
  post_id: string;
  content: string;
  content_warning: string | null;
  image_ids: string;
  edited_at: number;
  edited_by_profile_id: string;
}

/** Table mentions. */
export interface Mentions {
  profile_id: string;
  post_id: string;
  created_at: number;
}

/** Table hashtags. */
export interface Hashtags {
  tag: string;
  created_at: number;
}

/** Table post_hashtags. */
export interface PostHashtags {
  post_id: string;
  tag: string;
}

/** Table posts_search. */
export interface PostsSearch {
  post_id: unknown | null;
  content: unknown | null;
  content_warning: unknown | null;
}

/** Table moderation_log. */
export interface ModerationLog {
  id: string;
  action: string;
  description: string;
  moderator: string;
  target_member: string | null;
  target_profile_id: string | null;
  target_post_id: string | null;
  extra_data: string | null;
  created_at: number;
}

/** Table post_reports. */
export interface PostReports {
  id: string;
  post_id: string;
  reporter_profile_id: string;
  reporter_member: string;
  reason: string;
  created_at: number;
}

/** Table direct_messages. */
export interface DirectMessages {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_by: string;
  read_at: number | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

/** Table direct_message_images. */
export interface DirectMessageImages {
  message_id: string;
  image_id: string;
  position: number;
}

/** Table direct_message_reactions. */
export interface DirectMessageReactions {
  id: string;
  message_id: string;
  profile_id: string;
  emoji: string;
  created_at: number;
}

/** Table direct_message_deletions. */
export interface DirectMessageDeletions {
  message_id: string;
  profile_id: string;
  deleted_at: number;
}

/** Table group_chats. */
export interface GroupChats {
  id: string;
  name: string;
  created_by_id: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

/** Table group_chat_members. */
export interface GroupChatMembers {
  group_chat_id: string;
  profile_id: string;
  added_by_id: string | null;
  last_read_at: number | null;
  created_at: number;
}

/** Table group_chat_messages. */
export interface GroupChatMessages {
  id: string;
  group_chat_id: string;
  sender_id: string;
  created_by: string;
  content: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

/** Table group_chat_message_images. */
export interface GroupChatMessageImages {
  message_id: string;
  image_id: string;
  position: number;
}

/** Table group_chat_message_reactions. */
export interface GroupChatMessageReactions {
  id: string;
  message_id: string;
  profile_id: string;
  emoji: string;
  created_at: number;
}

/** Table group_chat_message_deletions. */
export interface GroupChatMessageDeletions {
  message_id: string;
  profile_id: string;
  deleted_at: number;
}

/** Table boards. */
export interface Boards {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  allow_comments: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

/** Table board_posts. */
export interface BoardPosts {
  id: string;
  board_id: string;
  author_id: string;
  title: string;
  content: string;
  image_id: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

/** Table board_replies. */
export interface BoardReplies {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  in_reply_to_id: string | null;
  depth: number;
  root_reply_id: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

/** Table board_notifications. */
export interface BoardNotifications {
  id: string;
  type: string;
  title: string;
  message: string;
  recipient: string;
  actor_profile_id: string | null;
  post_id: string;
  reply_id: string | null;
  read_at: number | null;
  created_at: number;
}

/** Table shop_currencies. */
export interface ShopCurrencies {
  id: string;
  name: string;
  description: string | null;
  is_default: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

/** Table shop_balances. */
export interface ShopBalances {
  id: string;
  profile_id: string;
  currency_id: string;
  amount: number;
  updated_at: number;
}

/** Table shop_items. */
export interface ShopItems {
  id: string;
  name: string;
  description: string | null;
  price_amount: number;
  currency_id: string;
  consumable: number;
  is_unique: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

/** Table shop_inventory. */
export interface ShopInventory {
  id: string;
  profile_id: string;
  item_id: string;
  qty: number;
  granted_at: number;
  updated_at: number;
}

/** Table shop_transactions. */
export interface ShopTransactions {
  id: string;
  profile_id: string;
  kind: string;
  source: string;
  currency_id: string | null;
  currency_delta: number | null;
  item_id: string | null;
  item_qty_delta: number | null;
  reason: string | null;
  actor_member: string | null;
  created_at: number;
}

/** Table bots. */
export interface Bots {
  id: string;
  name: string;
  description: string | null;
  profile_id: string;
  created_by: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

/** Table bot_tokens. */
export interface BotTokens {
  id: string;
  bot_id: string;
  hash: string;
  name: string | null;
  created_at: number;
  expires_at: number | null;
  revoked_at: number | null;
  last_used_at: number | null;
}

/** Table settings. */
export interface Settings {
  id: number;
  name: string;
  description: string | null;
  starts_at: number;
  ends_at: number;
  is_recruiting: number;
  recruiting_starts_at: number | null;
  recruiting_ends_at: number | null;
  minimum_birth_year: number | null;
  mute_new_members: number;
  show_all_replies: number;
  bump_on_reply: number;
  auto_approve: number;
  theme_key_color: string | null;
  banner_image_id: string | null;
  created_at: number;
  updated_at: number;
  command_bot_profile_id: string | null;
  custom_css: string | null;
  owner_files: number;
  gate_html: string | null;
  gate_image_id: string | null;
}

/** Table item_uses. */
export interface ItemUses {
  id: string;
  profile_id: string;
  item_id: string;
  item_name: string;
  note: string | null;
  secret: number;
  consumed: number;
  approved_at: number | null;
  approved_by: string | null;
  created_at: number;
  kind: string;
  target_profile_id: string | null;
  qty: number;
}

/** Table item_use_comments. */
export interface ItemUseComments {
  id: string;
  use_id: string;
  profile_id: string;
  content: string;
  created_at: number;
}

/** Table notifications. */
export interface Notifications {
  id: string;
  type: string;
  title: string;
  message: string;
  recipient_id: string;
  profile_id: string;
  post_id: string | null;
  direct_message_id: string | null;
  use_id: string | null;
  read_at: number | null;
  created_at: number;
}

/** Table message_views. */
export interface MessageViews {
  id: string;
  viewer_profile_id: string;
  viewer_member: string;
  profile_a: string;
  profile_b: string;
  created_at: number;
}

/** Table disabled_commands. */
export interface DisabledCommands {
  name: string;
}

export interface Database {
  community_links: CommunityLinks;
  images: Images;
  members: Members;
  applications: Applications;
  application_attachments: ApplicationAttachments;
  member_blocks: MemberBlocks;
  profiles: Profiles;
  profile_owners: ProfileOwners;
  profile_activity: ProfileActivity;
  posts: Posts;
  post_images: PostImages;
  post_reactions: PostReactions;
  post_bookmarks: PostBookmarks;
  post_history: PostHistory;
  mentions: Mentions;
  hashtags: Hashtags;
  post_hashtags: PostHashtags;
  posts_search: PostsSearch;
  moderation_log: ModerationLog;
  post_reports: PostReports;
  direct_messages: DirectMessages;
  direct_message_images: DirectMessageImages;
  direct_message_reactions: DirectMessageReactions;
  direct_message_deletions: DirectMessageDeletions;
  group_chats: GroupChats;
  group_chat_members: GroupChatMembers;
  group_chat_messages: GroupChatMessages;
  group_chat_message_images: GroupChatMessageImages;
  group_chat_message_reactions: GroupChatMessageReactions;
  group_chat_message_deletions: GroupChatMessageDeletions;
  boards: Boards;
  board_posts: BoardPosts;
  board_replies: BoardReplies;
  board_notifications: BoardNotifications;
  shop_currencies: ShopCurrencies;
  shop_balances: ShopBalances;
  shop_items: ShopItems;
  shop_inventory: ShopInventory;
  shop_transactions: ShopTransactions;
  bots: Bots;
  bot_tokens: BotTokens;
  settings: Settings;
  item_uses: ItemUses;
  item_use_comments: ItemUseComments;
  notifications: Notifications;
  message_views: MessageViews;
  disabled_commands: DisabledCommands;
}
