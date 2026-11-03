// Builds public/og-card.png, the 1200x630 image Facebook, X, iMessage, and
// Slack show when a link to the site is shared. Facebook crops anything that
// isn't ~1.91:1, which is why the square logo alone got its top cut off.
// Re-run after changing the logo or the copy: node scripts/og/make-card.mjs
import { readFile, writeFile } from "node:fs/promises";
import { ImageResponse } from "next/dist/compiled/@vercel/og/index.node.js";

const dir = new URL(".", import.meta.url);
const root = new URL("../../", import.meta.url);
const [logo, medium, heavy] = await Promise.all([
  readFile(new URL("public/tnv-transparent-640.png", root)),
  readFile(new URL("geist-500.woff", dir)),
  readFile(new URL("geist-800.woff", dir)),
]);
const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

// The site's yellow player-outline watermark, lifted from the component so
// the card always matches it.
const watermarkSrc = await readFile(new URL("components/LogoWatermark.tsx", root), "utf8");
const outline = watermarkSrc.match(/const OUTLINE =\s*"([^"]+)"/)[1];
const viewBox = watermarkSrc.match(/const VIEW_BOX = "([^"]+)"/)[1];
const watermark = `data:image/svg+xml;base64,${Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none">` +
    `<path d="${outline}" stroke="#fff200" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
).toString("base64")}`;
const [, , vbW, vbH] = viewBox.split(" ").map(Number);
const wmHeight = 550;

const h = (type, style, ...kids) => ({
  type,
  props: { style: { display: "flex", ...style }, children: kids.length === 1 ? kids[0] : kids },
});

// Text up top, the TNV mark small in the bottom left, and the yellow player
// outline down the right edge.
const card = h(
  "div",
  {
    width: "100%",
    height: "100%",
    flexDirection: "column",
    justifyContent: "space-between",
    background: "#000",
    padding: "72px 64px 56px",
    position: "relative",
    fontFamily: "Geist",
    color: "#fff",
  },
  {
    type: "img",
    props: {
      src: watermark,
      width: Math.round((wmHeight * vbW) / vbH),
      height: wmHeight,
      style: { position: "absolute", right: 16, top: 40, opacity: 0.9 },
    },
  },
  h(
    "div",
    { flexDirection: "column" },
    h("div", { fontSize: 104, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }, "The Net Values"),
    h("div", { width: 140, height: 8, background: "#fff200", margin: "36px 0 32px" }),
    h(
      "div",
      { fontSize: 44, fontWeight: 500, lineHeight: 1.25, maxWidth: 560 },
      "Evaluate NBA player pay vs. production.",
    ),
  ),
  { type: "img", props: { src: logoSrc, width: 150, height: 150 } },
);

const res = new ImageResponse(card, {
  width: 1200,
  height: 630,
  fonts: [
    { name: "Geist", data: medium, weight: 500, style: "normal" },
    { name: "Geist", data: heavy, weight: 800, style: "normal" },
  ],
});
await writeFile(new URL("public/og-card.png", root), Buffer.from(await res.arrayBuffer()));
console.log("wrote public/og-card.png");
