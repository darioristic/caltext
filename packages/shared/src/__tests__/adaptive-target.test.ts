import { describe, expect, test } from "bun:test";
import {
  estimateActualTDEE,
  estimateCaloriesBurned,
  MAX_DAILY_CALORIES,
  MIN_DAILY_CALORIES,
  recommendedTarget,
} from "../constants";

describe("estimateActualTDEE", () => {
  test("eating below maintenance and losing weight -> TDEE above intake", () => {
    // ate 1800/day for 28 days, lost 1.5 kg
    const tdee = estimateActualTDEE(1800, -1.5, 28);
    // 1800 - (-1.5 * 7700 / 28) = 1800 + 412.5 = 2212.5
    expect(tdee).toBe(2213);
  });

  test("maintaining weight -> TDEE equals intake", () => {
    expect(estimateActualTDEE(2200, 0, 28)).toBe(2200);
  });

  test("gaining weight -> TDEE below intake", () => {
    // ate 2600 for 14 days, gained 1 kg: 2600 - (1*7700/14) = 2600 - 550 = 2050
    expect(estimateActualTDEE(2600, 1, 14)).toBe(2050);
  });

  test("too short a window returns null", () => {
    expect(estimateActualTDEE(2000, -0.5, 5)).toBeNull();
  });

  test("implausible result returns null", () => {
    expect(estimateActualTDEE(2000, -10, 14)).toBeNull();
  });
});

describe("estimateCaloriesBurned", () => {
  test("running 30 min at 80 kg ≈ MET 9.8 × 80 × 0.5", () => {
    expect(estimateCaloriesBurned("running", 30, 80)).toBe(392);
  });

  test("fuzzy-matches partial names", () => {
    // "trail running" contains "running" → MET 9.8
    expect(estimateCaloriesBurned("trail running", 30, 80)).toBe(392);
  });

  test("unknown activity falls back to MET 5", () => {
    expect(estimateCaloriesBurned("underwater basket weaving", 60, 80)).toBe(400);
  });
});

describe("recommendedTarget", () => {
  test("lose goal subtracts a 500 kcal deficit", () => {
    expect(recommendedTarget(2400, "lose")).toBe(1900);
  });

  test("maintain keeps TDEE", () => {
    expect(recommendedTarget(2400, "maintain")).toBe(2400);
  });

  test("clamps to the safe floor", () => {
    expect(recommendedTarget(1500, "lose")).toBe(MIN_DAILY_CALORIES);
  });

  test("clamps to the ceiling", () => {
    expect(recommendedTarget(6000, "gain")).toBe(MAX_DAILY_CALORIES);
  });
});
