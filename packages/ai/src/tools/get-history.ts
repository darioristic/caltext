import { getDailyLog, getWeeklyLogs } from "@caltext/db";
import { tool } from "ai";
import { z } from "zod";

export const getDailyLogTool = tool({
  description:
    "Get today's meal log with running totals for the user. Shows all meals logged today and current calorie/macro totals.",
  inputSchema: z.object({
    userId: z.string(),
    localDate: z.string().describe("The date in YYYY-MM-DD format in the user's timezone"),
  }),
  execute: async ({ userId, localDate }) => {
    return await getDailyLog(userId, localDate);
  },
});

export const getWeeklyLogTool = tool({
  description:
    "Get the past 7 days of meal logs for the user. Useful for weekly summaries and trends.",
  inputSchema: z.object({
    userId: z.string(),
    endDate: z.string().describe("The end date in YYYY-MM-DD format"),
    timezone: z.string(),
  }),
  execute: async ({ userId, endDate, timezone }) => {
    return await getWeeklyLogs(userId, endDate, timezone);
  },
});
