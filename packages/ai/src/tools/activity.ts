import { getActivityForDate, getDailyLog, getUser, logActivity } from "@caltext/db";
import { estimateCaloriesBurned, localDateString } from "@caltext/shared";
import { tool } from "ai";
import { z } from "zod";

export const logActivityTool = tool({
  description:
    "Log a workout / physical activity. Estimates calories burned (from the activity type, duration, and the user's weight) and adds them to today's budget. Pass caloriesBurned only if the user gives an explicit number (e.g. from their watch).",
  inputSchema: z.object({
    userId: z.string(),
    timezone: z.string(),
    type: z.string().describe("Activity, e.g. 'running', 'weight training', 'cycling', 'walking'"),
    durationMin: z.number().describe("Duration in minutes"),
    caloriesBurned: z.number().optional().describe("Explicit kcal burned, if the user stated it"),
  }),
  execute: async ({ userId, timezone, type, durationMin, caloriesBurned }) => {
    const localDate = localDateString(timezone);
    const user = await getUser(userId);
    const weightKg = user?.weightKg ?? 70;
    const kcal = caloriesBurned ?? estimateCaloriesBurned(type, durationMin, weightKg);

    await logActivity(userId, localDate, {
      type,
      durationMin,
      kcal,
      ts: new Date().toISOString(),
    });

    const [day, activity] = await Promise.all([
      getDailyLog(userId, localDate),
      getActivityForDate(userId, localDate),
    ]);
    const target = user?.dailyCalorieTarget ?? 2000;
    const consumed = Math.round(day.calories);
    return {
      type,
      durationMin,
      caloriesBurned: kcal,
      totalBurnedToday: activity.totalBurned,
      target,
      consumed,
      // net budget: you can eat back what you burned
      adjustedRemaining: target - consumed + activity.totalBurned,
    };
  },
});

export const getActivityTool = tool({
  description: "Get today's logged workouts and total calories burned.",
  inputSchema: z.object({
    userId: z.string(),
    timezone: z.string(),
  }),
  execute: async ({ userId, timezone }) => {
    const localDate = localDateString(timezone);
    const activity = await getActivityForDate(userId, localDate);
    return {
      totalBurned: activity.totalBurned,
      count: activity.entries.length,
      entries: activity.entries.map((e) => ({
        type: e.type,
        durationMin: e.durationMin,
        kcal: e.kcal,
      })),
    };
  },
});
