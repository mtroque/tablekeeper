import type { CellRegion } from './cells';

export type CellFeatures = {
  /** CIELAB mean (L 0 to 100). */
  lab: [number, number, number];
  /** CIELAB standard deviation. */
  spread: [number, number, number];
  /** Share of masked pixels on a strong edge, 0 to 1. */
  edgeDensity: number;
  /** Hue histogram over saturated pixels, normalized to sum 1; only when asked for. */
  hue?: number[];
};

/** Names of the scalar features, in `featureVector` order. */
export const FEATURE_NAMES = ['L', 'a', 'b', 'spreadL', 'spreadA', 'spreadB', 'edge'] as const;
export type FeatureName = (typeof FEATURE_NAMES)[number];

/** Gradient magnitude (on lightness, 0 to 100) above which a pixel counts as an edge. */
const EDGE_THRESHOLD = 12;

/** LAB mean and spread, edge density and optionally a hue histogram of a cell's masked pixels. */
export function cellFeatures(region: CellRegion, opts: { hueBins?: number } = {}): CellFeatures {
  const { width, height, rgb, mask } = region;
  const n = width * height;
  const lightness = new Float32Array(n);
  let sL = 0,
    sA = 0,
    sB = 0,
    qL = 0,
    qA = 0,
    qB = 0;
  const hue = opts.hueBins ? new Array<number>(opts.hueBins).fill(0) : undefined;
  let count = 0;
  let saturated = 0;
  for (let i = 0; i < n; i++) {
    const [L, a, b] = rgbToLab(
      rgb[i * 3] as number,
      rgb[i * 3 + 1] as number,
      rgb[i * 3 + 2] as number,
    );
    lightness[i] = L;
    if (!mask[i]) continue;
    count++;
    sL += L;
    sA += a;
    sB += b;
    qL += L * L;
    qA += a * a;
    qB += b * b;
    if (hue) {
      const chroma = Math.hypot(a, b);
      if (chroma > 12) {
        const angle = (Math.atan2(b, a) + 2 * Math.PI) % (2 * Math.PI);
        const bin = Math.min(hue.length - 1, Math.floor((angle / (2 * Math.PI)) * hue.length));
        hue[bin] = (hue[bin] as number) + 1;
        saturated++;
      }
    }
  }
  const safe = Math.max(1, count);
  const mean: [number, number, number] = [sL / safe, sA / safe, sB / safe];
  const sd = (q: number, m: number) => Math.sqrt(Math.max(0, q / safe - m * m));
  const spread: [number, number, number] = [sd(qL, mean[0]), sd(qA, mean[1]), sd(qB, mean[2])];

  let edges = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      const gx = (lightness[i + 1] as number) - (lightness[i - 1] as number);
      const gy = (lightness[i + width] as number) - (lightness[i - width] as number);
      if (Math.hypot(gx, gy) / 2 > EDGE_THRESHOLD) edges++;
    }
  }

  const features: CellFeatures = { lab: mean, spread, edgeDensity: edges / safe };
  if (hue) features.hue = hue.map((v) => (saturated ? v / saturated : 0));
  return features;
}

export function featureVector(
  features: CellFeatures,
  names: readonly FeatureName[] = FEATURE_NAMES,
): number[] {
  return names.map((name) => {
    switch (name) {
      case 'L':
        return features.lab[0];
      case 'a':
        return features.lab[1];
      case 'b':
        return features.lab[2];
      case 'spreadL':
        return features.spread[0];
      case 'spreadA':
        return features.spread[1];
      case 'spreadB':
        return features.spread[2];
      case 'edge':
        // Scaled so it varies over a range comparable to the color features.
        return features.edgeDensity * 100;
    }
  });
}

/** sRGB (0 to 255) to CIELAB, D65. */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (t * 24389) / 27 / 116 + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
