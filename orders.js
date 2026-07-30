import { kv } from "@vercel/kv";

// Orders are stored as individual keys `order:<id>`, with the set of ids
// tracked in `order_ids` so we can list them without scanning the whole
// database. All of this lives in Vercel KV (Upstash Redis under the hood) —
// add it from your Vercel project's Storage tab and the env vars below get
// injected automatically.

function isOwner(req) {
  const header = req.headers["x-owner-passcode"];
  return Boolean(header) && header === process.env.OWNER_PASSCODE;
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      if (!isOwner(req)) return res.status(401).json({ error: "unauthorized" });
      const ids = (await kv.smembers("order_ids")) || [];
      const orders = [];
      for (const id of ids) {
        const o = await kv.get(`order:${id}`);
        if (o) orders.push(o);
      }
      orders.sort((a, b) => b.ts - a.ts);
      return res.status(200).json({ orders });
    }

    if (req.method === "POST") {
      const order = req.body;
      if (!order || !order.id) return res.status(400).json({ error: "missing order id" });
      await kv.set(`order:${order.id}`, order);
      await kv.sadd("order_ids", order.id);
      return res.status(200).json({ ok: true });
    }

    if (req.method === "PATCH") {
      if (!isOwner(req)) return res.status(401).json({ error: "unauthorized" });
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "missing id" });
      const existing = await kv.get(`order:${id}`);
      if (!existing) return res.status(404).json({ error: "not found" });
      const updated = { ...existing, ...req.body };
      await kv.set(`order:${id}`, updated);
      return res.status(200).json({ ok: true, order: updated });
    }

    if (req.method === "DELETE") {
      if (!isOwner(req)) return res.status(401).json({ error: "unauthorized" });
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "missing id" });
      await kv.del(`order:${id}`);
      await kv.srem("order_ids", id);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", ["GET", "POST", "PATCH", "DELETE"]);
    return res.status(405).end("Method Not Allowed");
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server error" });
  }
}
