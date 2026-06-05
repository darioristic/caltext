export const MEAL_TIMES = [
  { label: "breakfast" as const, hour: 8, minute: 0, emoji: "☀️" },
  { label: "lunch" as const, hour: 12, minute: 0, emoji: "🌤️" },
  { label: "dinner" as const, hour: 19, minute: 0, emoji: "🌙" },
] as const;

export const DAILY_SUMMARY_HOUR = 21;
export const WEEKLY_RECAP_HOUR = 20;
export const WEEKLY_RECAP_DAY = "Sunday";

export const DEFAULT_WATER_TARGET_ML = 2500;
export const CONSENT_VERSION = "2026-04-08";

export const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const GOAL_ADJUSTMENTS: Record<string, number> = {
  lose: -500,
  maintain: 0,
  gain: 300,
};

export const STREAK_MILESTONES: Record<number, string> = {
  3: "3 days in a row! You're building a habit 🌱",
  7: "One full week! 🎉 Consistency is everything",
  14: "Two weeks strong 💪 You're in the groove",
  30: "30 DAYS! 🏆 You're officially a tracking machine",
  50: "50 days! 🌟 Half a century of tracking",
  100: "Triple digits!! 🔥🔥🔥 This is insane",
};

// Mifflin-St Jeor equation; "unspecified" uses the average of male and female constants (+5 and −161 → −78)
export function calculateBMR(
  sex: "male" | "female" | "unspecified",
  weightKg: number,
  heightCm: number,
  age: number,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === "male") return base + 5;
  if (sex === "female") return base - 161;
  return base - 78;
}

export const MIN_DAILY_CALORIES = 1200;
export const MAX_DAILY_CALORIES = 5000;

export function calculateTDEE(
  sex: "male" | "female" | "unspecified",
  weightKg: number,
  heightCm: number,
  age: number,
  activity: string,
  goal: string,
): number {
  const bmr = calculateBMR(sex, weightKg, heightCm, age);
  const multiplier = ACTIVITY_MULTIPLIERS[activity] ?? 1.55;
  const adjustment = GOAL_ADJUSTMENTS[goal] ?? 0;
  const raw = Math.round(bmr * multiplier + adjustment);
  return Math.max(MIN_DAILY_CALORIES, Math.min(MAX_DAILY_CALORIES, raw));
}

// ── Adaptive (data-driven) calorie target ──────────────────────────────
// ~7700 kcal ≈ 1 kg of body mass change.
export const KCAL_PER_KG = 7700;

/**
 * Estimate the user's *actual* maintenance calories (TDEE) from logged data:
 * energy balance says weightChange ≈ (intake − TDEE) × days / KCAL_PER_KG, so
 * TDEE = avgIntake − (weightChangeKg × KCAL_PER_KG / days).
 * Returns null when there isn't enough signal to be meaningful.
 */
export function estimateActualTDEE(
  avgDailyIntake: number,
  weightChangeKg: number,
  days: number,
): number | null {
  if (days < 7 || avgDailyIntake < MIN_DAILY_CALORIES * 0.5) return null;
  const tdee = Math.round(avgDailyIntake - (weightChangeKg * KCAL_PER_KG) / days);
  // Reject physiologically implausible estimates (usually bad weight data).
  if (tdee < MIN_DAILY_CALORIES * 0.8 || tdee > MAX_DAILY_CALORIES) return null;
  return tdee;
}

/** Recommended daily target = measured TDEE + the goal adjustment, clamped. */
export function recommendedTarget(actualTDEE: number, goal: string): number {
  const adjustment = GOAL_ADJUSTMENTS[goal] ?? 0;
  return Math.max(MIN_DAILY_CALORIES, Math.min(MAX_DAILY_CALORIES, actualTDEE + adjustment));
}
