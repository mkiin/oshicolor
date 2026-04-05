import type { ThemeMood } from "../types/palette";

import { atom } from "jotai";

export const moodAtom = atom<ThemeMood | null>(null);
