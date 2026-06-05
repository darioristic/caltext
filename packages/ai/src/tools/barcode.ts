import { tool } from "ai";
import { z } from "zod";

const OFF_URL = "https://world.openfoodfacts.org/api/v2/product";
const UA = "Caltext/1.0 (calorie tracker; +https://caltext.darioristic.com)";

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number.parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** EAN-8/12/13/UPC checksum validation to skip obviously misread codes. */
function validBarcode(code: string): boolean {
  if (!/^\d{8}$|^\d{12,13}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  let sum = 0;
  // weight 3,1,3,1... from the rightmost data digit
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) {
    sum += digits[i]! * w;
  }
  return (10 - (sum % 10)) % 10 === check;
}

export const lookupBarcodeProductTool = tool({
  description:
    "Look up a packaged product's nutrition by its barcode number (EAN/UPC) via OpenFoodFacts. Use this when the user photographs a product barcode: read the digit string printed under the bars and pass it here. Returns nutrition per 100g (and per serving when available) — far more accurate than estimating. After this, ask the user the portion (or use the serving size) and log the meal.",
  inputSchema: z.object({
    barcode: z.string().describe("The barcode digits, e.g. '7622300336738' (8, 12 or 13 digits)"),
  }),
  execute: async ({ barcode }) => {
    const code = barcode.replace(/\D/g, "");
    if (!validBarcode(code)) {
      return {
        found: false,
        reason: "invalid_barcode",
        message:
          "That barcode didn't validate — double-check the digits or describe the food instead.",
      };
    }
    try {
      const res = await fetch(
        `${OFF_URL}/${code}?fields=product_name,brands,nutriments,serving_size,quantity`,
        { headers: { "User-Agent": UA } },
      );
      if (!res.ok) return { found: false, reason: `http_${res.status}` };
      const data = (await res.json()) as {
        status?: number;
        product?: {
          product_name?: string;
          brands?: string;
          serving_size?: string;
          quantity?: string;
          nutriments?: Record<string, unknown>;
        };
      };
      if (data.status !== 1 || !data.product) {
        return {
          found: false,
          reason: "not_in_database",
          message:
            "Not found in OpenFoodFacts — estimate from the label or a photo of the food instead.",
        };
      }
      const p = data.product;
      const n = p.nutriments ?? {};
      const per100g = {
        kcal: num(n["energy-kcal_100g"]),
        protein: num(n.proteins_100g),
        carbs: num(n.carbohydrates_100g),
        fat: num(n.fat_100g),
        fiber: num(n.fiber_100g),
      };
      const perServing = {
        kcal: num(n["energy-kcal_serving"]),
        protein: num(n.proteins_serving),
        carbs: num(n.carbohydrates_serving),
        fat: num(n.fat_serving),
        fiber: num(n.fiber_serving),
      };
      return {
        found: per100g.kcal !== null || perServing.kcal !== null,
        barcode: code,
        name: p.product_name || "Unknown product",
        brand: p.brands || null,
        servingSize: p.serving_size || null,
        packageSize: p.quantity || null,
        per100g,
        perServing: perServing.kcal !== null ? perServing : null,
      };
    } catch {
      return { found: false, reason: "lookup_failed" };
    }
  },
});
