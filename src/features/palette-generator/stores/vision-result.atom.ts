import type { VisionResult } from "../types/vision-result";

import { atom } from "jotai";
import { unwrap } from "jotai/utils";

const pendingAnalysis = atom<Promise<VisionResult> | null>(null);

/** AI 分析結果（write: Promise セット / read: resolved 値、Suspense 対応） */
export const AsyncVisionResultAtom = atom(
  async (get) => {
    const promise = get(pendingAnalysis);
    if (!promise) return null;
    return promise;
  },
  (_get, set, promise: Promise<VisionResult>) => {
    set(pendingAnalysis, promise);
  },
);

export const visionResultAtom = unwrap(
  AsyncVisionResultAtom,
  (prev) => prev ?? null,
);
