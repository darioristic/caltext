import { initLogger } from "evlog";
import { type EvlogVariables, evlog } from "evlog/hono";
import { Hono } from "hono";
import { getChartPNG } from "@/charts";
import { handleIncoming } from "@/handler";
import { markRead, parseInbound } from "@/sendblue";

initLogger({ env: { service: "caltext" } });

const app = new Hono<EvlogVariables>();
app.use(evlog());

app.get("/health", (c) => c.json({ status: "ok", service: "caltext" }));

// Transient progress-chart images referenced by outbound MMS (media_url).
app.get("/charts/:file", async (c) => {
  const token = c.req.param("file").replace(/\.png$/, "");
  const png = await getChartPNG(token);
  if (!png) return c.json({ error: "not found" }, 404);
  return c.body(new Uint8Array(png), 200, {
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=3600",
  });
});

app.post("/webhooks/sendblue", async (c) => {
  const log = c.get("log");

  try {
    const msg = parseInbound(c.req.raw.headers, await c.req.json());
    if (!msg) return c.json({ ok: true });

    markRead(msg.phone);
    await handleIncoming(msg.phone, msg.text, msg.imageUrl, msg.messageId);
    return c.json({ ok: true });
  } catch (error) {
    log.error(error as Error);
    return c.json({ error: "webhook failed" }, 500);
  }
});

export default app;
