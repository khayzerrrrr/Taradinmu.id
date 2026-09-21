// Membuat aset raster brand (PNG/ICO) dari SVG master di public/brand dan src/app/icon.svg.
// Jalankan: npm run brand:build   (memakai `sharp` yang sudah terpasang bersama Next.js)
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = (...parts) => path.join(root, ...parts);

const PNG_DIR = p("public/brand/png");
const ICON_DIR = p("public/icons");

/** Render SVG ke PNG dengan lebar target; density disesuaikan agar vektor tetap tajam. */
async function renderSvg(svgPath, width, { background } = {}) {
  const svg = await readFile(svgPath);
  const viewBoxWidth = Number(/viewBox="[\d.\-]+ [\d.\-]+ ([\d.]+) /.exec(svg.toString())?.[1]);
  if (!viewBoxWidth) throw new Error(`viewBox tidak ditemukan di ${svgPath}`);
  let image = sharp(svg, { density: Math.min(2400, Math.max(72, (72 * width) / viewBoxWidth)) }).resize({ width });
  if (background) image = image.flatten({ background });
  return image.png({ compressionLevel: 9 }).toBuffer();
}

async function writePng(out, svgPath, width, options) {
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, await renderSvg(svgPath, width, options));
  console.log("  ✓", path.relative(root, out));
}

/** ICO berisi PNG (didukung semua browser modern). */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = 6 + 16 * entries.length;
  const dirs = entries.map(({ size, data }) => {
    const dir = Buffer.alloc(16);
    dir.writeUInt8(size >= 256 ? 0 : size, 0);
    dir.writeUInt8(size >= 256 ? 0 : size, 1);
    dir.writeUInt16LE(1, 4); // color planes
    dir.writeUInt16LE(32, 6); // bits per pixel
    dir.writeUInt32LE(data.length, 8);
    dir.writeUInt32LE(offset, 12);
    offset += data.length;
    return dir;
  });
  return Buffer.concat([header, ...dirs, ...entries.map((e) => e.data)]);
}

const brand = (name) => p("public/brand", `${name}.svg`);

console.log("Logo (transparan):");
for (const tone of ["", "-dark", "-mono", "-white"]) {
  await writePng(path.join(PNG_DIR, `logo-mark${tone}-512.png`), brand(`logo-mark${tone}`), 512);
  await writePng(path.join(PNG_DIR, `logo-horizontal${tone}-1600.png`), brand(`logo-horizontal${tone}`), 1600);
}
await writePng(path.join(PNG_DIR, "logo-mark-1024.png"), brand("logo-mark"), 1024);
for (const tone of ["", "-dark", "-mono", "-white"]) {
  await writePng(path.join(PNG_DIR, `logo-stacked${tone}-1200.png`), brand(`logo-stacked${tone}`), 1200);
}

console.log("Ikon aplikasi / PWA:");
await writePng(path.join(ICON_DIR, "icon-192.png"), brand("app-icon"), 192);
await writePng(path.join(ICON_DIR, "icon-512.png"), brand("app-icon"), 512);
await writePng(path.join(ICON_DIR, "icon-maskable-512.png"), brand("app-icon-maskable"), 512);
await writePng(p("src/app/apple-icon.png"), brand("app-icon-square"), 180);

console.log("Favicon:");
const faviconSvg = p("src/app/icon.svg");
const sizes = [16, 32, 48];
const frames = await Promise.all(sizes.map(async (size) => ({ size, data: await renderSvg(faviconSvg, size) })));
await writeFile(p("src/app/favicon.ico"), buildIco(frames));
console.log("  ✓ src/app/favicon.ico (16, 32, 48)");

console.log("Gambar sosial (Open Graph / Twitter):");
await writePng(p("src/app/opengraph-image.png"), brand("og-image"), 1200);
await writePng(p("src/app/twitter-image.png"), brand("og-image"), 1200);
