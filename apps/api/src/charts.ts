import { getDailyLogsRange, getRedis, getUser, getWeightHistory } from "@caltext/db";
import { localDateString, sendMedia } from "@caltext/shared";
import { tool } from "ai";
import sharp from "sharp";
import { z } from "zod";

const PUBLIC_API_URL = process.env.PUBLIC_API_URL ?? "https://api.caltext.darioristic.com";
const CHART_TTL_SECONDS = 3600;

// ── Storage (transient PNG in Redis, served at /charts/:token.png) ──────
export async function storeChart(png: Buffer): Promise<string> {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  await getRedis().set(`chart:${token}`, png.toString("base64"), { ex: CHART_TTL_SECONDS });
  return token;
}

export async function getChartPNG(token: string): Promise<Buffer | null> {
  if (!/^[a-z0-9]+$/.test(token)) return null;
  const b64 = await getRedis().get<string | null>(`chart:${token}`);
  return b64 ? Buffer.from(b64, "base64") : null;
}

const chartUrl = (token: string) => `${PUBLIC_API_URL}/charts/${token}.png`;

// ── Rendering ───────────────────────────────────────────────────────────
interface ChartData {
  name: string;
  weights: { date: string; kg: number }[]; // chronological
  days: { date: string; calories: number }[]; // chronological, may be 0 for unlogged
  target: number;
}

const W = 880;
const PANEL_H = 360;
const PAD = 56;
const FG = "#0f172a";
const MUTED = "#64748b";
const GRID = "#e2e8f0";
const ACCENT = "#2563eb";
const GOOD = "#16a34a";
const OVER = "#f59e0b";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function weightPanel(data: ChartData, yTop: number): string {
  const pts = data.weights;
  const x0 = PAD;
  const x1 = W - PAD;
  const yA = yTop + 40;
  const yB = yTop + PANEL_H - 36;
  if (pts.length < 2) {
    return `<text x="${W / 2}" y="${(yA + yB) / 2}" fill="${MUTED}" font-size="18" text-anchor="middle">Log your weight a few times to see the trend</text>`;
  }
  const kgs = pts.map((p) => p.kg);
  let min = Math.min(...kgs);
  let max = Math.max(...kgs);
  const pad = Math.max(0.5, (max - min) * 0.2);
  min -= pad;
  max += pad;
  const t0 = Date.parse(pts[0]!.date);
  const t1 = Date.parse(pts.at(-1)!.date);
  const sx = (d: string) => x0 + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * (x1 - x0);
  const sy = (kg: number) => yB - ((kg - min) / (max - min)) * (yB - yA);

  const line = pts.map((p) => `${sx(p.date).toFixed(1)},${sy(p.kg).toFixed(1)}`).join(" ");
  const dots = pts
    .map((p) => `<circle cx="${sx(p.date).toFixed(1)}" cy="${sy(p.kg).toFixed(1)}" r="3.5" fill="${ACCENT}"/>`)
    .join("");

  // linear regression trend line
  const n = pts.length;
  const xs = pts.map((p) => (Date.parse(p.date) - t0) / 86_400_000);
  const ys = kgs;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const denom = xs.reduce((s, x) => s + (x - mx) ** 2, 0) || 1;
  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i]! - my), 0) / denom;
  const intercept = my - slope * mx;
  const trendY = (x: number) => sy(intercept + slope * x);
  const trend = `<line x1="${x0}" y1="${trendY(xs[0]!).toFixed(1)}" x2="${x1}" y2="${trendY(xs.at(-1)!).toFixed(1)}" stroke="${ACCENT}" stroke-width="1.5" stroke-dasharray="6 5" opacity="0.55"/>`;

  const perWeek = slope * 7;
  const change = pts.at(-1)!.kg - pts[0]!.kg;
  const gridLines = Array.from({ length: 4 }, (_, i) => {
    const y = yA + ((yB - yA) / 3) * i;
    const kg = max - ((max - min) / 3) * i;
    return `<line x1="${x0}" y1="${y.toFixed(1)}" x2="${x1}" y2="${y.toFixed(1)}" stroke="${GRID}"/><text x="${x0 - 10}" y="${(y + 4).toFixed(1)}" fill="${MUTED}" font-size="12" text-anchor="end">${kg.toFixed(1)}</text>`;
  }).join("");

  return `
    <text x="${x0}" y="${yTop + 24}" fill="${FG}" font-size="17" font-weight="700">Weight trend</text>
    <text x="${x1}" y="${yTop + 24}" fill="${change <= 0 ? GOOD : OVER}" font-size="15" font-weight="600" text-anchor="end">${change >= 0 ? "+" : ""}${change.toFixed(1)} kg · ${perWeek >= 0 ? "+" : ""}${perWeek.toFixed(2)} kg/wk</text>
    ${gridLines}
    ${trend}
    <polyline points="${line}" fill="none" stroke="${ACCENT}" stroke-width="2.5" stroke-linejoin="round"/>
    ${dots}`;
}

