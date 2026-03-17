# mise コマンド 用途別マッピング

こういうときにこれを使う、という逆引きリファレンス。

---

## ツール管理（インストール・バージョン切り替え）

| シーン | コマンド |
|--------|----------|
| Node.js 24 をインストールして使いたい | `mise use node@24` |
| このプロジェクトだけ Node.js を固定したい | `mise use --pin node@24`（`mise.toml` に書き込む） |
| グローバルデフォルトを変えたい | `mise use -g node@24` |
| ツール一覧を確認したい | `mise ls` |
| インストール済みの全バージョンを確認したい | `mise ls node` |
| 最新版を確認したい（インストールはしない） | `mise ls-remote node` |
| mise.toml に書いたツールをまとめてインストール | `mise install` |
| 使われていない古いバージョンを削除したい | `mise prune` |

---

## 環境変数・シェル統合

| シーン | コマンド |
|--------|----------|
| 現在のディレクトリで有効な env を確認したい | `mise env` |
| 特定ツールのパスを確認したい | `mise which node` |
| mise が今どのツールを有効化しているか一覧確認 | `mise doctor` |
| シェルに mise を初期化させる設定を出力したい | `mise activate zsh` / `mise activate bash` |
| 一時的に別バージョンでコマンドを実行したい | `mise exec node@20 -- node -v` |
| mise 経由で環境変数を含めてコマンドを実行したい | `mise run <task>` または `mise exec -- <cmd>` |

---

## mise タスク（task runner）

| シーン | コマンド |
|--------|----------|
| mise.toml に書いたタスクを実行したい | `mise run <task名>` |
| 定義済みタスク一覧を確認したい | `mise tasks` |
| タスクを watch モードで実行したい | `mise run <task> --watch` |
| 複数タスクを並列で実行したい | `mise run task1 task2` |

---

## プロジェクト設定（mise.toml）

| シーン | コマンド / 操作 |
|--------|----------------|
| 現在の設定ファイルを確認したい | `mise config` |
| mise.toml を直接開いて編集したい | `$EDITOR mise.toml` |
| プロジェクト用の mise.toml を新規作成したい | `mise init`（存在しなければ生成） |
| 現在適用中の設定ソースを確認したい | `mise config ls` |

---

## トラブルシューティング

| シーン | コマンド |
|--------|----------|
| PATH / ツールの状態がおかしい | `mise doctor` |
| シェルで `node` が古いバージョンを指している | `mise reshim` → `which node` で確認 |
| shim が壊れている可能性がある | `mise reshim` |
| mise 自体を最新にしたい | `mise self-update` |

---

## バックエンドプラグイン

| シーン | コマンド |
|--------|----------|
| rust を mise で管理したい | `mise use rust@stable` |
| aqua/asdf プラグインのツールを追加したい | `mise use aqua:<tool>` / `mise plugins add <name>` |
| プラグイン一覧を確認したい | `mise plugins ls` |
| プラグインを削除したい | `mise plugins rm <name>` |

---

## vp（vite-plus）との分担整理

| 担当 | ツール |
|------|--------|
| Node.js バージョン管理 | vp（`vp env use node@<ver>`） |
| pnpm バージョン管理 | vp（`package.json` の `packageManager` で自動管理） |
| Rust / Go / CLI ツール群 | mise（`mise use rust@stable` 等） |
| bun | mise（vp は bun 非対応） |
| 環境変数・タスク runner（非 JS） | mise |

---

## よく使うワンライナー早見表

```bash
# 現在の Node を確認
mise which node

# mise.toml に書いたツールをまとめて入れる
mise install

# このプロジェクトで Node 22 を使う（mise.toml に記録）
mise use --pin node@22

# mise の診断
mise doctor

# mise 管理の Node で直接コマンド実行
mise exec -- node -e "console.log(process.version)"
```
