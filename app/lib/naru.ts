// The page's Naru client: the site's queries and mutations, as the signed-in
// member when there is one and as a visitor otherwise, live queries, and
// sign-in. Every call to the site's code goes through here.
//
// The SDK is a URL import Naru serves, loaded on first use in the browser:
// the build renders index.html in Node, which cannot import it.
import type {
  Admin,
  Json,
  Live,
  Member,
  NaruClient,
  NaruError,
} from "https://sdk.naru.pub/sdk/1.1.0/naru.js";

export type { NaruError };

const SDK = "https://sdk.naru.pub/sdk/1.1.0/naru.js";
type Sdk = typeof import("https://sdk.naru.pub/sdk/1.1.0/naru.js");

let sdk: Promise<Sdk> | null = null;
let client: Promise<NaruClient> | null = null;
/** The SDK module, once loaded (for `instanceof NaruError`). */
let loaded: Sdk | null = null;

function loadSdk(): Promise<Sdk> {
  sdk ??= (import(/* @vite-ignore */ SDK) as Promise<Sdk>).then((module) => {
    loaded = module;
    return module;
  });
  return sdk;
}

/** The page's client, bound to this site. */
export function getNaru(): Promise<NaruClient> {
  client ??= loadSdk().then(({ createNaru }) => createNaru());
  return client;
}

let memberSession: Promise<Member | null> | null = null;

/** The signed-in member, or null; finishes a sign-in Naru redirected back from. */
export function getMember(): Promise<Member | null> {
  memberSession ??= getNaru()
    .then((naru) => naru.members.session())
    .catch(() => null);
  return memberSession;
}

/** Sends the visitor to Naru to sign in as a member, and back here. */
export async function signIn(): Promise<void> {
  await (await getNaru()).members.signIn();
}

export async function signOut(): Promise<void> {
  const member = await getMember();
  memberSession = Promise.resolve(null);
  await member?.signOut();
}

/** The site's owner signed in on this page as the owner, or null. */
export async function ownerSession(): Promise<Admin | null> {
  return (await getNaru()).auth.session();
}

/** Sends the site's owner to Naru to sign in, with no collections. */
export async function ownerSignIn(): Promise<void> {
  await (await getNaru()).auth.signIn();
}

/**
 * A call's arguments as JSON, as commung's fetch sent them: fields left
 * `undefined` (commung's way of leaving one out) are dropped, which the SDK
 * would otherwise refuse.
 */
const json = (args: object | null | undefined): Json | undefined =>
  args == null ? undefined : (JSON.parse(JSON.stringify(args)) as Json);

/** Runs `name` from the site's _naru/queries/, as the member if signed in. */
export async function query<R>(name: string, args?: object): Promise<R> {
  const member = await getMember();
  return (member ?? (await getNaru())).query<R>(name, json(args));
}

/** Runs `name` from the site's _naru/mutations/ as the signed-in member. */
export async function mutate<R>(name: string, args?: object): Promise<R> {
  const member = await getMember();
  if (!member) {
    await signIn();
    throw new Error("로그인이 필요합니다");
  }
  return member.mutate<R>(name, json(args));
}

/**
 * Keeps a query's answer current: `onResult` with each new answer, until the
 * returned function is called.
 */
export function subscribe<R>(
  name: string,
  args: object | null,
  onResult: (result: R) => void,
  onError?: (error: NaruError) => void,
): () => void {
  let live: Live | null = null;
  let closed = false;
  Promise.all([getMember(), getNaru()]).then(([member, naru]) => {
    if (closed) return;
    live = (member ?? naru).subscribe<R>(name, json(args) ?? null, onResult, {
      onError: (error) => onError?.(error),
    });
  });
  return () => {
    closed = true;
    live?.close();
  };
}

const isNaruError = (error: unknown): error is NaruError =>
  loaded !== null && error instanceof loaded.NaruError;

/** The message of a failed call, for a toast; `fallback` for anything else. */
export function errorMessage(error: unknown, fallback: string): string {
  if (isNaruError(error)) return error.message || fallback;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** The site's own reason a call refused with (`ctx.fail`'s details.reason). */
export function reasonOf(error: unknown): string | null {
  if (!isNaruError(error)) return null;
  const details = error.details as { reason?: unknown } | undefined;
  return typeof details?.reason === "string" ? details.reason : null;
}
