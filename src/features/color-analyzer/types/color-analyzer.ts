import type { VisionResult } from "@/features/palette-generator";
import type { StandardSchemaV1 } from "@t3-oss/env-core";

/** adapter に注入する設定 */
type AnalyzerConfig = {
  model: string;
  prompt: string;
  schema: StandardSchemaV1;
};

/** color-analyzer の Gateway インターフェース (Port) */
interface ColorAnalyzerGateway {
  analyze(
    imageBase64: string,
    mimeType: string,
    config: AnalyzerConfig,
  ): Promise<VisionResult>;
}

export type { AnalyzerConfig, ColorAnalyzerGateway };
