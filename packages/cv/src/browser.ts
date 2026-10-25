// Browser and worker only: loads opencv.js from a static asset. The script is emitted as a file
// (`new URL(..., import.meta.url)`) and evaluated here rather than bundled: bundlers can't resolve
// its Node-only branches, and a 10MB script doesn't belong in a chunk. It takes the CommonJS path
// of its UMD wrapper and exports a promise of the ready module.
import { isOpenCvLoaded, setOpenCvLoader } from './pipeline/opencv';

const OPENCV_URL = new URL('@techstark/opencv-js/dist/opencv.js', import.meta.url);

let configured = false;

/** Makes the pipeline load opencv.js from the static asset when it first needs it. */
export function installBrowserOpenCv(): void {
  if (!configured && !isOpenCvLoaded()) {
    setOpenCvLoader(async () => {
      const response = await fetch(OPENCV_URL);
      if (!response.ok) throw new Error(`opencv.js failed to load: ${response.status}`);
      const source = await response.text();
      const commonJs: { exports: unknown } = { exports: {} };
      // eslint-disable-next-line @typescript-eslint/no-implied-eval -- our own pinned opencv.js build
      const run = new Function('module', 'exports', source) as (m: object, e: unknown) => void;
      run(commonJs, commonJs.exports);
      return commonJs.exports;
    });
    configured = true;
  }
}