function caloriePanel(data: ChartData, yTop: number): string {
  const days = data.days.slice(-14);
  const x0 = PAD;
  const x1 = W - PAD;
  const yA = yTop + 40;
  const yB = yTop + PANEL_H - 36;
  const logged = days.filter((d) => d.calories > 0);
  if (logged.length === 0) {
    return `<text x="${W / 2}" y="${(yA + yB) / 2}" fill="${MUTED}" font-size="18" text-anchor="middle">Log meals to see your daily calories</text>`;
  }
  const target = data.target;
  const maxVal = Math.max(target * 1.2, ...days.map((d) => d.calories));
  const sy = (v: number) => yB - (v / maxVal) * (yB - yA);
  const slot = (x1 - x0) / days.length;
  const bw = slot * 0.62;

  const bars = days
    .map((d, i) => {
      if (d.calories <= 0) return "";
      const x = x0 + slot * i + (slot - bw) / 2;
      const y = sy(d.calories);
      const h = yB - y;
      const fill = d.calories <= target * 1.05 ? GOOD : OVER;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${fill}" opacity="0.9"/>`;
    })
    .join("");

  const ty = sy(target);
  const targetLine = `<line x1="${x0}" y1="${ty.toFixed(1)}" x2="${x1}" y2="${ty.toFixed(1)}" stroke="${FG}" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${x1}" y="${(ty - 6).toFixed(1)}" fill="${FG}" font-size="12" text-anchor="end">target ${target}</text>`;
  const avg = Math.round(logged.reduce((s, d) => s + d.calories, 0) / logged.length);
  const onTarget = logged.filter((d) => d.calories <= target * 1.05).length;

  return `
    <text x="${x0}" y="${yTop + 24}" fill="${FG}" font-size="17" font-weight="700">Daily calories</text>
    <text x="${x1}" y="${yTop + 24}" fill="${MUTED}" font-size="15" font-weight="600" text-anchor="end">avg ${avg} · ${onTarget}/${logged.length} on target</text>
    ${bars}
    ${targetLine}`;
}

export async function renderProgressChartPNG(data: ChartData): Promise<Buffer> {
  const H = PANEL_H * 2 + 40;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Helvetica, Arial, sans-serif">
    <rect width="${W}" height="${H}" fill="#ffffff"/>
    <text x="${PAD}" y="34" fill="${FG}" font-size="22" font-weight="800">${esc(data.name)} · progress</text>
    ${weightPanel(data, 56)}
    ${caloriePanel(data, 56 + PANEL_H + 24)}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ── Agent tool (bound to the user + their phone) ────────────────────────
export function createSendProgressChartTool(ctx: {
  userId: string;
  timezone: string;
  phone: string;
}) {
  return tool({
    description:
      "Render and TEXT the user a visual progress chart image (weight trend + daily calories vs target). Call this when the user asks for a chart/graph/progress picture, or as part of a weekly review. The image is sent directly to them; your text reply should be a one-line caption.",
    inputSchema: z.object({}),
    execute: async () => {
      const today = localDateString(ctx.timezone);
      const [user, weights, range] = await Promise.all([
        getUser(ctx.userId),
        getWeightHistory(ctx.userId, 60),
        getDailyLogsRange(ctx.userId, today, 14),
      ]);
      const png = await renderProgressChartPNG({
        name: user?.name || "You",
        weights: weights.map((w) => ({ date: w.date, kg: w.weightKg })).reverse(),
        days: range.map((r) => ({ date: r.date, calories: Math.round(r.log.calories) })),
        target: user?.dailyCalorieTarget ?? 2000,
      });
      const token = await storeChart(png);
      await sendMedia(ctx.phone, chartUrl(token), "");
      return { sent: true, note: "Chart image sent to the user." };
    },
  });
}
