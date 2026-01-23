/**
 * Hash a string using Web Crypto API (Bun native)
 */
export async function hashSomething(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compare a plain value with a hash
 */
export async function compareHash(
  plainValue: string,
  hashedValue: string,
): Promise<boolean> {
  const hash = await hashSomething(plainValue);
  return hash === hashedValue;
}
