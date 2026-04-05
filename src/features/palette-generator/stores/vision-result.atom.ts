import type { VisionResult } from "../types/vision-result";

import { atom } from "jotai";

/** AI Vision の出力を保持する atom (mutation 成功時にセット) */
export const visionResultAtom = atom<VisionResult | null>(null);
