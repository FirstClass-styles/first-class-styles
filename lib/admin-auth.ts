import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "fcs_admin_session";
const SESSION_SECONDS = 12 * 60 * 60;

function secret() {
  return process.env.ADMIN_SESSION_SECRET || "";
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function adminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD && secret().length >= 32);
}

export function validAdminSession(request: NextRequest) {
  if (!adminConfigured()) return false;
  const token = request.cookies.get(COOKIE_NAME)?.value || "";
  const [issued, supplied] = token.split(".");
  if (!issued || !supplied || !/^\d{10,}$/.test(issued)) return false;
  const age = Math.floor(Date.now() / 1000) - Number(issued);
  if (age < 0 || age > SESSION_SECONDS) return false;
  const expected = Buffer.from(signature(issued));
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function setAdminSession(response: NextResponse) {
  const issued = String(Math.floor(Date.now() / 1000));
  response.cookies.set(COOKIE_NAME, issued + "." + signature(issued), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export function clearAdminSession(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === request.nextUrl.origin);
}
