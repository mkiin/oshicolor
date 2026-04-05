/**
 * Google AI (Gemini) Adapter
 *
 * ColorAnalyzerGateway の実装。プロンプト・スキーマは注入される。
 * 将来 Claude や GPT-4V に差し替え可能。
 */

import type { ColorAnalyzerGateway } from "@/features/color-analyzer";
import type { VisionResult } from "@/features/palette-generator";

import { GoogleGenAI } from "@google/genai";
import { toJsonSchema } from "@valibot/to-json-schema";
import * as v from "valibot";

export const createGoogleAiAdapter = (
  apiKey: string,
): ColorAnalyzerGateway => ({
  analyze: async (imageBase64, mimeType, config) => {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: config.model,
      contents: [
        {
          role: "user",
          parts: [
            { text: config.prompt },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: toJsonSchema(
          config.schema as v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
        ),
      },
    });

    const text = response.text ?? "";
    return v.parse(
      config.schema as v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
      JSON.parse(text),
    ) as VisionResult;
  },
});
