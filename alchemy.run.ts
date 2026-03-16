import alchemy from "alchemy";
import { TanStackStart } from "alchemy/cloudflare";
import { CloudflareStateStore } from "alchemy/state";

const app = await alchemy("oshicolor", {
    // CI 環境ではリモートの State Store を使用する。ローカルは .alchemy/ ファイルにフォールバック
    stateStore: process.env.CI
        ? (scope) => new CloudflareStateStore(scope)
        : undefined,
});

export const worker = await TanStackStart("website", {
    build: { command: "vp build" },
});

console.log({
    url: worker.url,
});

await app.finalize();
