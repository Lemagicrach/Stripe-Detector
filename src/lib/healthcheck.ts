// src/lib/healthcheck.ts
//
// Tiny helper for healthchecks.io cron heartbeats.
//
// Usage in a cron route:
//
//   const HC = process.env.HC_SYNC_ALL_URL;
//   await pingHealthcheck(HC, "start");
//   try {
//     // ...business logic...
//     await pingHealthcheck(HC);              // success ping
//     return NextResponse.json({ ok: true });
//   } catch (err) {
//     await pingHealthcheck(HC, "fail");
//     throw err;
//   }
//
// The function never throws even if the network is down or the URL is
// missing — a broken healthchecks.io must not break the underlying cron.

export async function pingHealthcheck(
  url: string | undefined,
  status?: "start" | "fail"
): Promise<void> {
  if (!url) return;
  const target = status ? `${url}/${status}` : url;
  try {
    await fetch(target, { method: "HEAD" });
  } catch {
    // healthchecks.io being unreachable must not break the cron
  }
}
