<# ============================================================
   RevPilot - fix-auth.ps1
   Recreates missing auth files

   Run:  .\fix-auth.ps1
   ============================================================ #>

$ErrorActionPreference = "Stop"

function Write-Impl {
    param([string]$Path, [string]$Content)
    $targetPath = if ([System.IO.Path]::IsPathRooted($Path)) {
        $Path
    } else {
        Join-Path $PSScriptRoot $Path
    }

    $dir = Split-Path $targetPath -Parent
    if ($dir -and !(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    Set-Content -Path $targetPath -Value $Content -Encoding UTF8
    Write-Host "  [ok] $targetPath" -ForegroundColor Green
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "RevPilot - Auth Fix (2 files)" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# 1) src/proxy.ts
Write-Host "Step 1 - src/proxy.ts" -ForegroundColor Yellow
Write-Impl "src/proxy.ts" @'
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
'@

# 2) src/app/auth/callback/route.ts
Write-Host "Step 2 - src/app/auth/callback/route.ts" -ForegroundColor Yellow
Write-Impl "src/app/auth/callback/route.ts" @'
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
'@

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "Auth files fixed" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
