import { hash, verify } from "@node-rs/argon2";

// argon2id with reasonably strong defaults for an interactive login (not a
// high-throughput API), tuned so hashing takes roughly 30-60ms on typical
// hardware rather than the library's very cheap defaults.
const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

export function verifyPassword(hashStr: string, plain: string): Promise<boolean> {
  return verify(hashStr, plain);
}
