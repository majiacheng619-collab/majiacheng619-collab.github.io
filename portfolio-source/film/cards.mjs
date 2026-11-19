const productStart = 6.25;
const filmStart = 12.5;

export const chapters = [
  { start: 0, label: '电商增长' },
  { start: productStart, label: '产品交付' },
  { start: filmStart, label: '峡谷鲸跃' },
  { start: 17, label: '驶向冰拱' },
];

export const cards = [
  {
    start: 0, end: productStart, byline: '马嘉程', heading: '电商与用户增长',
    lines: ['设计教学服务，搭建推广渠道', '服务近 1,000 名去重学员', '电商项目净利润超 40 万元'],
  },
  {
    start: productStart, end: filmStart, heading: '产品策划与交付', kind: 'game',
    lines: ['用 Codex 开发并上线网站', '独立策划《萌芽保卫队》', '4 个世界 · 20 个关卡'],
  },
  { start: 19.2, end: 23.4, heading: '冰之圣殿', lines: ['CATHEDRAL OF ICE'], kind: 'title' },
];

const smooth = (t) => {
  const n = Math.max(0, Math.min(1, t));
  return n * n * (3 - 2 * n);
};

function fitText(ctx, text, font, width, x, y, minSize = 28) {
  let size = font;
  ctx.font = `${size}px Film Noto, sans-serif`;
  while (ctx.measureText(text).width > width && size > minSize) {
    size -= 1;
    ctx.font = `${size}px Film Noto, sans-serif`;
  }
  ctx.fillText(text, x, y);
}

function drawTitle(ctx, card) {
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(1,8,20,.9)';
  ctx.shadowBlur = 28;
  ctx.fillStyle = '#f1f9ff';
  ctx.font = '111px Film Noto, sans-serif';
  ctx.fillText(card.heading, 106, 756);
  ctx.font = '38px Georgia, serif';
  ctx.letterSpacing = '9px';
  ctx.fillStyle = '#dffcff';
  ctx.fillText(card.lines[0], 111, 824);
  ctx.letterSpacing = '0px';
}

function drawPlaque(ctx, card, gameFrame) {
  const game = card.kind === 'game';
  const x = 90, y = 85;
  const width = game ? 1220 : 1070;
  const height = 410;
  const glass = ctx.createLinearGradient(x, y, x + width * .69, y + height);
  glass.addColorStop(0, 'rgba(13,24,37,.86)');
  glass.addColorStop(.55, 'rgba(11,29,43,.72)');
  glass.addColorStop(1, 'rgba(8,30,44,.57)');
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 33);
  ctx.fillStyle = glass;
  ctx.fill();
  const rim = ctx.createLinearGradient(x, y, x + width, y + height);
  rim.addColorStop(0, 'rgba(235,250,255,.80)');
  rim.addColorStop(.42, 'rgba(181,226,243,.29)');
  rim.addColorStop(1, 'rgba(213,249,253,.54)');
  ctx.strokeStyle = rim;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textBaseline = 'alphabetic';
  const textX = x + 44;
  let headingY = y + 122;
  if (card.byline) {
    ctx.fillStyle = '#c2e9ef';
    ctx.font = '44px Film Noto, sans-serif';
    ctx.fillText(card.byline, textX, y + 78);
    headingY = y + 166;
  }
  ctx.fillStyle = '#f5fbff';
  fitText(ctx, card.heading, 88, width - 88, textX, headingY);
  ctx.fillStyle = '#d9f5f7';
  card.lines.forEach((line, index) => {
    fitText(ctx, line, 64, width - (game ? 419 : 88), textX, headingY + 75 + index * 66);
  });
  if (game && gameFrame) {
    const gw = 330, gh = gameFrame.height * gw / gameFrame.width;
    const gx = x + width - gw - 44, gy = y + height - gh - 44;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 14);
    ctx.clip();
    ctx.drawImage(gameFrame, gx, gy, gw, gh);
    ctx.restore();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(203,245,244,.58)';
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 14);
    ctx.stroke();
  }
}

export function drawCards(ctx, time, gameFrame) {
  const card = cards.find(({ start, end }) => time >= start && time < end);
  if (!card) return;
  const appearance = smooth((time - card.start) / .34);
  const departure = smooth((card.end - time) / .34);
  ctx.save();
  if (time < filmStart) {
    const shade = .17 * smooth((filmStart - time) / .7);
    ctx.fillStyle = `rgba(4,12,24,${shade})`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
  ctx.globalAlpha = appearance * departure;
  ctx.translate(0, (1 - appearance + 1 - departure) * 18);
  if (card.kind === 'title') drawTitle(ctx, card);
  else drawPlaque(ctx, card, gameFrame);
  ctx.restore();
}
