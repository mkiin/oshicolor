import type { VisionResult } from "../types/vision-result";

import { atom } from "jotai";

/** AI 分析結果（Suspense 対応: Promise セット時に suspend） */
export const visionResultAtom = atom<VisionResult | null | Promise<VisionResult>>(null);
