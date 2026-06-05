const RED = "#ff2d2d";

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function estimateTextWidth(text) {
  return Array.from(String(text)).reduce((sum, char) => sum + (char.charCodeAt(0) > 127 ? 11 : 9), 0);
}

function renderLabel(x, y, text) {
  const width = Math.max(80, estimateTextWidth(text) + 24);
  const safeY = Math.max(8, y);

  return `
<rect class="annotation-fill" x="${x}" y="${safeY}" width="${width}" height="28" rx="6" />
<text class="annotation-label" x="${x + 12}" y="${safeY + 20}">
  ${escapeXml(text)}
</text>`;
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

function renderSvgOverlay(width, height, annotations) {
  const items = annotations.map((annotation) => renderAnnotation(annotation, width, height)).join("\n");

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
     xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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

async function loadAnnotationFigure(container) {
  const configPath = container.dataset.annotationConfig;
  const image = container.querySelector("img");

  if (!configPath || !image) {
    return;
  }

  const response = await fetch(configPath);
  if (!response.ok) {
    throw new Error(`Failed to load annotation config: ${configPath}`);
  }

  const configText = await response.text();
  const config = parseAnnotationConfig(configPath, configText);
  const sourceWidth = config.width || image.naturalWidth;
  const sourceHeight = config.height || image.naturalHeight;
  const crop = normalizeCrop(config.crop, sourceWidth, sourceHeight);
  const width = crop ? crop.width : sourceWidth;
  const height = crop ? crop.height : sourceHeight;
  const annotations = crop
    ? (Array.isArray(config.annotations) ? config.annotations : []).map((annotation) =>
        transformAnnotationForCrop(annotation, crop),
      )
    : Array.isArray(config.annotations)
      ? config.annotations
      : [];

  applyCropPreview(container, image, crop, sourceWidth, sourceHeight);

  const overlay = document.createElement("div");
  overlay.className = "annotated-screenshot__overlay";
  overlay.innerHTML = renderSvgOverlay(width, height, annotations);
  container.appendChild(overlay);
}

function normalizeCrop(crop, sourceWidth, sourceHeight) {
  if (!crop) {
    return null;
  }

  const left = clampNumber(crop.x, 0, sourceWidth);
  const top = clampNumber(crop.y, 0, sourceHeight);
  const right = clampNumber(Number(crop.x) + Number(crop.width), 0, sourceWidth);
  const bottom = clampNumber(Number(crop.y) + Number(crop.height), 0, sourceHeight);
  const width = right - left;
  const height = bottom - top;

  return width > 0 && height > 0 ? { left, top, width, height } : null;
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
    next.from = [Number(next.from[0]) - crop.left, Number(next.from[1]) - crop.top];
  }

  if (Array.isArray(next.to)) {
    next.to = [Number(next.to[0]) - crop.left, Number(next.to[1]) - crop.top];
  }

  return next;
}

function applyCropPreview(container, image, crop, sourceWidth, sourceHeight) {
  if (!crop) {
    return;
  }

  container.classList.add("annotated-screenshot--cropped");
  container.style.setProperty("--crop-width", `${crop.width}px`);
  container.style.setProperty("--crop-aspect-ratio", `${crop.width} / ${crop.height}`);
  image.style.width = `${(sourceWidth / crop.width) * 100}%`;
  image.style.maxWidth = "none";
  image.style.transform = `translate(${(-crop.left / sourceWidth) * 100}%, ${(-crop.top / sourceHeight) * 100}%)`;
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(Math.round(Number(value) || 0), min), max);
}

function hasNumber(value) {
  return value !== undefined && value !== null && value !== "" && Number.isFinite(Number(value));
}

function parseAnnotationConfig(configPath, configText) {
  if (configPath.endsWith(".json")) {
    return JSON.parse(configText);
  }

  if (!window.jsyaml || typeof window.jsyaml.load !== "function") {
    throw new Error(`YAML parser is not available for: ${configPath}`);
  }

  return window.jsyaml.load(configText);
}

function whenImageReady(image) {
  if (image.complete && image.naturalWidth > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener("error", () => reject(new Error(`Failed to load image: ${image.currentSrc || image.src}`)), {
      once: true,
    });
  });
}

async function initAnnotatedScreenshots() {
  const containers = Array.from(document.querySelectorAll("[data-annotation-config]"));

  for (const container of containers) {
    const image = container.querySelector("img");
    if (!image) {
      continue;
    }

    await whenImageReady(image);
    await loadAnnotationFigure(container);
  }
}

window.initAnnotatedScreenshots = initAnnotatedScreenshots;

document.addEventListener("DOMContentLoaded", () => {
  initAnnotatedScreenshots().catch((error) => {
    console.error(error);
  });
});
