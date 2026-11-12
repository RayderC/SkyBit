// "Sign in with Amethyst": settings, and the two halves of the sign-in (off to Amethyst, back with a pass).
import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { getConfig, getUserByUsername, setConfig } from "./db";
import { getSession } from "./session";
import { recordSignIn } from "./signIns";
import { isGoodSecret, originFrom, verifyPass } from "./ssoCore";

export const SSO_APP = "skybit";
const COOKIE = "skybit_sso_state";

export function ssoConfig(): { url: string; secret: string; fromEnv: boolean } | null {
  const envUrl = process.env.AMETHYST_URL, envSecret = process.env.AMETHYST_SSO_SECRET;
  if (envUrl && isGoodSecret(envSecret)) return { url: envUrl.replace(/\/+$/, ""), secret: envSecret.trim(), fromEnv: true };
  const url = getConfig("sso_url"), secret = getConfig("sso_secret");
  return url && isGoodSecret(secret) ? { url, secret: secret.trim(), fromEnv: false } : null;
}

export function saveSsoConfig(v: { url: string; secret: string } | null) {
  setConfig("sso_url", v ? v.url : "");
  setConfig("sso_secret", v ? v.secret : "");
}

const originOf = (req: NextApiRequest) => originFrom(n => req.headers[n]);
const cookie = (value: string, origin: string, maxAge: number) =>
  `${COOKIE}=${value}; Path=/api/sso; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${origin.startsWith("https:") ? "; Secure" : ""}`;

export function startSso(req: NextApiRequest, res: NextApiResponse) {
  const cfg = ssoConfig();
  const origin = originOf(req);
  if (!cfg) return res.redirect(302, "/login?sso_error=Sign+in+with+Amethyst+isn%27t+set+up");
  const state = crypto.randomBytes(24).toString("base64url");
  const to = new URL("/sso", cfg.url);
  to.search = new URLSearchParams({ app: SSO_APP, return: `${origin}/api/sso/callback`, state }).toString();
  res.setHeader("Set-Cookie", cookie(state, origin, 600));
  res.redirect(302, to.toString());
}

export async function finishSso(req: NextApiRequest, res: NextApiResponse) {
  const origin = originOf(req);
  const fail = (msg: string) => {
    res.setHeader("Set-Cookie", cookie("", origin, 0));
    res.redirect(302, `/login?sso_error=${encodeURIComponent(msg)}`);
  };
  const cfg = ssoConfig();
  if (!cfg) return fail("Sign in with Amethyst isn't set up here.");
  const saved = req.cookies[COOKIE] ?? "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  if (!saved || saved !== state) return fail("That sign-in didn't start here. Try again.");
  let sub: string;
  try { sub = verifyPass(cfg.secret, req.query.token, { aud: origin, nonce: saved, app: SSO_APP }).sub; }
  catch (e) { return fail((e as Error).message); }
  const user = getUserByUsername(sub);
  if (!user) return fail(`There's no SkyBit account named "${sub}". Ask an admin to make one with that name.`);
  const session = await getSession(req, res);
  session.userId = user.id;
  session.username = user.username;
  session.role = user.role;
  session.tokenVersion = user.tokenVersion ?? 0;
  await session.save();
  recordSignIn(user.id, req);
  // iron-session set its cookie already; add ours (cleared) alongside it.
  const prev = res.getHeader("Set-Cookie");
  res.setHeader("Set-Cookie", [...(Array.isArray(prev) ? prev : prev ? [String(prev)] : []), cookie("", origin, 0)]);
  res.redirect(302, "/");
}
