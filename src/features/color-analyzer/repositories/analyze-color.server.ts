/**
 * サーバー専用ロジック
 *
 * .functions.ts の handler 内からのみ呼ばれる。
 * API キー・adapter・config などサーバーに閉じるべきものをまとめる。
 */

import { env } from "@/core/config/env";
import { COLOR_ANALYZER_CONFIG } from "@/features/color-analyzer/usecases/config";
import { createGoogleAiAdapter } from "@/infrastructures/ai";

export const analyzeWithAi = async (imageBase64: string, mimeType: string) => {
  const gateway = createGoogleAiAdapter(env.GEMINI_API_KEY);
  return gateway.analyze(imageBase64, mimeType, COLOR_ANALYZER_CONFIG);
};
