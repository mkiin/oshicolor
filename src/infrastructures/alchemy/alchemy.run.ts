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
  build: { command: "vite build" },
  bindings: {
    GEMINI_API_KEY: process.env.ALCHEMY_PASSWORD
      ? alchemy.secret(process.env.GEMINI_API_KEY)
      : (process.env.GEMINI_API_KEY ?? ""),
  },
});

// oxlint-disable-next-line no-console -- デプロイ URL の出力
console.log({
  url: worker.url,
});

await app.finalize();
