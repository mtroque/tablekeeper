import { getCv, type Mat } from './opencv';

export type NormalizeOptions = {
  /** CLAHE clip limit. */
  clipLimit?: number;
  /** CLAHE tiles per side. */
  tiles?: number;
};

/**
 * Evens out lighting on an RGB board image: gray-world white balance (each channel scaled to the
 * common mean), then CLAHE on the LAB lightness. Returns a new RGB Mat; the caller deletes it.
 */
export function normalizeLighting(mat: Mat, opts: NormalizeOptions = {}): Mat {
  const cv = getCv();
  const { clipLimit = 2, tiles = 4 } = opts;

  const channels = new cv.MatVector();
  cv.split(mat, channels);
  const means = [0, 1, 2].map((i) => channelMean(channels.get(i)));
  const gray = means.reduce((sum, m) => sum + m, 0) / 3;
  const balanced = new cv.MatVector();
  for (let i = 0; i < 3; i++) {
    const channel = channels.get(i);
    const scaled = new cv.Mat();
    channel.convertTo(scaled, -1, gray / Math.max(1, means[i] ?? gray), 0);
    balanced.push_back(scaled);
    channel.delete();
    scaled.delete();
  }
  channels.delete();
  const white = new cv.Mat();
  cv.merge(balanced, white);
  balanced.delete();

  const lab = new cv.Mat();
  cv.cvtColor(white, lab, cv.COLOR_RGB2Lab);
  white.delete();
  const labChannels = new cv.MatVector();
  cv.split(lab, labChannels);
  const lightness = labChannels.get(0);
  const equalized = new cv.Mat();
  const clahe = new cv.CLAHE(clipLimit, new cv.Size(tiles, tiles));
  clahe.apply(lightness, equalized);
  clahe.delete();
  const merged = new cv.MatVector();
  const a = labChannels.get(1);
  const b = labChannels.get(2);
  merged.push_back(equalized);
  merged.push_back(a);
  merged.push_back(b);
  cv.merge(merged, lab);
  for (const m of [lightness, equalized, a, b]) m.delete();
  merged.delete();
  labChannels.delete();

  const out = new cv.Mat();
  cv.cvtColor(lab, out, cv.COLOR_Lab2RGB);
  lab.delete();
  return out;
}

/** Mean of a single-channel 8-bit Mat, which it deletes (it comes from MatVector.get). */
function channelMean(channel: Mat): number {
  const data = channel.data;
  const n = data.length;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += data[i] as number;
  channel.delete();
  return n === 0 ? 0 : sum / n;
}
