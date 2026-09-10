const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1728;
const PAPER = "#FFF8EA";
const TITLE = "#6E1024";
const TEAL = "#0F766E";
const BODY = "#3F3A39";
const FONT_STACK = "'IBM Plex Sans KR', system-ui, -apple-system, BlinkMacSystemFont, sans-serif";

const themes = {
  white: ["#FFF8EA", "#A91532", "#1F2933"],
  cheer: ["#FFF1D2", "#B0173A", "#182D4E"],
  eng: ["#F4F7FB", "#C41E3A", "#263238"],
  void: ["#EAF4F1", "#7E1B2E", "#174A48"],
  spec: ["#FFF8E8", "#8F1730", "#3A3153"],
  romance: ["#FFF0EA", "#B51E35", "#524033"]
};

export async function generateResultCard(type) {
  await document.fonts?.ready;

  const canvas = document.querySelector("#share-renderer") ?? document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  const [background, accent] = themes[type.id] ?? themes.white;

  await drawBackground(ctx, type, background, accent);

  const titleBottom = drawTypeTitle(ctx, type.name, 540, 880, 880, TITLE);
  const oneLinerBottom = drawBalancedCenteredText(ctx, type.oneLiner, 540, titleBottom + 46, 650, 38, 1.54, TEAL, "900");
  drawWrappedText(ctx, type.description, 72, oneLinerBottom + 68, 936, 34, 1.66, BODY, "700", "left");

  return canvasToBlob(canvas);
}

export async function saveOrShareResultCard(type) {
  const blob = await generateResultCard(type);
  const filename = `korea-tiger-${type.id}.png`;
  downloadBlob(blob, filename);
  return "downloaded";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function drawBackground(ctx, type, background, accent) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const base = ctx.createLinearGradient(0, 0, CARD_WIDTH, 760);
  base.addColorStop(0, background);
  base.addColorStop(0.5, "#FFFBF2");
  base.addColorStop(1, PAPER);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const glow = ctx.createRadialGradient(540, 300, 80, 540, 300, 560);
  glow.addColorStop(0, withAlpha(accent, 0.18));
  glow.addColorStop(0.48, withAlpha(accent, 0.08));
  glow.addColorStop(1, withAlpha(accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_WIDTH, 880);

  const image = await loadImage(type.imageAsset);
  drawContainedImage(ctx, image, 18, -6, 1044, 980);
  drawVerticalFade(ctx, 785, 1000, PAPER);
}

function drawVerticalFade(ctx, fromY, toY, color) {
  const gradient = ctx.createLinearGradient(0, fromY, 0, toY);
  gradient.addColorStop(0, withAlpha(color, 0));
  gradient.addColorStop(0.46, withAlpha(color, 0.8));
  gradient.addColorStop(1, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, fromY, CARD_WIDTH, toY - fromY);
  ctx.fillStyle = color;
  ctx.fillRect(0, toY, CARD_WIDTH, CARD_HEIGHT - toY);
}

function drawContainedImage(ctx, image, x, y, width, height) {
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawCenteredText(ctx, text, x, y, size, color, weight = "700") {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${FONT_STACK}`;
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
  return y + size;
}

function drawTypeTitle(ctx, name, x, y, maxWidth, color) {
  const { prefix, tiger } = splitTigerTitle(name);
  const prefixBottom = drawCenteredText(ctx, prefix, x, y, 50, color, "900");
  return drawWrappedText(ctx, tiger, x, prefixBottom + 42, maxWidth, 86, 1.06, color, "900", "center");
}

function drawBalancedCenteredText(ctx, text, x, y, maxWidth, size, lineHeight, color, weight) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${FONT_STACK}`;
  ctx.textAlign = "center";

  const words = text.split(" ");
  const fullWidth = ctx.measureText(text).width;
  if (fullWidth <= maxWidth) {
    ctx.fillText(text, x, y);
    return y + size;
  }

  let bestLines = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let index = 1; index < words.length; index += 1) {
    const firstLine = words.slice(0, index).join(" ");
    const secondLine = words.slice(index).join(" ");
    const firstWidth = ctx.measureText(firstLine).width;
    const secondWidth = ctx.measureText(secondLine).width;
    if (firstWidth > maxWidth || secondWidth > maxWidth) continue;

    const orphanPenalty = Math.min(firstLine.length, secondLine.length) < 8 ? 1000 : 0;
    const score = Math.abs(firstWidth - secondWidth) + orphanPenalty;
    if (score < bestScore) {
      bestScore = score;
      bestLines = [firstLine, secondLine];
    }
  }

  if (!bestLines) {
    return drawWrappedText(ctx, text, x, y, maxWidth, size, lineHeight, color, weight, "center");
  }

  const lineGap = size * lineHeight;
  bestLines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineGap);
  });

  return y + (bestLines.length - 1) * lineGap + size;
}

function drawWrappedText(ctx, text, x, y, maxWidth, size, lineHeight, color, weight, align = "left") {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${FONT_STACK}`;
  ctx.textAlign = align;

  const words = text.split(" ");
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  });
  lines.push(line);

  const lineGap = size * lineHeight;
  lines.forEach((wrappedLine, index) => {
    ctx.fillText(wrappedLine, x, y + index * lineGap);
  });

  return y + (lines.length - 1) * lineGap + size;
}

function splitTigerTitle(name) {
  const parts = name.trim().split(" ");
  const tiger = parts.at(-1) === "호랑이" ? parts.splice(-2).join(" ") : (parts.pop() ?? name);
  return {
    prefix: parts.join(" "),
    tiger
  };
}

function withAlpha(hex, alpha) {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("결과 이미지를 만들지 못했습니다."));
    }, "image/png");
  });
}
