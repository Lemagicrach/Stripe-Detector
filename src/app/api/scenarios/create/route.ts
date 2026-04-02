import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { handleApiError, unauthorized } from "@/lib/server-error";

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    // TODO: Implement route logic

    return NextResponse.json({ data: null });
  } catch (error) {
    return handleApiError(error);
  }
}
