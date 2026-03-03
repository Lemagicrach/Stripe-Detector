import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Protect dashboard routes
    "/dashboard/:path*",
    // Skip static files and API routes that handle their own auth
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/cron|api/health).*)",
  ],
};
