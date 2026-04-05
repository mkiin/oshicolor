/** UI 5色 */
type UiColors = {
  navigation: string;
  attention: string;
  frame: string;
  search_bg: string;
  pmenu_sel_bg: string;
};

/** assignUiRoles の戻り値 */
type UiRoleAssignment = {
  navigationHex: string;
  attentionIdx: number;
  attentionOverride?: string;
};

export type { UiColors, UiRoleAssignment };
