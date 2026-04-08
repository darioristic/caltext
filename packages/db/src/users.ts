import type { UserProfile } from "@caltext/shared";
import { getRedis } from "./client.js";

const userKey = (userId: string) => `user:${userId}`;
const phoneIndexKey = (encryptedPhone: string) => `phone:${encryptedPhone}`;

export async function resolveUserId(encryptedPhone: string): Promise<string | null> {
  const redis = getRedis();
  return await redis.get<string>(phoneIndexKey(encryptedPhone));
}

export async function createPhoneMapping(encryptedPhone: string, userId: string): Promise<void> {
  const redis = getRedis();
  await redis.set(phoneIndexKey(encryptedPhone), userId);
}

export async function getUser(userId: string): Promise<UserProfile | null> {
  const redis = getRedis();
  const data = await redis.hgetall<Record<string, string>>(userKey(userId));
  if (!data || Object.keys(data).length === 0) return null;
  return {
    id: userId,
    phone: data.phone ?? "",
    name: data.name ?? "",
    locale: data.locale ?? "en",
    timezone: data.timezone ?? "UTC",
    country: data.country ?? "US",
    dailyCalorieTarget: parseInt(data.dailyCalorieTarget ?? "2000", 10),
    goal: (data.goal as UserProfile["goal"]) ?? "maintain",
    activity: (data.activity as UserProfile["activity"]) ?? "moderate",
    sex: (data.sex as UserProfile["sex"]) ?? "male",
    age: parseInt(data.age ?? "30", 10),
    heightCm: parseFloat(data.heightCm ?? "170"),
    weightKg: parseFloat(data.weightKg ?? "70"),
    onboardingComplete: data.onboardingComplete === "true",
    createdAt: data.createdAt ?? new Date().toISOString(),
  };
}

export async function createUser(
  userId: string,
  encryptedPhone: string,
  profile: Omit<UserProfile, "id" | "phone" | "createdAt">,
): Promise<void> {
  const redis = getRedis();
  await redis.hset(userKey(userId), {
    phone: encryptedPhone,
    ...profile,
    onboardingComplete: String(profile.onboardingComplete),
    dailyCalorieTarget: String(profile.dailyCalorieTarget),
    age: String(profile.age),
    heightCm: String(profile.heightCm),
    weightKg: String(profile.weightKg),
    createdAt: new Date().toISOString(),
  });
}

export async function updateUser(
  userId: string,
  fields: Partial<Record<string, string>>,
): Promise<void> {
  const redis = getRedis();
  await redis.hset(userKey(userId), fields);
}

export async function userExists(userId: string): Promise<boolean> {
  const redis = getRedis();
  return (await redis.exists(userKey(userId))) === 1;
}
