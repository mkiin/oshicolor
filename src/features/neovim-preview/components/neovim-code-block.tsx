import type React from "react";

import {
  codeAtom,
  colorTokensAtom,
  cursorLineAtom,
  languageAtom,
  prismThemeAtom,
} from "@/features/neovim-preview/neovim-preview.atoms";
import { useAtomValue } from "jotai";
import { Highlight } from "prism-react-renderer";

export const NeovimCodeBlock: React.FC = () => {
  const code = useAtomValue(codeAtom);
  const language = useAtomValue(languageAtom);
  const prismTheme = useAtomValue(prismThemeAtom);
  const { bg, bgCursorLine } = useAtomValue(colorTokensAtom);
  const cursorLine = useAtomValue(cursorLineAtom);

  return (
    <Highlight theme={prismTheme} code={code} language={language}>
      {({ tokens, getLineProps, getTokenProps }) => (
        <pre
          style={{
            backgroundColor: bg,
            margin: 0,
            padding: "0.5rem",
            overflow: "auto",
            fontFamily: "monospace",
            flex: 1,
          }}
        >
          {tokens.map((line, i) => {
            const lineNum = i + 1;
            const isCursor = lineNum === cursorLine;
            const lineProps = getLineProps({ line });
            return (
              <div
                // oxlint-disable-next-line react/no-array-index-key -- トークンには安定した ID がない
                key={i}
                {...lineProps}
                style={{
                  ...lineProps.style,
                  backgroundColor: isCursor ? bgCursorLine : "transparent",
                }}
              >
                {line.map((token, key) => (
                  // oxlint-disable-next-line react/no-array-index-key -- トークンには安定した ID がない
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            );
          })}
        </pre>
      )}
    </Highlight>
  );
};
