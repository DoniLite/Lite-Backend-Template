import type { Buffer } from "node:buffer";
import { password } from "bun";

export const hashSomething = async (data: string | Buffer) => {
  return await password.hash(data, "bcrypt");
};

export const compareHash = async (data: string | Buffer, hash: string) => {
  return await password.verify(data, hash, "bcrypt");
};
