// Regenerates this app's logo files. The results are committed, so this only needs to run when the logo changes:
//   node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import sharp from "sharp";

const GLYPH = `
    <path d="M150 392a100 100 0 0 1-17-198 136 136 0 0 1 258-30 118 118 0 0 1-10 228z" fill="url(#g)"/>
    <rect x="166" y="244" width="52" height="52" rx="10" fill="#0a0a12"/>
    <rect x="230" y="244" width="52" height="52" rx="10" fill="#0a0a12" opacity="0.32"/>
    <rect x="294" y="244" width="52" height="52" rx="10" fill="#0a0a12"/>
    <rect x="166" y="308" width="52" height="52" rx="10" fill="#0a0a12" opacity="0.32"/>
    <rect x="230" y="308" width="52" height="52" rx="10" fill="#0a0a12"/>
    <rect x="294" y="308" width="52" height="52" rx="10" fill="#0a0a12" opacity="0.32"/>
  `;

// scale shrinks the symbol inside the tile. rounded leaves see-through corners, for browsers. iOS and
// Android crop icons themselves, so theirs stay square.
const svg = (scale, rounded) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#241a3d"/><stop offset="1" stop-color="#0a0a12"/></radialGradient>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="0.5" stop-color="#a855f7"/><stop offset="1" stop-color="#f472b6"/></linearGradient>
  </defs>
  <rect width="512" height="512" rx="${rounded ? 104 : 0}" fill="url(#bg)"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${GLYPH}</g>
</svg>`);

const OUT = [["public/favicon.png", 256, "any"], ["public/icons/icon-192x192.png", 192, "any"], ["public/icons/icon-512x512.png", 512, "any"], ["public/icons/apple-touch-icon-180x180.png", 180, "full"], ["public/icons/icon-maskable-512x512.png", 512, "mask"]];
for (const [file, size, kind] of OUT) {
  mkdirSync(dirname(file), { recursive: true });
  const scale = kind === "mask" ? 0.66 : 0.82;
  await sharp(svg(scale, kind === "any")).resize(size, size).png({ compressionLevel: 9 }).toFile(file);
  console.log(file);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/logo.svg", svg(0.82, true));
