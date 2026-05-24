import type { Colors, ExtractConfig } from "../types/colors";

import { useQuery } from "@tanstack/react-query";

import { extractColors } from "../usecases/extract-colors";

// 画像と設定の組ごとに抽出結果をキャッシュする。設定を戻したときは即座に前の結果が出る。
export const useExtractColors = (image: File, config: ExtractConfig) => {
  const imageKey = `${image.name}:${image.size}:${image.lastModified}`;

  return useQuery<Colors>({
    queryKey: ["color-extract", imageKey, config],
    queryFn: () => extractColors(image, config),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 1000 * 60 * 10,
    retry: false,
  });
};
