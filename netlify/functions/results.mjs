// Live results for Activity 2 (Eisenhower matrix). Stores each participant's answer in Netlify Blobs.
// POST {action:"submit", s, id, name, place:{1..6: 1..4}, score, feed}
// GET  ?s=CODE  -> {count, avg, items:{1..6:{1:n,2:n,3:n,4:n}}, people:[{name,score,feed,t}]}
import { getStore } from "@netlify/blobs";

const ok = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const code = (s) => String(s || "live").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 24) || "live";
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, n);

export default async (req) => {
  const store = getStore({ name: "eisenhower", consistency: "strong" });
  const url = new URL(req.url);
  if (req.method === "GET") {
    const s = code(url.searchParams.get("s"));
    const { blobs } = await store.list({ prefix: s + "/" });
    const rows = (await Promise.all(blobs.slice(0, 200).map(b => store.get(b.key, { type: "json" }).catch(() => null)))).filter(Boolean);
    const items = {}; for (let i = 1; i <= 6; i++) items[i] = { 1: 0, 2: 0, 3: 0, 4: 0 };
    let sum = 0, n = 0;
    for (const r of rows) {
      for (let i = 1; i <= 6; i++) { const q = r.place && r.place[i]; if (q >= 1 && q <= 4) items[i][q]++; }
      if (typeof r.score === "number") { sum += r.score; n++; }
    }
    rows.sort((a, b) => (a.t || 0) - (b.t || 0));
    return ok({ s, count: rows.length, avg: n ? Math.round(sum / n * 10) / 10 : 0, items,
      people: rows.map(r => ({ name: r.name, score: r.score, feed: r.feed || "", t: r.t })) });
  }
  if (req.method !== "POST") return ok({ error: "method" }, 405);
  let b; try { b = await req.json(); } catch { return ok({ error: "bad json" }, 400); }
  if (b.action === "ping") return ok({ ok: true });
  if (b.action !== "submit") return ok({ error: "unknown action" }, 400);
  const s = code(b.s), id = clean(b.id, 40).replace(/[^a-zA-Z0-9-]/g, "");
  if (!id) return ok({ error: "id" }, 400);
  const place = {}; for (let i = 1; i <= 6; i++) { const q = Number(b.place && b.place[i]); if (q >= 1 && q <= 4) place[i] = q; }
  const rec = { name: clean(b.name, 40) || "عضو", place, score: Math.max(0, Math.min(6, Number(b.score) || 0)), feed: clean(b.feed, 700), t: Date.now() };
  await store.setJSON(`${s}/${id}`, rec);
  return ok({ ok: true });
};
