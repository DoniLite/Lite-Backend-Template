import { appConfig } from "@/core/config/app.config";
import { canAccess, UserRoles, WRITE_ACCESS } from "@/helpers/access.helper";
import type { Context, Next } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { sign, verify } from "hono/jwt";
import { JWTSessionBase } from "./types";

export const adminMiddleware = async (c: Context, next: Next) => {
  const payload = c.get("jwtPayload");
  if (!canAccess(payload.role as UserRoles, WRITE_ACCESS)) {
    return c.json({ error: "Admin access required" }, 403);
  }
  await next();
};

export const authMiddleware = async (c: Context, next: Next) => {
  const sessionCookie = getCookie(c, "session");
  const authHeader = c.req.header("Authorization");

  if (!sessionCookie && !authHeader) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader ? authHeader.replace("Bearer ", "") : sessionCookie;

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const secret = appConfig.jwt.secret;

  if (!secret) {
    throw new HTTPException(500, {
      message: "some data are missing for this operation \n => JWT_SECRET",
    });
  }

  try {
    const payload = await verify(token, secret);
    await setupCookieSession(c, JWTSessionBase.from(payload));
    await next();
  } catch (e) {
    console.log("jwt error ===>", e);
    return c.json({ error: "Unauthorized" }, 401);
  }
};

export const setupCookieSession = async (
  c: Context,
  payload: JWTSessionBase,
): Promise<string> => {
  const expireDate = new Date();
  expireDate.setHours(expireDate.getHours() + 5);

  const newPayload = {
    userId: payload.userId,
    role: payload.role,
    exp: expireDate.getTime(),
  };

  const newToken = await sign(newPayload, appConfig.jwt.secret);

  setCookie(c, "session", newToken, {
    httpOnly: true,
    secure: appConfig.env === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 5,
  });

  c.set("jwtPayload", payload);

  return newToken;
};

export const clearCookieSession = (c: Context) => {
  deleteCookie(c, "session");
};
