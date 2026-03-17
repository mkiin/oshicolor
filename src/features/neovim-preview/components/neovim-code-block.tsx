import { useAtomValue } from "jotai";
import { Highlight } from "prism-react-renderer";
import type React from "react";
import {
  codeAtom,
  colorTokensAtom,
  languageAtom,
  prismThemeAtom,
} from "@/features/neovim-preview/stores/atoms";

export const NeovimCodeBlock: React.FC = () => {
  const code = useAtomValue(codeAtom);
  const language = useAtomValue(languageAtom);
  const prismTheme = useAtomValue(prismThemeAtom);
  const { bg } = useAtomValue(colorTokensAtom);

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
          }}
        >
          {tokens.map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: トークンには安定したIDがないためインデックスを使用する
            <div key={i} {...getLineProps({ line })}>
              {line.map((token, key) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: トークンには安定したIDがないためインデックスを使用する
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
};
