export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness probe for Cloud Run. Deliberately touches nothing downstream. */
export function GET(): Response {
  return Response.json({ status: "ok", uptime: process.uptime() });
}
