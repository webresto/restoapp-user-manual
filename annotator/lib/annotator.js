const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const sharp = require("sharp");

const RED = "#ff2d2d";
const ANNOTATION_CONFIG_RE = /\.annotate\.(ya?ml|json)$/i;

function loadConfigFile(configPath) {
  const raw = fs.readFileSync(configPath, "utf8");
  const config = configPath.endsWith(".json") ? JSON.parse(raw) : yaml.load(raw);

  if (!config || !config.input) {
    throw new Error("Config must include an input image path.");
  }

  return config;
}

function dumpConfigFile(configPath, config) {
  const content = configPath.endsWith(".json")
    ? `${JSON.stringify(config, null, 2)}\n`
    : yaml.dump(config, { lineWidth: 100, noRefs: true });

  fs.writeFileSync(configPath, content, "utf8");
}

function findAnnotationConfigs(root) {
  const results = [];

  walk(root, (filePath) => {
    if (ANNOTATION_CONFIG_RE.test(filePath)) {
      results.push(filePath);
    }
  });

  return results.sort();
}

function walk(dir, visitor) {
  if (!fs.existsSync(dir)) {
    return;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") {
      continue;
    }

    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(entryPath, visitor);
    } else if (entry.isFile()) {
      visitor(entryPath);
    }
  }
}

async function generateFromConfigFile(configPath) {
  const config = loadConfigFile(configPath);
  const baseDir = path.dirname(configPath);
  return generateAnnotatedImage({ config, baseDir, configPath });
}

async function generateAnnotatedImage({ config, baseDir, configPath }) {
  const inputPath = path.resolve(baseDir, config.input);
  let defaultOutput = "annotated.png";
  if (configPath) {
    const base = path.basename(configPath).replace(/\.annotate\.(yml|yaml|json)$/i, ".annotated.png");
    defaultOutput = base !== path.basename(configPath) ? base : "annotated.png";
  }
  const outputPath = path.resolve(baseDir, config.output || defaultOutput);
  let annotations = Array.isArray(config.annotations) ? config.annotations : [];

  let image = sharp(inputPath);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not read image dimensions: ${inputPath}`);
  }

  const crop = normalizeCrop(config.crop, metadata.width, metadata.height);
  const outputMetadata = crop ? { width: crop.width, height: crop.height } : metadata;

  if (crop) {
    image = image.extract(crop);
    annotations = annotations.map((annotation) => transformAnnotationForCrop(annotation, crop));
  }

  image = await applyRasterEffects(image, annotations, outputMetadata);

  const svg = renderSvgOverlay(
    outputMetadata.width,
    outputMetadata.height,
    annotations.filter((annotation) => annotation.type !== "blur"),
  );

  await image
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(outputPath);

  return outputPath;
}

function normalizeCrop(crop, imageWidth, imageHeight) {
  if (!crop) {
    return null;
  }

  const region = clampRegion(crop, imageWidth, imageHeight);
  if (!region) {
    throw new Error("Crop must define a non-empty bounding box.");
  }

  return region;
}

function transformAnnotationForCrop(annotation, crop) {
  const next = { ...annotation };

  if (hasNumber(next.x)) {
    next.x = Number(next.x) - crop.left;
  }

  if (hasNumber(next.y)) {
    next.y = Number(next.y) - crop.top;
  }

  if (Array.isArray(next.from)) {
    next.from = transformPointForCrop(next.from, crop);
  }

  if (Array.isArray(next.to)) {
    next.to = transformPointForCrop(next.to, crop);
  }

  return next;
}

function transformPointForCrop(point, crop) {
  return [Number(point[0]) - crop.left, Number(point[1]) - crop.top];
}

function hasNumber(value) {
  return value !== undefined && value !== null && value !== "" && Number.isFinite(Number(value));
}

async function applyRasterEffects(image, annotations, metadata) {
  const blurComposites = [];

  for (const annotation of annotations) {
    if (annotation.type !== "blur") {
      continue;
    }

    const region = clampRegion(annotation, metadata.width, metadata.height);
    if (!region) {
      continue;
    }

    const blurred = await image
      .clone()
      .extract(region)
      .blur(annotation.radius || 12)
      .png()
      .toBuffer();

    blurComposites.push({
      input: blurred,
      left: region.left,
      top: region.top,
    });
  }

  if (!blurComposites.length) {
    return image;
  }

  return sharp(await image.composite(blurComposites).png().toBuffer());
}

function clampRegion(annotation, imageWidth, imageHeight) {
  const left = clampNumber(annotation.x, 0, imageWidth);
  const top = clampNumber(annotation.y, 0, imageHeight);
  const right = clampNumber(annotation.x + annotation.width, 0, imageWidth);
  const bottom = clampNumber(annotation.y + annotation.height, 0, imageHeight);
  const width = right - left;
  const height = bottom - top;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return { left, top, width, height };
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(Math.round(Number(value) || 0), min), max);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderSvgOverlay(width, height, annotations) {
  const items = annotations.map((annotation) => renderAnnotation(annotation, width, height)).join("\n");

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
     xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="10"
            refX="8" refY="3" orient="auto">
      <path d="M0,0 L0,6 L9,3 z" fill="${RED}" />
    </marker>
  </defs>
  <style>
    .annotation-stroke {
      stroke: ${RED};
      stroke-width: 4;
    }
    .annotation-fill {
      fill: ${RED};
    }
    .annotation-label {
      fill: white;
      font-family: Arial, sans-serif;
      font-size: 18px;
      font-weight: 700;
    }
    .annotation-marker-text {
      fill: white;
      font-family: Arial, sans-serif;
      font-size: 20px;
      font-weight: 700;
      text-anchor: middle;
      dominant-baseline: central;
    }
  </style>
  ${items}
</svg>`;
}

