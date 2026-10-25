// Node only (tests, `pnpm eval:cv`): loads opencv.js with `require`. The package has no Node
// types or imports, so `require` comes from `process.getBuiltinModule` (Node 22.3 and later).
import { isOpenCvLoaded, loadOpenCv, setOpenCvLoader, type OpenCv } from './pipeline/opencv';

type NodeProcess = {
  getBuiltinModule(id: 'node:module'): { createRequire(from: string): (id: string) => unknown };
};

let configured = false;

export function loadOpenCvInNode(): Promise<OpenCv> {
  if (!configured && !isOpenCvLoaded()) {
    const nodeProcess = (globalThis as { process?: NodeProcess }).process;
    if (!nodeProcess) throw new Error('loadOpenCvInNode runs only in Node');
    const require = nodeProcess.getBuiltinModule('node:module').createRequire(import.meta.url);
    setOpenCvLoader(() => Promise.resolve(require('@techstark/opencv-js')));
    configured = true;
  }
  return loadOpenCv();
}
