import { openai } from "@ai-sdk/openai";
import { buildDailySummaryPrompt } from "@caltext/ai";
import { getDailyLog, getUser, updateStreak } from "@caltext/db";
import { decrypt, localDateString } from "@caltext/shared";
import { generateText } from "ai";
import { Chat } from "chat";

async function generateAndSend(userId: string) {
  "use step";
  const user = await getUser(userId);
  if (!user) return;

  const localDate = localDateString(user.timezone);
  const log = await getDailyLog(userId, localDate);
  if (log.mealCount === 0) return;

  const streak = await updateStreak(userId, localDate);

  const mealSummary = log.meals
    .map((m) => {
      const itemNames = m.items.map((i) => i.name).join(" + ");
      return `- ${itemNames}: ${m.totalCalories} kcal`;
    })
    .join("\n");

  const result = await generateText({
    model: openai("gpt-4.1-mini"),
    system: buildDailySummaryPrompt(user.locale),
    prompt: `Generate daily summary for ${user.name}. Target: ${user.dailyCalorieTarget} kcal.
Meals:\n${mealSummary}
Totals: ${log.calories} kcal, ${Math.round(log.protein)}g P, ${Math.round(log.carbs)}g C, ${Math.round(log.fat)}g F
Streak: ${streak.current} days`,
  });

  const rawPhone = await decrypt(user.phone);
  const bot = Chat.getSingleton();
  const dm = await bot.openDM(`sendblue:${rawPhone}`);
  await dm.post(result.text);
}

export async function dailySummaryWorkflow(userId: string) {
  "use workflow";
  await generateAndSend(userId);
}
