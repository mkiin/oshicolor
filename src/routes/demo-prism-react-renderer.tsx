import { createFileRoute } from "@tanstack/react-router";
import { Highlight, themes } from "prism-react-renderer";

const codeBlock = `
const GroceryItem: React.FC<GroceryItemProps> = ({ item } ) => {
 return (
    <div>hello</div>
)
}
`;

const DemoCodeCompoent = () => {
    return (
        <Highlight
            theme={themes.shadesOfPurple}
            code={codeBlock}
            language="tsx"
        >
            {({ style, tokens, getLineProps, getTokenProps }) => (
                <pre style={style}>
                    {tokens.map((line, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: トークンには安定したIDがないためインデックスを使用する
                        <div key={i} {...getLineProps({ line })}>
                            <span>{i + 1}</span>
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

export const Route = createFileRoute("/demo-prism-react-renderer")({
    component: DemoCodeCompoent,
});
