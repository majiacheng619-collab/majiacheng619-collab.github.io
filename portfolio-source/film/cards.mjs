export const cards = [
  { start: .30, end: 3.8, heading: '冰之圣殿', lines: ['CATHEDRAL OF ICE'], kind: 'title' },
  { start: 4.15, end: 7.72, heading: '萌芽保卫队', lines: ['独立策划 · 4 个世界 · 20 关'], kind: 'game' },
  { start: 7.8, end: 10.85, heading: '面包挑战', lines: ['规则设计 · 活动物料 · 现场执行', '19.9 元／次'] },
  { start: 10.92, end: 12.53, heading: '电商教学与用户增长', lines: ['40 万+ 项目净利润', '近 1,000 名去重学员'] },
  { start: 17.10, end: 20.08, heading: '宿舍打印店', lines: ['黑白打印 0.2 元 · 1 份起送'] },
  { start: 20.18, end: 22.76, heading: '直播内容与用户运营', lines: ['1 万+ 抖音粉丝 · 单场最高曝光 30 万+'] },
  { start: 22.82, end: 25, heading: '马嘉程', lines: ['产品与运营'], kind: 'end' },
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
  const ending = card.kind === 'end';
  const game = card.kind === 'game';
  const x = ending ? 1290 : 92;
  const y = ending ? 820 : 84;
  const width = ending ? 536 : game ? 827 : 724;
  const height = card.lines.length === 2 ? 240 : 195;
  const glass = ctx.createLinearGradient(x, y, x + width * .69, y + height);
  glass.addColorStop(0, 'rgba(13,24,37,.80)');
  glass.addColorStop(.55, 'rgba(11,29,43,.61)');
  glass.addColorStop(1, 'rgba(8,30,44,.40)');
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
  ctx.fillStyle = '#f5fbff';
  const xText = x + 33;
  fitText(ctx, card.heading, ending ? 68 : 61, width - 65, xText, y + 80);
  ctx.fillStyle = '#d9f5f7';
  card.lines.forEach((line, index) => {
    fitText(ctx, line, ending ? 43 : 47, game ? width - 321 : width - 65, xText, y + 146 + index * 55);
  });
  if (game && gameFrame) {
    const gx = x + width - 249, gy = y + 27, gw = 222, gh = 141;
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
  const appearance = smooth((time - card.start) / .42);
  const departure = card.kind === 'end' ? 1 : smooth((card.end - time) / .37);
  ctx.save();
  ctx.globalAlpha = appearance * departure;
  ctx.translate(0, (1 - appearance + 1 - departure) * 18);
  if (card.kind === 'title') drawTitle(ctx, card);
  else drawPlaque(ctx, card, gameFrame);
  ctx.restore();
}
