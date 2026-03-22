export type NeovimColorTokens = {
  // bg 階層（neutral palette 対応）
  bg: string;
  bgPopup: string;
  bgSurface: string;
  bgCursorLine: string;
  bgVisual: string;

  // fg 階層
  fg: string;
  comment: string;
  lineNr: string;
  cursorLineNr: string;
  border: string;
  delimiter: string;

  // syntax（Vibrant seed 由来）
  keyword: string;
  fn: string;
  operator: string;
  string: string;
  type: string;
  constant: string;
  number: string;

  // UI（Muted seed 由来）
  accent: string;
  searchBg: string;
  pmenuSelBg: string;
};
