// One play of the sort: boxes leave the top rule, flick through three orders, then the
// keepers drop into a stack and the rest leave the frame.

export const FIELD_H = 120;
export const MOTION_END = 1.35;
export const BOX_W = 44;
export const BOX_H = 20;

const COUNT = 8;
const LINE = 4;
const LEFT = 8;

const SCRAMBLE: readonly (readonly number[])[] = [
  [3, 6, 1, 7, 0, 4, 2, 5],
  [5, 1, 6, 2, 7, 0, 4, 3],
  [1, 4, 0, 6, 2, 5, 7, 3],
];

export type SortPhase = "gather" | "sort" | "ranked";

export type MotionBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  sky: boolean;
  on: boolean;
};

type Key = { at: number; x: number; y: number; h: number };

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t));
}

function smooth(t: number) {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

function flick(t: number) {
  const c = clamp01(t);
  const s = 2.2;
  return 1 + (s + 1) * (c - 1) ** 3 + s * (c - 1) ** 2;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function phaseAt(time: number): SortPhase {
  if (time < 0.46) return "gather";
  if (time < 1.05) return "sort";
  return "ranked";
}

function slotX(slot: number, width: number) {
  const pitch = Math.max(BOX_W * 0.55, (width - LEFT - 8 - BOX_W) / (COUNT - 1));
  return LEFT + slot * pitch;
}

function keysFor(index: number, keep: number, width: number): readonly Key[] {
  const spawn = index * 0.04;
  const kept = index < keep;
  return [
    { at: spawn, x: slotX(SCRAMBLE[0]![index]!, width), y: LINE, h: 2 },
    { at: spawn + 0.16, x: slotX(SCRAMBLE[0]![index]!, width), y: 28, h: BOX_H },
    { at: 0.46, x: slotX(SCRAMBLE[1]![index]!, width), y: 34, h: BOX_H },
    { at: 0.66, x: slotX(SCRAMBLE[2]![index]!, width), y: 24, h: BOX_H },
    { at: 0.86, x: slotX(SCRAMBLE[0]![index]!, width), y: 32, h: BOX_H },
    {
      at: 1.08,
      x: kept ? 16 : width + BOX_W + 12,
      y: kept ? 12 + index * 22 : 18 + (index % 3) * 16,
      h: BOX_H,
    },
  ];
}

function sample(keys: readonly Key[], t: number): Key {
  const first = keys[0]!;
  if (t <= first.at) return { at: t, x: first.x, y: LINE, h: 0 };
  let prev = first;
  for (let i = 1; i < keys.length; i += 1) {
    const next = keys[i]!;
    if (t < next.at) {
      const u = (t - prev.at) / (next.at - prev.at);
      return {
        at: t,
        x: lerp(prev.x, next.x, flick(u)),
        y: lerp(prev.y, next.y, smooth(u)),
        h: lerp(prev.h, next.h, smooth(u)),
      };
    }
    prev = next;
  }
  return prev;
}

export function boxesAt(time: number, total: number, fits: number, width: number): MotionBox[] {
  const keep = Math.min(Math.max(0, Math.floor(total)), 5);
  const fitCount = Math.min(Math.max(0, Math.floor(fits)), keep);
  const t = Math.max(0, time);
  return Array.from({ length: COUNT }, (_, index) => {
    const frame = sample(keysFor(index, keep, width), t);
    return {
      x: frame.x,
      y: frame.y,
      w: BOX_W,
      h: frame.h,
      sky: index < fitCount && t >= 1.12 && frame.x < width,
      on: frame.h > 1 && frame.x < width + BOX_W,
    };
  });
}

function threshold(x: number, y: number) {
  const n = 0.06711056 * x + 0.00583715 * y;
  const f = n - Math.floor(n);
  const m = 52.9829189 * f;
  return m - Math.floor(m);
}

function packed(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  return ((255 << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | (n >> 16)) >>> 0;
}

const INK = packed("#011a25");
const SKY = packed("#6ec1ea");

function stamp(buffer: Float32Array, width: number, height: number, x: number, y: number, w: number, h: number, tone: number) {
  const x0 = Math.floor(x) - 1;
  const y0 = Math.floor(y) - 1;
  const x1 = Math.ceil(x + w) + 1;
  const y1 = Math.ceil(y + h) + 1;
  for (let py = y0; py <= y1; py += 1) {
    if (py < 0 || py >= height) continue;
    for (let px = x0; px <= x1; px += 1) {
      if (px < 0 || px >= width) continue;
      const dx = px < x ? x - px : px > x + w ? px - (x + w) : 0;
      const dy = py < y ? y - py : py > y + h ? py - (y + h) : 0;
      const edge = Math.max(dx, dy);
      const value = edge <= 0 ? tone : Math.max(0, tone * (1 - edge / 2));
      const i = py * width + px;
      if (value > buffer[i]!) buffer[i] = value;
    }
  }
}

export function createSortPainter(width: number, height: number) {
  const ink = new Float32Array(width * height);
  const sky = new Float32Array(width * height);

  return {
    paint(pixels: Uint32Array, time: number, total: number, fits: number) {
      for (let i = 0; i < ink.length; i += 1) {
        ink[i]! *= 0.62;
        sky[i]! *= 0.62;
      }
      for (let x = 0; x < width; x += 3) stamp(ink, width, height, x, 1, 1, 1, 1);
      for (let index = 0; index < COUNT; index += 1) {
        const spawn = index * 0.04;
        const u = (time - spawn) / 0.16;
        if (u <= 0 || u >= 1) continue;
        const travel = smooth(u);
        stamp(sky, width, height, width - (width - LEFT) * travel, 0, 12 * (1 - travel) + 2, 3, 1);
      }
      for (const box of boxesAt(time, total, fits, width)) {
        if (!box.on) continue;
        stamp(box.sky ? sky : ink, width, height, box.x, box.y, box.w, box.h, 1);
      }
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = y * width + x;
          const gate = threshold(x, y);
          pixels[i] = ink[i]! > gate ? INK : sky[i]! > gate ? SKY : 0;
        }
      }
    },
  };
}
