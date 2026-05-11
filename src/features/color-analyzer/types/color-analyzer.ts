import type { VisionResult } from "@/features/palette-generator";

/** adapter に注入する設定 */
type AnalyzerConfig<TSchema = unknown> = {
  model: string;
  prompt: string;
  schema: TSchema;
};

/** color-analyzer の Gateway インターフェース (Port) */
interface ColorAnalyzerGateway<TSchema = unknown> {
  analyze(
    imageBase64: string,
    mimeType: string,
    config: AnalyzerConfig<TSchema>,
  ): Promise<VisionResult>;
}

export type { AnalyzerConfig, ColorAnalyzerGateway };
