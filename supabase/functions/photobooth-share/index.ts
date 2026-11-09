import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-action, x-site-origin, x-cleanup-secret, x-booth-password",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const BUCKET = "photobooth-temp";
const TTL_MS = 10 * 60 * 1000;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function makeToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const action = req.headers.get("x-action") || "";

  if (action === "cleanup") {
    const secret = Deno.env.get("PHOTOBOOTH_CLEANUP_SECRET") || "";
    if (!secret || req.headers.get("x-cleanup-secret") !== secret) return json({ ok: false, error: "Unauthorized." }, 401);
    const { data: expired, error } = await supabase.from("photobooth_temp_photos").select("token_hash,object_path").lte("expires_at", new Date().toISOString()).limit(500);
    if (error) return json({ ok: false, error: error.message }, 500);
    if (!expired?.length) return json({ ok: true, deleted: 0 });
    const paths = expired.map((x: { object_path: string }) => x.object_path);
    const removed = await supabase.storage.from(BUCKET).remove(paths);
    if (removed.error) return json({ ok: false, error: removed.error.message }, 500);
    const hashes = expired.map((x: { token_hash: string }) => x.token_hash);
    const deleted = await supabase.from("photobooth_temp_photos").delete().in("token_hash", hashes);
    if (deleted.error) return json({ ok: false, error: deleted.error.message }, 500);
    return json({ ok: true, deleted: paths.length });
  }

  if (action === "upload") {
    // Require the same organizer password already used by the Photo Booth login.
    const boothPassword = req.headers.get("x-booth-password") || "";
    if (!boothPassword) return json({ ok: false, error: "Organizer session expired. Please log in again." }, 401);
    const organizerCheck = await supabase.rpc("admin_list", { p_password: boothPassword });
    if (organizerCheck.error) return json({ ok: false, error: "Organizer authorization failed. Please log in again." }, 401);
    const type = req.headers.get("content-type") || "";
    const length = Number(req.headers.get("content-length") || "0");
    if (!type.includes("image/jpeg")) return json({ ok: false, error: "Only JPEG photos are accepted." }, 415);
    if (length > 8 * 1024 * 1024) return json({ ok: false, error: "Photo is too large (maximum 8 MB)." }, 413);
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (!bytes.length || bytes.length > 8 * 1024 * 1024) return json({ ok: false, error: "Invalid photo size." }, 400);
    const token = makeToken();
    const tokenHash = await sha256(token);
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
    const upload = await supabase.storage.from(BUCKET).upload(path, new Blob([bytes], { type: "image/jpeg" }), { contentType: "image/jpeg", cacheControl: "0", upsert: false });
    if (upload.error) return json({ ok: false, error: upload.error.message }, 500);
    const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
    const saved = await supabase.from("photobooth_temp_photos").insert({ token_hash: tokenHash, object_path: path, expires_at: expiresAt });
    if (saved.error) {
      await supabase.storage.from(BUCKET).remove([path]);
      return json({ ok: false, error: "Could not register temporary photo." }, 500);
    }
    const origin = req.headers.get("origin") || req.headers.get("x-site-origin") || "";
    if (!origin.startsWith("https://") && !origin.startsWith("http://localhost")) {
      await supabase.storage.from(BUCKET).remove([path]);
      await supabase.from("photobooth_temp_photos").delete().eq("token_hash", tokenHash);
      return json({ ok: false, error: "Invalid website origin." }, 400);
    }
    return json({ ok: true, shareUrl: `${origin.replace(/\/$/, "")}/photo.html?t=${token}`, expiresAt });
  }

  if (action === "resolve") {
    let body: { token?: string } = {};
    try { body = await req.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }
    const token = String(body.token || "");
    if (!/^[a-f0-9]{64}$/.test(token)) return json({ ok: false, error: "Invalid or expired photo link." }, 404);
    const tokenHash = await sha256(token);
    const { data: row, error } = await supabase.from("photobooth_temp_photos").select("object_path,expires_at").eq("token_hash", tokenHash).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (error || !row) return json({ ok: false, error: "This photo link has expired or is unavailable." }, 404);
    const remaining = Math.max(1, Math.floor((new Date(row.expires_at).getTime() - Date.now()) / 1000));
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(row.object_path, remaining, { download: "Coachella-Photo.jpg" });
    if (signed.error || !signed.data?.signedUrl) return json({ ok: false, error: "Could not create the download link." }, 500);
    return json({ ok: true, signedUrl: signed.data.signedUrl, expiresAt: row.expires_at });
  }
  return json({ ok: false, error: "Unknown action." }, 400);
});
