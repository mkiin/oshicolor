import type { VisionResult } from "../types/vision-result";

import { atom } from "jotai";

export const visionResultAtom = atom<VisionResult | null>(null);