function renderAnnotation(annotation, imageWidth, imageHeight) {
  switch (annotation.type) {
    case "rect":
      return renderRect(annotation);
    case "oval":
      return renderOval(annotation);
    case "arrow":
      return renderArrow(annotation);
    case "marker":
      return renderMarker(annotation);
    case "spotlight":
      return renderSpotlight(annotation, imageWidth, imageHeight);
    default:
      return "";
  }
}

function renderRect(annotation) {
  const label = annotation.label ? renderLabel(annotation.x, annotation.y - 34, annotation.label) : "";

  return `
<rect x="${annotation.x}" y="${annotation.y}"
      width="${annotation.width}" height="${annotation.height}"
      rx="${annotation.rx ?? 8}"
      fill="${RED}" fill-opacity="0.08"
      class="annotation-stroke" />
${label}`;
}

function renderOval(annotation) {
  const cx = annotation.x + annotation.width / 2;
  const cy = annotation.y + annotation.height / 2;
  const label = annotation.label ? renderLabel(annotation.x, annotation.y - 34, annotation.label) : "";

  return `
<ellipse cx="${cx}" cy="${cy}"
         rx="${annotation.width / 2}" ry="${annotation.height / 2}"
         fill="${RED}" fill-opacity="0.08"
         class="annotation-stroke" />
${label}`;
}

function renderArrow(annotation) {
  const [x1, y1] = annotation.from;
  const [x2, y2] = annotation.to;
  const label = annotation.label ? renderLabel(x1 + 10, y1 - 34, annotation.label) : "";

  return `
<path d="M ${x1} ${y1} L ${x2} ${y2}"
      stroke="${RED}" stroke-width="4"
      fill="none" marker-end="url(#arrowhead)" />
${label}`;
}

function renderMarker(annotation) {
  return `
<circle class="annotation-fill" cx="${annotation.x}" cy="${annotation.y}" r="${annotation.radius || 18}" />
<text class="annotation-marker-text" x="${annotation.x}" y="${annotation.y}">
  ${escapeXml(annotation.text || "")}
</text>`;
}

function renderSpotlight(annotation, imageWidth, imageHeight) {
  const opacity = annotation.opacity ?? 0.55;
  const label = annotation.label ? renderLabel(annotation.x, annotation.y - 34, annotation.label) : "";

  if (annotation.shape === "oval") {
    const cx = annotation.x + annotation.width / 2;
    const cy = annotation.y + annotation.height / 2;

    return `
<path fill="black" fill-opacity="${opacity}" fill-rule="evenodd"
      d="M 0 0 H ${imageWidth} V ${imageHeight} H 0 Z
         M ${cx - annotation.width / 2} ${cy}
         a ${annotation.width / 2} ${annotation.height / 2} 0 1 0 ${annotation.width} 0
         a ${annotation.width / 2} ${annotation.height / 2} 0 1 0 -${annotation.width} 0" />
<ellipse cx="${cx}" cy="${cy}" rx="${annotation.width / 2}" ry="${annotation.height / 2}"
         fill="none" class="annotation-stroke" />
${label}`;
  }

  return `
<path fill="black" fill-opacity="${opacity}" fill-rule="evenodd"
      d="M 0 0 H ${imageWidth} V ${imageHeight} H 0 Z
         M ${annotation.x} ${annotation.y}
         H ${annotation.x + annotation.width}
         V ${annotation.y + annotation.height}
         H ${annotation.x} Z" />
<rect x="${annotation.x}" y="${annotation.y}"
      width="${annotation.width}" height="${annotation.height}"
      rx="${annotation.rx ?? 8}"
      fill="none" class="annotation-stroke" />
${label}`;
}

function renderLabel(x, y, text) {
  const safeText = escapeXml(text);
  const width = Math.max(80, estimateTextWidth(text) + 24);
  const safeY = Math.max(8, y);

  return `
<rect class="annotation-fill" x="${x}" y="${safeY}" width="${width}" height="28" rx="6" />
<text class="annotation-label" x="${x + 12}" y="${safeY + 20}">
  ${safeText}
</text>`;
}

function estimateTextWidth(text) {
  return Array.from(String(text)).reduce((sum, char) => {
    return sum + (char.charCodeAt(0) > 127 ? 11 : 9);
  }, 0);
}

module.exports = {
  dumpConfigFile,
  findAnnotationConfigs,
  generateAnnotatedImage,
  generateFromConfigFile,
  loadConfigFile,
  renderSvgOverlay,
};
