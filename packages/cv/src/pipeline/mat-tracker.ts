import type { Mat, MatVector, OpenCv } from './opencv';

/**
 * Test helper: records every Mat and MatVector the code under test obtains from opencv (constructed,
 * or returned by an opencv call) so a test can assert they were all deleted.
 */
export type MatTracker = {
  /** Tracked objects not yet deleted. */
  live(): number;
  /** Total tracked objects. */
  total(): number;
  /** Puts opencv back the way it was. */
  restore(): void;
};

/** Module functions and prototype methods that hand back a new Mat. */
const RETURNS_MAT = [
  'matFromArray',
  'getPerspectiveTransform',
  'getRotationMatrix2D',
  'getStructuringElement',
] as const;

export function trackMats(cv: OpenCv): MatTracker {
  const seen = new Set<Mat | MatVector>();
  const record = <T extends Mat | MatVector>(value: T): T => {
    seen.add(value);
    return value;
  };
  const restores: Array<() => void> = [];

  const patch = (target: object, key: string) => {
    const original: unknown = Reflect.get(target, key);
    if (typeof original !== 'function') throw new Error(`opencv has no ${key}`);
    const wrapper = function (this: unknown, ...args: unknown[]) {
      return record(Reflect.apply(original, this, args) as Mat);
    };
    // Embind's overload dispatch reads `overloadTable` from whatever function sits at the key.
    Object.assign(wrapper, original);
    Reflect.set(target, key, wrapper);
    restores.push(() => Reflect.set(target, key, original));
  };
  for (const key of RETURNS_MAT) patch(cv, key);
  patch(cv.Mat.prototype, 'clone');
  patch(cv.Mat.prototype, 'roi');
  patch(cv.MatVector.prototype, 'get');

  const wrapConstructor = (key: 'Mat' | 'MatVector') => {
    const original = cv[key];
    const proxy = new Proxy(original, {
      construct(target, args: unknown[]) {
        return record(Reflect.construct(target, args) as Mat);
      },
    });
    Reflect.set(cv, key, proxy);
    restores.push(() => Reflect.set(cv, key, original));
  };
  wrapConstructor('Mat');
  wrapConstructor('MatVector');

  return {
    live: () => [...seen].filter((m) => !m.isDeleted()).length,
    total: () => seen.size,
    restore() {
      for (const undo of restores.reverse()) undo();
    },
  };
}
