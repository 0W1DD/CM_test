// What the tests share: callers, refusals, and a community set up with an
// owner, members and profiles.
import { testSite } from "./sql-ctx.mjs";

export const OWNER_SITE = { owner: true };
export const VISITOR = {};
export const as = (member) => ({ member });

/** The reason a call refused with (its ctx.fail details), its code, or null. */
export const refusal = (call) =>
  call.then(
    () => null,
    (error) => {
      if (error.details?.reason) return error.details.reason;
      if (error.code) return error.code;
      throw error;
    },
  );

let counter = 0;
/** A UUID-shaped ID for rows a test makes directly. */
export const uuid = () =>
  `00000000-0000-7000-8000-${String(++counter).padStart(12, "0")}`;

/**
 * A community opened by the site's owner, with `owner` (m-owner) claimed as
 * its owner and each of `members` approved, each with one active profile
 * named after them (`profiles[name]` is its ID).
 */
export async function community({ members = ["alice", "bob"], ...options } = {}) {
  const site = await testSite(options);
  await site.mutate(
    "owner:setup",
    {
      name: "테스트 커뮤",
      starts_at: new Date(site.now - 86400000).toISOString(),
      ends_at: new Date(site.now + 30 * 86400000).toISOString(),
    },
    OWNER_SITE,
  );
  await site.mutate("owner:claim", { member: "m-owner" }, OWNER_SITE);
  const profiles = {};
  profiles.owner = addProfile(site, "m-owner", "owner");
  for (const name of members) {
    site.run(
      "INSERT INTO members (member, role, created_at, updated_at, activated_at) VALUES (?, 'member', ?, ?, ?)",
      `m-${name}`,
      site.now,
      site.now,
      site.now,
    );
    profiles[name] = addProfile(site, `m-${name}`, name);
  }
  return { site, profiles };
}

/** An active profile `username` owned by `member`; answers its ID. */
export function addProfile(site, member, username, { primary = true } = {}) {
  const id = uuid();
  site.run(
    `INSERT INTO profiles (id, name, username, is_primary, activated_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    username.toUpperCase(),
    username,
    primary ? 1 : 0,
    site.now,
    site.now,
    site.now,
  );
  site.run(
    "INSERT INTO profile_owners (profile_id, member, role, created_at, created_by) VALUES (?, ?, 'owner', ?, ?)",
    id,
    member,
    site.now,
    member,
  );
  return id;
}
