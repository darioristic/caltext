import { createRequire } from "node:module";
import type { RequestLogger } from "evlog";
import sharp from "sharp";

const MAX_DIMENSION = 1024;

// sharp's prebuilt binary advertises HEIF input but cannot decode the HEVC
// compression iPhones use ("Support for this compression format has not been
// built in"), so HEIC frames go through heic-convert (a wasm HEVC decoder).
// That package loads its wasm relative to __dirname, which breaks when bundled
// into the ESM output — so load it lazily as CJS via a specifier the bundler
// can't statically inline, keeping it an external runtime require.
const nodeRequire = createRequire(import.meta.url);
type HeicConvert = (opts: {
  buffer: Buffer;
  format: "JPEG";
  quality: number;
}) => Promise<ArrayBuffer>;
let heicConvert: HeicConvert | null = null;

function loadHeicConvert(): HeicConvert {
  if (!heicConvert) {
    // biome-ignore lint/suspicious/noExplicitAny: dynamic CJS interop
    const mod = nodeRequire(["heic", "convert"].join("-")) as any;
    heicConvert = (mod.default ?? mod) as HeicConvert;
  }
  return heicConvert;
}

async function heicToJpeg(buffer: Buffer): Promise<Buffer> {
  const output = await loadHeicConvert()({ buffer, format: "JPEG", quality: 0.9 });
  return Buffer.from(output);
}

function resizeAndEncode(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();
}

/**
 * Fetch an image URL, convert HEIC/non-JPEG to JPEG, and resize for the vision API.
 * Returns a base64 data URL safe for OpenAI vision APIs.
 */
export async function normalizeImageUrl(url: string, log?: RequestLogger): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) return url;

  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "";

  // metadata() reads the header without decoding, so it identifies HEIC even
  // though sharp can't decode its pixels.
  const meta = await sharp(buffer)
    .metadata()
    .catch(() => null);
  const isHeic =
    meta?.format === "heif" || contentType.includes("heic") || contentType.includes("heif");

  log?.set({
    image: { sourceFormat: meta?.format ?? (isHeic ? "heif" : "unknown"), converted: true },
  });

  const source = isHeic ? await heicToJpeg(buffer) : buffer;
  const jpeg = await resizeAndEncode(source);
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}
