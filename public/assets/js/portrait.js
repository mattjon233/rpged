const HAIR = [
  'M33 16 L36 4 L39 15 L41 3 L44 15 L47 5 L48 18 Z',
  'M24 40 C22 22 30 18 40 18 C50 18 58 22 56 40 L60 70 L52 66 L50 40 C46 30 34 30 30 40 L28 66 L20 70 Z',
  'M25 34 L27 22 L31 27 L34 17 L38 25 L41 15 L44 24 L48 17 L50 27 L54 22 L55 34 C50 27 30 27 25 34 Z',
  'M20 42 C14 30 20 14 32 13 C36 6 46 6 50 13 C62 14 67 30 60 42 C58 30 52 26 40 26 C28 26 22 30 20 42 Z',
  '',
  'M24 36 C22 22 32 15 40 15 C48 15 58 22 56 36 C52 26 28 26 24 36 Z',
  'M26 33 C27 23 34 20 40 20 C46 20 53 23 54 33 C49 29 31 29 26 33 Z',
  'M25 34 C21 28 26 20 32 20 C33 15 39 15 41 18 C45 14 52 17 51 22 C57 23 58 30 55 34 C50 27 30 27 25 34 Z',
  'M25 38 C24 22 31 18 40 18 C49 18 56 22 55 38 L56 72 L51 72 L50 38 C46 30 34 30 30 38 L29 72 L24 72 Z',
];

const SHOULDERS = 'M6 100 C9 80 22 71 40 69 C58 71 71 80 74 100 Z';

const hash = (text) => [...text].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);

const barsOf = (seed) => [0, 1, 2].map((k) => ({ y: 18 + ((seed >>> (k * 5)) % 70), w: 10 + ((seed >>> (k * 3)) % 30), x: (seed >>> (k * 4)) % 60 }));

export const portraitSVG = ({ name, color, hair = 0 }) => {
  const seed = hash(name);
  const id = `pg-${seed}`;
  const lines = Array.from({ length: 9 }, (_, i) => `<line x1="0" x2="80" y1="${i * 12}" y2="${i * 12}" stroke="${color}" stroke-opacity="0.08"/>`).join('');
  const bars = barsOf(seed)
    .map((bar, i) => `<rect x="${bar.x}" y="${bar.y}" width="${bar.w}" height="1.6" fill="${i === 1 ? '#1ef2ff' : color}" opacity="0.55"/>`)
    .join('');
  const hairPath = HAIR[hair % HAIR.length];
  return `<svg viewBox="0 0 80 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="0.38"/><stop offset="0.7" stop-color="#0a0407"/></linearGradient></defs><rect width="80" height="100" fill="url(#${id})"/>${lines}<path d="${SHOULDERS}" fill="#0c0508" stroke="${color}" stroke-opacity="0.8" stroke-width="1.2"/><rect x="34" y="56" width="12" height="14" fill="#0c0508"/><ellipse cx="40" cy="42" rx="14.5" ry="17.5" fill="#12090d" stroke="${color}" stroke-opacity="0.9" stroke-width="1.2"/>${hairPath ? `<path d="${hairPath}" fill="#1b0b12" stroke="${color}" stroke-width="1.1" stroke-linejoin="round"/>` : ''}<rect x="28" y="40" width="24" height="3.2" fill="${color}" opacity="0.95"/><rect x="28" y="40" width="24" height="3.2" fill="#fff" opacity="0.35"/>${bars}</svg>`;
};

export const drawPortrait = (ctx, width, height, { name, color, hair = 0 }) => {
  const seed = hash(name);
  ctx.save();
  ctx.scale(width / 80, height / 100);
  const gradient = ctx.createLinearGradient(0, 0, 0, 100);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.75, '#0a0407');
  ctx.fillStyle = '#0a0407';
  ctx.fillRect(0, 0, 80, 100);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 80, 100);
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = color;
  Array.from({ length: 9 }, (_, i) => ctx.fillRect(0, i * 12, 80, 0.8));
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = color;
  ctx.fillStyle = '#0c0508';
  const shoulders = new Path2D(SHOULDERS);
  ctx.fill(shoulders);
  ctx.stroke(shoulders);
  ctx.fillRect(34, 56, 12, 14);
  ctx.fillStyle = '#12090d';
  ctx.beginPath();
  ctx.ellipse(40, 42, 14.5, 17.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const hairPath = HAIR[hair % HAIR.length];
  if (hairPath) {
    const path = new Path2D(hairPath);
    ctx.fillStyle = '#1b0b12';
    ctx.fill(path);
    ctx.stroke(path);
  }
  ctx.fillStyle = color;
  ctx.fillRect(28, 40, 24, 3.2);
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#fff';
  ctx.fillRect(28, 40, 24, 3.2);
  ctx.globalAlpha = 0.55;
  barsOf(seed).forEach((bar, i) => {
    ctx.fillStyle = i === 1 ? '#1ef2ff' : color;
    ctx.fillRect(bar.x, bar.y, bar.w, 1.6);
  });
  ctx.restore();
};
