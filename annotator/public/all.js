const RED = "#ff2d2d";

const statusEl = document.querySelector("#all-status");
const previewsEl = document.querySelector("#all-previews");
const filterEl = document.querySelector("#language-filter");
const filterButtonTemplate = document.querySelector("#language-filter-button-template");
const languageTemplate = document.querySelector("#language-section-template");
const template = document.querySelector("#preview-card-template");
const params = new URLSearchParams(window.location.search);
let selectedLanguage = (params.get("lang") || "all").toLowerCase();

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
    .annotation-stroke { stroke: ${RED}; stroke-width: 4; }
    .annotation-fill { fill: ${RED}; }
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

function setStatus(message) {
  statusEl.textContent = message;
}

function setSelectedLanguage(language) {
  selectedLanguage = language.toLowerCase();
  const nextUrl = new URL(window.location.href);

  if (selectedLanguage === "all") {
    nextUrl.searchParams.delete("lang");
  } else {
    nextUrl.searchParams.set("lang", selectedLanguage);
  }

  window.history.replaceState({}, "", nextUrl);
}

function renderLanguageFilter(languages) {
  filterEl.innerHTML = "";
  const options = ["all", ...languages.map((language) => String(language.language).toLowerCase())];

  for (const option of options) {
    const button = filterButtonTemplate.content.firstElementChild.cloneNode(true);
    button.textContent = option.toUpperCase();
    button.classList.toggle("active", option === selectedLanguage);
    button.addEventListener("click", async () => {
      setSelectedLanguage(option);
      await renderFromState(window.__allAnnotationsState);
    });
    filterEl.appendChild(button);
  }
}

async function fetchJson(endpoint) {
  const response = await fetch(endpoint);
  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.error || response.statusText);
  }

  return json;
}

async function init() {
  setStatus("Loading previews...");
  const data = await fetchJson("/api/all-annotations");
  window.__allAnnotationsState = data;
  renderLanguageFilter(data.languages || []);
  await renderFromState(data);
}

async function renderFromState(data) {
  previewsEl.innerHTML = "";

  let total = 0;
  for (const language of data.languages || []) {
    if (selectedLanguage !== "all" && String(language.language).toLowerCase() !== selectedLanguage) {
      continue;
    }

    const section = languageTemplate.content.firstElementChild.cloneNode(true);
    section.querySelector(".language-section__title").textContent = String(language.language).toUpperCase();
    section.querySelector(".language-section__meta").textContent = language.manifestPath;
    const list = section.querySelector(".language-section__list");
    previewsEl.appendChild(section);

    for (const item of language.items || []) {
      await renderPreviewCardInto(list, item);
      total += 1;
    }
  }

  setStatus(`Loaded ${total} screenshot preview(s)`);
  renderLanguageFilter(data.languages || []);
}

async function renderPreviewCardInto(parent, item) {
  const node = template.content.firstElementChild.cloneNode(true);
  const titleEl = node.querySelector(".preview-card__title");
  const metaEl = node.querySelector(".preview-card__meta");
  const editLink = node.querySelector(".preview-card__edit");
  const image = node.querySelector(".annotated-screenshot__image");
  const overlay = node.querySelector(".annotated-screenshot__overlay");

  titleEl.textContent = item.title;
  metaEl.textContent = [item.page, item.configPath ? item.name : item.image].filter(Boolean).join(" · ");

  if (item.editorUrl) {
    editLink.href = item.editorUrl;
    editLink.textContent = item.annotations.length ? "Edit" : "Create";
  } else {
    editLink.removeAttribute("href");
    editLink.setAttribute("aria-disabled", "true");
    editLink.classList.add("button-link--disabled");
    editLink.textContent = "No config";
  }

  image.src = item.inputUrl;
  image.alt = titleEl.textContent;

  parent.appendChild(node);

  await whenImageReady(image);

  const sourceWidth = item.width || image.naturalWidth;
  const sourceHeight = item.height || image.naturalHeight;
  const crop = normalizeCrop(item.crop, sourceWidth, sourceHeight);
  const width = crop ? crop.width : sourceWidth;
  const height = crop ? crop.height : sourceHeight;
  applyCropPreview(node.querySelector(".annotated-screenshot"), image, crop, sourceWidth, sourceHeight);

  if (Array.isArray(item.annotations) && item.annotations.length) {
    const annotations = crop ? item.annotations.map((annotation) => transformAnnotationForCrop(annotation, crop)) : item.annotations;
    overlay.innerHTML = renderSvgOverlay(width, height, annotations || []);
  }
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
init().catch((error) => setStatus(`Error: ${error.message}`));
