import type { ActivityEntry, DailyActivity } from "@caltext/shared";
import { decrypt, encryptContent, generateId } from "@caltext/shared";
import { getRedis } from "./client";

const activityKey = (userId: string, date: string) => `activity:${userId}:${date}`;

export async function logActivity(
  userId: string,
  date: string,
  entry: Omit<ActivityEntry, "id">,
): Promise<ActivityEntry> {
  const redis = getRedis();
  const full: ActivityEntry = { id: generateId(), ...entry };
  await redis.hset(activityKey(userId, date), {
    [full.id]: await encryptContent(JSON.stringify(full)),
  });
  return full;
}

export async function getActivityForDate(userId: string, date: string): Promise<DailyActivity> {
  const redis = getRedis();
  const data = await redis.hgetall<Record<string, string>>(activityKey(userId, date));
  const entries: ActivityEntry[] = [];
  for (const value of Object.values(data ?? {})) {
    try {
      entries.push(JSON.parse(await decrypt(value)) as ActivityEntry);
    } catch {
      // skip corrupt entries
    }
  }
  entries.sort((a, b) => a.ts.localeCompare(b.ts));
  const totalBurned = entries.reduce((sum, e) => sum + e.kcal, 0);
  return { totalBurned, entries };
}

export async function deleteActivityEntry(
  userId: string,
  date: string,
  entryId: string,
): Promise<void> {
  await getRedis().hdel(activityKey(userId, date), entryId);
}
