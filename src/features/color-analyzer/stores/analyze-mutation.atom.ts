import { fileToBase64, fileMimeType } from "@/shared/lib/utils";
import { atomWithMutation } from "jotai-tanstack-query";

import { analyzeColor } from "../repositories/analyze-color.functions";

export const analyzeColorMutationAtom = atomWithMutation(() => ({
  mutationKey: ["analyzeColor"],
  mutationFn: async (file: File) => {
    const imageBase64 = await fileToBase64(file);
    const mimeType = fileMimeType(file);
    return analyzeColor({ data: { imageBase64, mimeType } });
  },
}));
