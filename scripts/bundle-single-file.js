const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const outputFile = path.join(distDir, "PrintMetric-standalone.html");

function readUtf8(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), "utf8");
}

function toBase64DataUri(relPath, mimeType = "image/png") {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Asset not found: ${relPath}`);
  }
  const base64 = fs.readFileSync(fullPath).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

function escapeInlineScript(code) {
  return code.replace(/<\/script>/gi, "<\\/script>");
}

function buildSingleFileHtml() {
  let html = readUtf8("index.html");
  const css = readUtf8("style.css");

  const jsOrder = ["pricing.js", "gcode.js", "quote.js", "app.js"];
  const inlinedScripts = jsOrder
    .map((file) => `  <script>\n${escapeInlineScript(readUtf8(file))}\n  </script>`)
    .join("\n");

  const assetMap = new Map([
    ["assets/logo-horizontal.png", toBase64DataUri("assets/logo-horizontal.png")],
    [
      "assets/logo.png",
      fs.existsSync(path.join(rootDir, "assets/logo.png"))
        ? toBase64DataUri("assets/logo.png")
        : toBase64DataUri("logo.png")
    ],
    [
      "logo.png",
      fs.existsSync(path.join(rootDir, "logo.png"))
        ? toBase64DataUri("logo.png")
        : toBase64DataUri("assets/logo.png")
    ]
  ]);

  // 1. Inline style.css into <head> and remove <link rel="stylesheet" href="style.css">
  html = html.replace(
    /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']style\.css["'][^>]*\/?>/i,
    () => `<style>\n${css}\n  </style>`
  );

  // 2. Remove local image <link rel="preload"> since assets are embedded inline
  html = html.replace(
    /\s*<link\b[^>]*rel=["']preload["'][^>]*href=["'](?:assets\/)?logo(?:-horizontal)?\.png["'][^>]*\/?>/gi,
    ""
  );

  // 3. Replace local asset paths in <img src="..."> and <link rel="icon" href="..."> with base64 data URIs
  for (const [assetPath, dataUri] of assetMap.entries()) {
    const escapedPath = assetPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const imgPattern = new RegExp(`(<img\\b[^>]*\\bsrc=["'])${escapedPath}(["'][^>]*>)`, "gi");
    const iconPattern = new RegExp(`(<link\\b[^>]*\\brel=["']icon["'][^>]*\\bhref=["'])${escapedPath}(["'][^>]*>)`, "gi");
    const iconHrefFirstPattern = new RegExp(`(<link\\b[^>]*\\bhref=["'])${escapedPath}(["'][^>]*\\brel=["']icon["'][^>]*>)`, "gi");

    html = html
      .replace(imgPattern, `$1${dataUri}$2`)
      .replace(iconPattern, `$1${dataUri}$2`)
      .replace(iconHrefFirstPattern, `$1${dataUri}$2`);
  }

  // 4. Remove individual <script src="..."></script> tags and inline scripts in exact dependency order
  html = html.replace(
    /(?:\s*<script\b[^>]*\bsrc=["'](?:gcode|pricing|quote|app)\.js["'][^>]*>\s*<\/script>)+/i,
    () => `\n${inlinedScripts}`
  );

  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(outputFile, html, "utf8");

  const sizeKiB = (fs.statSync(outputFile).size / 1024).toFixed(1);
  console.log(`Built standalone bundle: ${path.relative(rootDir, outputFile)} (${sizeKiB} KiB)`);
}

if (require.main === module) {
  buildSingleFileHtml();
}

module.exports = { buildSingleFileHtml };
