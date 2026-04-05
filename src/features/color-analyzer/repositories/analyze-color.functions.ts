/**
 * Server Function: 画像から色を分析する
 *
 * クライアントから呼び出し可能。実行はサーバー側で行われる。
 * サーバー専用ロジック (env, adapter) は analyze-color.server.ts に分離。
 */

import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";

import { analyzeWithAi } from "./analyze-color.server";

const AnalyzeColorInput = v.object({
  imageBase64: v.pipe(v.string(), v.minLength(1)),
  mimeType: v.pipe(v.string(), v.minLength(1)),
});

type AnalyzeColorData = v.InferOutput<typeof AnalyzeColorInput>;

export const analyzeColor = createServerFn({ method: "POST" })
  .inputValidator((data: AnalyzeColorData) => v.parse(AnalyzeColorInput, data))
  .handler(async ({ data }) => {
    return analyzeWithAi(data.imageBase64, data.mimeType);
  });
