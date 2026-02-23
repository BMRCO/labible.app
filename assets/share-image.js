export async function shareVerseAsImage({ title, text, footer }) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const W = 1080, H = 1080;
  canvas.width = W; canvas.height = H;

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0b0b0b");
  g.addColorStop(1, "#1a1a1a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const pad = 72;
  const cardX = pad, cardY = pad, cardW = W - pad * 2, cardH = H - pad * 2;

  roundRect(ctx, cardX, cardY, cardW, cardH, 42);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "700 46px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(title, cardX + 48, cardY + 90);

  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.font = "400 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  wrapText(ctx, text, cardX + 48, cardY + 140, cardW - 96, 60, cardH - 240);

  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = "500 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(footer, cardX + 48, cardY + cardH - 68);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png", 0.92));
  const file = new File([blob], "verset.png", { type: "image/png" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ title: "2026 LaBible.app | LSG 1910", text: `${title}\n\n${text}`, files: [file] });
    return;
  }

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "verset.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lineH, maxH) {
  const words = String(text).split(/\s+/);
  let line = "";
  let yy = y;
  for (let i = 0; i < words.length; i++) {
    const test = line ? (line + " " + words[i]) : words[i];
    const m = ctx.measureText(test);
    if (m.width > maxW) {
      ctx.fillText(line, x, yy);
      line = words[i];
      yy += lineH;
      if (yy > y + maxH) return;
    } else {
      line = test;
    }
  }
  if (line && yy <= y + maxH) ctx.fillText(line, x, yy);
}
