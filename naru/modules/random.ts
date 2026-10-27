// Randomness for site code. Naru answers Math.random() on the host, from
// crypto.getRandomValues (32 bits a call), and counts every call as one of
// the call's 100 operations, as it counts ctx.sql. So randomness that need
// not be secret (row IDs, dice, coins) comes from a generator (xoshiro128**)
// seeded once per call with 128 bits from the host, and secrets take their
// bits from the host directly.

/** 32 random bits from the host: one operation. */
export const hostWord = () => Math.floor(Math.random() * 2 ** 32) >>> 0;

let state: Uint32Array | null = null;

function seeded(): Uint32Array {
  if (!state) {
    state = new Uint32Array([hostWord(), hostWord(), hostWord(), hostWord()]);
    // xoshiro must not start from all zeros.
    if (!(state[0] | state[1] | state[2] | state[3])) state[0] = 1;
  }
  return state;
}

const rotl = (x: number, k: number) => ((x << k) | (x >>> (32 - k))) >>> 0;

/** 32 bits from the generator. */
export function word(): number {
  const s = seeded();
  const result = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
  const t = (s[1] << 9) >>> 0;
  s[2] ^= s[0];
  s[3] ^= s[1];
  s[1] ^= s[2];
  s[0] ^= s[3];
  s[2] ^= t;
  s[3] = rotl(s[3], 11);
  return result;
}

/** 0 to n - 1, evenly (n at most 2^32). */
export function randomInt(n: number): number {
  const limit = 2 ** 32 - (2 ** 32 % n);
  for (;;) {
    const w = word();
    if (w < limit) return w % n;
  }
}
