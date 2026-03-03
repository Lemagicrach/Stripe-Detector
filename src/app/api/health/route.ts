import { NextResponse } from "next/server";

export async function GET() {
  const checks: Record<string, boolean> = {
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseService: !!process.env.SUPABASE_SERVICE_KEY,
    stripeSecret: !!process.env.STRIPE_SECRET_KEY,
    stripeClientId: !!process.env.STRIPE_CLIENT_ID,
    encryptionKey: !!process.env.ENCRYPTION_KEY,
    anthropicKey: !!process.env.ANTHROPIC_API_KEY,
    cronSecret: !!process.env.CRON_SECRET,
  };

  const allHealthy = Object.values(checks).every(Boolean);
  const missing = Object.entries(checks)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  return NextResponse.json(
    {
      status: allHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
      ...(missing.length > 0 && { missing }),
    },
    { status: allHealthy ? 200 : 503 }
  );
}
