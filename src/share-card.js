import { TEST_PUBLIC_URL } from "./data.js";

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;
const GEMINI_LOCKUP = "./assets/gemini/google-gemini-lockup.png";

const themes = {
  white: ["#F7F4EA", "#A91532", "#1F2933"],
  cheer: ["#FFF1D2", "#B0173A", "#182D4E"],
  eng: ["#F4F7FB", "#C41E3A", "#263238"],
  void: ["#EAF4F1", "#7E1B2E", "#174A48"],
  spec: ["#FFF8E8", "#8F1730", "#3A3153"],
  romance: ["#FFF0EA", "#B51E35", "#524033"]
};

export async function generateResultCard(type, matchNames) {
  const canvas = document.querySelector("#share-renderer") ?? document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  const [background, accent, ink] = themes[type.id] ?? themes.white;

  drawBackground(ctx, background, accent, ink);

  const image = await loadImage(type.imageAsset);
  drawContainedImage(ctx, image, 160, 220, 760, 760);

  drawCenteredText(ctx, "나의 2학기 생존 호랑이는", 540, 1015, 44, ink, "700");
  drawWrappedText(ctx, type.name, 540, 1110, 780, 86, 1.12, accent, "900", "center");
  drawWrappedText(ctx, type.oneLiner, 540, 1325, 780, 42, 1.45, ink, "700", "center");

  drawInfoPill(ctx, `찰떡궁합 ${matchNames.good}`, 130, 1465, 390, accent, "#FFFFFF");
  drawInfoPill(ctx, `거리두기 ${matchNames.bad}`, 560, 1465, 390, ink, "#FFFFFF");

  const logo = await loadImage(GEMINI_LOCKUP);
  drawContainedImage(ctx, logo, 325, 1564, 430, 76);

  ctx.fillStyle = ink;
  ctx.font = "700 34px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("대학생·대학원생이라면", 540, 1682);
  ctx.fillStyle = accent;
  ctx.font = "900 50px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("Google AI Plus 12개월 무료", 540, 1747);

  ctx.fillStyle = ink;
  ctx.font = "800 46px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(TEST_PUBLIC_URL, 540, 1832);

  ctx.fillStyle = "rgba(31, 41, 51, 0.62)";
  ctx.font = "500 28px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("스토리에 올릴 때 링크 스티커도 같이 달아주세요!", 540, 1887);

  return canvasToBlob(canvas);
}

export async function saveOrShareResultCard(type, matchNames) {
  const blob = await generateResultCard(type, matchNames);
  const file = new File([blob], `korea-tiger-${type.id}.png`, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: "나의 2학기 생존 호랑이 유형",
        text: `${type.name} 결과가 나왔어요`
      });
      return "shared";
    } catch {
      downloadBlob(blob, file.name);
      return "downloaded";
    }
  }

  downloadBlob(blob, file.name);
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
  URL.revokeObjectURL(url);
}

function drawBackground(ctx, background, accent, ink) {
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, CARD_WIDTH, 26);
  ctx.fillRect(0, CARD_HEIGHT - 26, CARD_WIDTH, 26);

  ctx.globalAlpha = 0.08;
  ctx.fillStyle = ink;
  for (let y = 120; y < CARD_HEIGHT; y += 190) {
    ctx.fillRect(85, y, 910, 4);
  }
  ctx.globalAlpha = 1;

  ctx.beginPath();
  ctx.roundRect(86, 112, 908, 1696, 44);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  ctx.stroke();
}

function drawInfoPill(ctx, text, x, y, width, fill, textColor) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, 86, 43);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.font = "800 30px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, x + width / 2, y + 55);
}

function drawContainedImage(ctx, image, x, y, width, height) {
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawCenteredText(ctx, text, x, y, size, color, weight = "700") {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
}

function drawWrappedText(ctx, text, x, y, maxWidth, size, lineHeight, color, weight, align = "left") {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
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

  lines.forEach((wrappedLine, index) => {
    ctx.fillText(wrappedLine, x, y + index * size * lineHeight);
  });
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
