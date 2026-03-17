# vite-plus パッケージマネージャ管理の仕組みと mise との共存

調査対象: `sample-repo/ts-echo-lib/vite-plus`（voidzero-dev/vite-plus リポジトリ）

---

## 概要

vite-plus は「The Unified Toolchain for the Web」として、Node.js バージョン管理・パッケージマネージャ管理・ビルド・テスト・リントを統合した CLI ツール（`vp` コマンド）。インストール先は `~/.vite-plus/`。

---

## インストール構造

```
~/.vite-plus/
├── bin/
│   ├── vp          → ../current/bin/vp  (symlink)
│   ├── node        → ../current/bin/vp  (shimシンボリックリンク)
│   ├── npm         → ../current/bin/vp  (shimシンボリックリンク)
│   ├── npx         → ../current/bin/vp  (shimシンボリックリンク)
│   └── vpx         → ../current/bin/vp  (shimシンボリックリンク)
├── current         → 0.1.11  (symlink)
├── 0.1.11/         ← バージョン別ディレクトリ
│   ├── bin/vp      (Rustバイナリ)
│   ├── node_modules/  (vite-plusとその依存関係)
│   ├── package.json
│   └── pnpm-lock.yaml
├── js_runtime/
│   └── node/
│       └── 24.14.0/   ← vite-plusが管理するNode.jsバイナリ
├── package_manager/
│   └── pnpm/
│       └── 10.32.1/   ← vite-plusが管理するpnpmバイナリ
├── env             (bash/zsh用のPATH設定スクリプト)
├── env.fish        (fish用)
└── env.ps1         (PowerShell用)
```

---

## パッケージマネージャ管理の仕組み

### 1. 検出ロジック

`vp install` 実行時、Rust製のコア (`vite_install/src/package_manager.rs`) が以下の優先順で使用するパッケージマネージャを自動判定する。

| 優先順 | 判定条件 |
|--------|----------|
| 1 | `package.json` の `packageManager` フィールド（例: `"pnpm@10.28.0"`） |
| 2 | `pnpm-workspace.yaml` の存在 |
| 3 | `pnpm-lock.yaml` の存在 |
| 4 | `yarn.lock` / `.yarnrc.yml` の存在 |
| 5 | `package-lock.json` の存在 |
| 6 | `.pnpmfile.cjs` / `pnpmfile.cjs` の存在 |
| 7 | `yarn.config.cjs` の存在 |
| 8 | ユーザーに選択プロンプト |

### 2. バイナリの実態（インストール先）

vite-plus は検出したパッケージマネージャを **npm レジストリから独自にダウンロード・展開** して、`~/.vite-plus/package_manager/` 以下に保存する。

```
~/.vite-plus/package_manager/pnpm/10.32.1/pnpm/bin/
├── pnpm      (shシム)
├── pnpm.cmd  (Windowsシム)
├── pnpm.ps1  (PowerShellシム)
├── pnpx      (shシム)
├── pnpx.cmd
└── pnpx.ps1
```

実際の pnpm の JS ファイル群（`package.js`, CLI本体など）もここに展開される。システムの `pnpm` とは完全に独立した実体。

### 3. shim の仕組み（node/npm/npx）

Unix では `~/.vite-plus/bin/node` 等が `vp` バイナリへのシンボリックリンクになっており、**argv[0]（コマンド名）** によって vp が自身の役割を判断する。これは Volta と同じパターン。

Windows では `.cmd` ラッパーが `vp env exec <tool>` を呼び出す形式。

---

## Node.js 管理の仕組み

`vp env` サブコマンドで Node.js バージョンを管理する。

### バージョン解決の優先順

1. 環境変数 `VITE_PLUS_NODE_VERSION`（セッション一時オーバーライド）
2. セッションファイル（`vp env use` で書き込まれる）
3. `.node-version` ファイル
4. `package.json` の `engines.node` / `devEngines.runtime`

### バイナリの保存場所

```
~/.vite-plus/js_runtime/node/<バージョン>/
```

例: `~/.vite-plus/js_runtime/node/24.14.0/bin/node`

---

## mise との共存可能性

### 結論: **限定的に共存可能だが、注意が必要**

### 共存できる部分

- **mise が Node.js を管理し、vp でパッケージマネージャだけ使う**: `vp env` を使わず、`vp install` のみ使う場合は原理的に競合しない
- **vp の Node.js 管理を完全に無効化**: `vp env off` でシム（`node`, `npm`, `npx`）を無効化できる

### 競合リスクがある部分

1. **PATH の優先順位**

   vite-plus は `~/.vite-plus/bin` を PATH の**先頭**に挿入する（`env` ファイルを source した場合）。ここに `node`, `npm`, `npx` のシムが置かれるため、mise が管理する Node.js より vite-plus のシムが優先されてしまう。

2. **`vp env doctor` での警告**

   `doctor.rs` に `KNOWN_VERSION_MANAGERS` として mise が登録されており、`MISE_DIR` 環境変数が設定されていると「Conflicts」セクションに警告が出る:

   ```rust
   const KNOWN_VERSION_MANAGERS: &[(&str, &str)] = &[
       ("nvm", "NVM_DIR"),
       ("fnm", "FNM_DIR"),
       ("volta", "VOLTA_HOME"),
       ("asdf", "ASDF_DIR"),
       ("mise", "MISE_DIR"),  // ← mise は競合として認識される
       ("n", "N_PREFIX"),
   ];
   ```

3. **Node.js バージョンの二重管理**

   インストール時スクリプト（`install.sh`）がインタラクティブモードで「Would you want Vite+ to manage Node.js versions?」と聞いてくる。誤って Yes にすると、mise と vp が両方 node shim を持つ状態になる。

### mise との共存方法

**推奨構成**: vp の Node.js 管理機能を無効にし、パッケージマネージャ管理のみを使う

```bash
# vp の node/npm/npx shim を無効化
vp env off

# または、インストール時に Node.js 管理を有効化しない（Nと回答）
```

`~/.vite-plus/env` を source する場合、`vp` のみ PATH に追加されていれば、`node`, `npm`, `npx` の shim は存在しないため mise の管理する Node.js が使われる。

**PATH の順序確認**:

```bash
# vp env doctor で状況確認
vp env doctor

# mise の node が先頭にいることを確認
which node
```

**`shim-mode` の設定**:

vite-plus には `system-first` モードがあり、システム（mise）の Node.js を優先させつつ、フォールバックで vp 管理のものを使う設定が可能（`vp config` で設定）。

---

## まとめ

| 機能 | vite-plus の実態 | mise との干渉 |
|------|-----------------|-------------|
| Node.js 管理 | `~/.vite-plus/js_runtime/node/` にバイナリを保存、shim 経由で提供 | 競合する（PATH優先度問題） |
| pnpm 管理 | `~/.vite-plus/package_manager/pnpm/` に実体を保存 | システムの pnpm とは独立 |
| vp コマンド自体 | `~/.vite-plus/bin/vp` | 干渉なし |

**mise.toml で Node.js を管理しているなら、`vp env off` で vite-plus の Node.js shim を無効化するのが最善策。** pnpm 管理は vite-plus 独自の領域（`~/.vite-plus/package_manager/`）なので mise とは独立して動作する。
