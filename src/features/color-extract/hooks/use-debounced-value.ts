import { useEffect, useState } from "react";

// 値の変化が落ち着くまで反映を遅らせる。slider の連続変化で抽出を走らせ過ぎないために使う。
export const useDebouncedValue = <T>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
};
