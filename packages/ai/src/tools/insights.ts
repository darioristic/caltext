import { getDailyLogsRange, getUser, getWeightHistory, updateUser } from "@caltext/db";
import {
  estimateActualTDEE,
  localDateString,
  MAX_DAILY_CALORIES,
  MIN_DAILY_CALORIES,
  recommendedTarget,
} from "@caltext/shared";
import { tool } from "ai";
import { z } from "zod";

const WINDOW_DAYS = 28;
const round = (n: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};
const isWeekend = (dateStr: string) => {
  const dow = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6;
};
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Least-squares slope of y over x (returns slope per unit x). */
function slope(points: { x: number; y: number }[]): number | null {
  const n = points.length;
  if (n < 2) return null;
  const sx = points.reduce((s, p) => s + p.x, 0);
  const sy = points.reduce((s, p) => s + p.y, 0);
  const sxx = points.reduce((s, p) => s + p.x * p.x, 0);
  const sxy = points.reduce((s, p) => s + p.x * p.y, 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  return (n * sxy - sx * sy) / denom;
}

export const analyzeProgressTool = tool({
  description:
    "Analyze the user's recent eating + weight data to produce coaching insights: adherence, weekday vs weekend pattern, protein, weakest weekday, weight trend (signal vs noise), the user's MEASURED maintenance calories (actual TDEE) and a recommended daily target. Call this for weekly reviews, when the user asks how they're doing, when progress stalls, or before suggesting a target change.",
  inputSchema: z.object({
    userId: z.string(),
    timezone: z.string(),
  }),
  execute: async ({ userId, timezone }) => {
    const user = await getUser(userId);
    if (!user) return { error: "no profile" };

    const today = localDateString(timezone);
    const [range, weights] = await Promise.all([
      getDailyLogsRange(userId, today, WINDOW_DAYS),
      getWeightHistory(userId, 90),
    ]);

    const logged = range.filter((r) => r.log.mealCount > 0 || r.log.calories > 0);
    if (logged.length < 3) {
      return {
        enoughData: false,
        daysLogged: logged.length,
        message: "Need at least ~3 logged days for meaningful insights.",
      };
    }

    const target = user.dailyCalorieTarget;
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

    const intakes = logged.map((r) => r.log.calories);
    const avgIntake = avg(intakes);
    const avgProtein = avg(logged.map((r) => r.log.protein));

    // weekday vs weekend
    const weekdayIntake = avg(logged.filter((r) => !isWeekend(r.date)).map((r) => r.log.calories));
    const weekendIntake = avg(logged.filter((r) => isWeekend(r.date)).map((r) => r.log.calories));

    // adherence: share of logged days at or under target (within +5%)
    const onTargetDays = logged.filter((r) => r.log.calories <= target * 1.05).length;
    const adherencePct = round((onTargetDays / logged.length) * 100);

    // weakest weekday: day-of-week with the highest average overage vs target
    const byDow = new Map<number, number[]>();
    for (const r of logged) {
      const dow = new Date(`${r.date}T00:00:00Z`).getUTCDay();
      (byDow.get(dow) ?? byDow.set(dow, []).get(dow)!).push(r.log.calories - target);
    }
    let weakestDay: string | null = null;
    let weakestOver = 0;
    for (const [dow, overs] of byDow) {
      const m = avg(overs);
      if (m > weakestOver) {
        weakestOver = m;
        weakestDay = DAY_NAMES[dow]!;
      }
    }

    // weight trend (signal vs noise) over the window
    const wInWindow = weights
      .filter((w) => {
        const days = (Date.parse(today) - Date.parse(w.date)) / 86_400_000;
        return days >= 0 && days <= WINDOW_DAYS;
      })
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

    let weightTrendKgPerWeek: number | null = null;
    let actualTDEE: number | null = null;
    let recommendTarget: number | null = null;
    if (wInWindow.length >= 2) {
      const t0 = Date.parse(wInWindow[0]!.date);
      const pts = wInWindow.map((w) => ({ x: (Date.parse(w.date) - t0) / 86_400_000, y: w.weightKg }));
      const perDay = slope(pts);
      if (perDay !== null) weightTrendKgPerWeek = round(perDay * 7, 2);

      // measured TDEE: avg intake over the weight-span vs the weight change
      const spanDays = (Date.parse(wInWindow.at(-1)!.date) - t0) / 86_400_000;
      const spanIntakes = logged
        .filter(
          (r) =>
            Date.parse(r.date) >= t0 && Date.parse(r.date) <= Date.parse(wInWindow.at(-1)!.date),
        )
        .map((r) => r.log.calories);
      const weightChange = wInWindow.at(-1)!.weightKg - wInWindow[0]!.weightKg;
      actualTDEE = estimateActualTDEE(avg(spanIntakes), weightChange, spanDays);
      if (actualTDEE) recommendTarget = recommendedTarget(actualTDEE, user.goal);
    }

    const proteinTargetG = round(user.weightKg * 1.6);

    return {
      enoughData: true,
      windowDays: WINDOW_DAYS,
      daysLogged: logged.length,
      currentTarget: target,
      goal: user.goal,
      avgIntake: round(avgIntake),
      avgProtein: round(avgProtein),
      proteinTargetG,
      proteinLow: avgProtein < proteinTargetG * 0.85,
      adherencePct,
      weekdayIntake: round(weekdayIntake),
      weekendIntake: round(weekendIntake),
      weekendGap: round(weekendIntake - weekdayIntake),
      weakestDay,
      weakestDayOverKcal: weakestDay ? round(weakestOver) : null,
      weightEntries: wInWindow.length,
      weightTrendKgPerWeek,
      weightChangeKg: wInWindow.length >= 2 ? round(wInWindow.at(-1)!.weightKg - wInWindow[0]!.weightKg, 1) : null,
      actualTDEE,
      recommendedTarget: recommendTarget,
      targetSuggestionDiff: recommendTarget ? recommendTarget - target : null,
    };
  },
});

export const recalibrateTargetTool = tool({
  description:
    "Set the user's daily calorie target to a new value. Call this only AFTER analyzeProgress and after the user agrees to the change. Pass the new target in kcal (typically the recommendedTarget from analyzeProgress).",
  inputSchema: z.object({
    userId: z.string(),
    timezone: z.string(),
    newTargetKcal: z.number().describe("New daily calorie target in kcal"),
    reason: z.string().optional().describe("Short reason, e.g. 'measured TDEE lower than predicted'"),
  }),
  execute: async ({ userId, newTargetKcal, reason }) => {
    const clamped = Math.max(MIN_DAILY_CALORIES, Math.min(MAX_DAILY_CALORIES, Math.round(newTargetKcal)));
    const user = await getUser(userId);
    const previous = user?.dailyCalorieTarget ?? null;
    await updateUser(userId, { dailyCalorieTarget: String(clamped) });
    return { previousTarget: previous, newTarget: clamped, reason: reason ?? null };
  },
});
