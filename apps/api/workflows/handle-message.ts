import { Chat } from "chat";
import {
  getUser, getDailyLog, recallAllMemories, getStreak,
} from "@caltext/db";
import {
  createCaltextAgent, buildSystemPrompt,
} from "@caltext/ai";
import {
  localDateString, getLocaleName, decrypt,
} from "@caltext/shared";
import type { AgentContext } from "@caltext/shared";
import type { UserModelMessage } from "ai";

async function loadContext(userId: string) {
  "use step";
  const user = await getUser(userId);
  if (!user) throw new Error(`User not found: ${userId}`);

  const localDate = localDateString(user.timezone);
  const [memories, streak, todayLog] = await Promise.all([
    recallAllMemories(userId),
    getStreak(userId),
    getDailyLog(userId, localDate),
  ]);

  const ctx: AgentContext = {
    userId,
    userName: user.name,
    localeName: getLocaleName(user.locale),
    locale: user.locale,
    timezone: user.timezone,
    dailyCalorieTarget: user.dailyCalorieTarget,
    userProfile: user,
    memories: Object.keys(memories).length > 0 ? memories : null,
    todayLog: todayLog.mealCount > 0 ? todayLog : null,
    streak: streak.current > 0 ? streak.current : null,
  };

  return ctx;
}

async function runAgent(systemPrompt: string, userMessage: string, imageUrl?: string) {
  "use step";
  const agent = createCaltextAgent(systemPrompt);

  if (imageUrl) {
    const userMsg: UserModelMessage = {
      role: "user",
      content: [
        { type: "image", image: new URL(imageUrl) },
        { type: "text", text: userMessage },
      ],
    };
    const result = await agent.generate({ prompt: [userMsg] });
    return result.text;
  }

  const result = await agent.generate({ prompt: userMessage });
  return result.text;
}

async function sendReply(userId: string, text: string) {
  "use step";
  const user = await getUser(userId);
  if (!user) return;
  const rawPhone = await decrypt(user.phone);
  const bot = Chat.getSingleton();
  const dm = await bot.openDM(`sendblue:${rawPhone}`);
  await dm.post(text);
}

export async function handleMessage(userId: string, text: string, imageUrl?: string) {
  "use workflow";

  const ctx = await loadContext(userId);
  const systemPrompt = buildSystemPrompt(ctx);

  const userMessage = imageUrl
    ? `${text}\n\n[The user sent a food photo. Use identifyFood with imageUrl "${imageUrl}" to analyze it, then lookupNutrition for each item, then logMeal to save. userId is ${userId} and timezone is ${ctx.timezone}.]`
    : `${text}\n\n[userId is ${userId} and timezone is ${ctx.timezone}. Today's date is ${localDateString(ctx.timezone)}.]`;

  const reply = await runAgent(systemPrompt, userMessage, imageUrl);

  if (reply) {
    await sendReply(userId, reply);
  }
}
