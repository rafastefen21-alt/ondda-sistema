import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/", "/login", "/cadastro", "/loja", "/api/loja", "/api/auth", "/_next", "/favicon"];

export default auth(async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  // @ts-expect-error auth extends NextRequest
  const session = req.auth;

  if (!session?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { role } = session.user;

  // Super admin can go anywhere
  if (role === "SUPER_ADMIN") return NextResponse.next();

  // Admin routes only for SUPER_ADMIN
  if (pathname.startsWith("/admin") && role !== "SUPER_ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Financial and invoice routes restricted to clients
  if (
    (pathname.startsWith("/financeiro") || pathname.startsWith("/notas")) &&
    role === "CLIENTE"
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Production routes restricted to internal roles
  if (pathname.startsWith("/producao") && role === "CLIENTE") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
