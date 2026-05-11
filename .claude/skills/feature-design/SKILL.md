---
name: feature-design
description: >
  新規 feature 追加、既存 feature の拡張、refactor / bug / chore / infra 系の作業など、
  複数ファイルにまたがる、または設計判断を要するすべてのタスクに着手する前に使う。
  対話で要件と作業手順を明確化し、issue の `実装方針` を埋める。
  仕様変更を伴う場合は `docs/features/<feature>/spec.md` も書く。
  typo / 表記揺れ / 単一ファイルに閉じる trivial 変更には使わない。
argument-hint: <issue-number-or-feature?>
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, TaskCreate, TaskUpdate
---

# feature-design

アイデアを対話で設計に落とし込み、issue の `実装方針` と（必要なら）`docs/features/<feature>/spec.md` として確定させる。
oshicolor のフローでは「issue → 設計（このskill）→ 実装 → spec-write による現状追従」の中段を担う。

<HARD-GATE>
複数ファイルにまたがる作業、または設計判断を要する作業の実装に入る前は、必ず対話で設計を提示しユーザーの承認を得てから次に進むこと。trivial な bug fix、typo 修正、単一ファイル内に閉じる変更には適用しない。
</HARD-GATE>

## このskillの位置づけ

```
create-issue                feature-design                                    spec-write
docs/issue/                 docs/features/<feature>/spec.md (WHAT)            spec.md を現状追従
                        +   docs/issue/current/<NNN>-*.md 実装方針 (HOW)
```

`/spec-write` との分担:

- **このskill**: 実装前。対話で「何を作るか」を決め、初版 spec.md と issue の実装方針を書く
- **`/spec-write`**: 実装後。コードの現状から spec.md を update する

## 成果物の WHAT / HOW 分担

このskillは最大 2 つの成果物を出す。役割は直交させ、同じ情報は書かない:

| 成果物 | 役割 | 寿命 | 含めるもの | いつ書くか |
|--------|------|------|------------|------------|
| `docs/features/<feature>/spec.md` | **WHAT**（feature 仕様） | 恒久 | 概要、入出力、アルゴリズム / 処理フロー、主要な型・定数、依存 | 仕様変更を伴うときだけ |
| `docs/issue/current/<NNN>-*.md` の `実装方針` | **HOW**（このタスクの作業手順） | この issue が done になるまで | 設計アプローチ、触るファイル、構造・命名・責務分離、使用ライブラリ、テスト戦略 | 必ず |

判断軸: 「feature が完成した後も残しておきたい情報」は spec.md。「このタスクで手を動かすための道しるべ」は issue。

## 適用範囲と spec.md の要否

issue の labels と性質によって 3 段階に分かれる。

### A. このskillを使わない（bypass）

- typo / 表記揺れ / コメント修正
- formatting / linting 自動修正
- 単一ファイル内に閉じる trivial 変更
- パッケージの patch / minor アップデート

→ そのまま実装に入る。

### B. このskillを使うが spec.md は書かない（HOW のみ）

issue 実装方針だけ埋めるパターン。spec.md は触らない。

- **bug**: 既存仕様に従った修正、回帰修正
- **refactor**: 既存仕様内の内部構造変更
- **chore**: 依存大規模アップデート、リネーム整理、設定ファイル整備
- **infra**: CI/CD、deployment、IaC（Alchemy）、Cloudflare 設定（D1 / R2 / KV）、env や secret の整備
- **task**: その他の作業で複数ファイルを触るもの
- **feature**（小規模拡張）: 既存 spec.md と矛盾しない範囲の追加

### C. このskillを使い spec.md も書く（WHAT + HOW）

- 新規 feature 追加（`src/features/<feature>/` を新設）
- 既存 feature の仕様変更（spec.md にセクション追加 or 書き換え）
- 複数 feature にまたがる新機能
- 新しい型・store・usecase・component が増えてデータフローが変わる変更
- 既存 spec.md と矛盾する変更

判定に迷ったら B から始める。対話を進めて「これは spec を変える話だ」と分かったら C に切り替える。逆は手戻りが少ない。

## チェックリスト

各項目を TaskCreate で登録し、順番に消化する:

1. **コンテキスト探索 + issue 確認/作成** — 関連情報を読み、該当 issue を `current/` に揃える
2. **タイプ判定** — A / B / C のどれか（適用範囲の節を参照）。A なら離脱
3. **スコープ判定** — 新規 feature か、既存拡張か、複数 feature にまたがるか
4. **質問は 1 問ずつ** — 目的・制約・成功基準。multiple choice 優先
5. **2〜3 案を比較提示** — トレードオフと推奨案を理由付きで
6. **設計をセクション単位で提示** — 各セクションごとに承認を取り進める
7. **spec.md を書き出す（WHAT）** — C のときのみ。`docs/features/<feature>/spec.md`
8. **issue の実装方針を埋める（HOW）** — `docs/issue/current/<NNN>-*.md` の `実装方針` セクション
9. **self-review** — 書いた成果物を placeholder / 矛盾 / scope / 曖昧さの 4 観点で inline 修正
10. **ユーザーレビュー** — 成果物を確認してもらう
11. **受け渡し** — 承認後は成果物の場所、次の手順を報告して終了

## プロセス

### Step 1: 探索 + issue 確認/作成

設計に入る前に必ず:

- `docs/issue/current/` を `ls` し、該当 issue を Read する
- issue の frontmatter `feature` から対応 feature 名を取る
- `docs/features/<feature>/spec.md` と `review.md` を読む（存在すれば）
- `src/features/<feature>/` の構成と既存パターンを確認する
- 最近の commit で関連変更がないか確認する

該当 issue の状態によって分岐:

| issue の状態 | アクション |
|--------------|------------|
| `current/` にある | そのまま続行 |
| `open/` か `idea/` にある | `current/` に mv して続行 |
| 存在しない | `/create-issue` で `current/` に新規作成。`実装方針` は空のまま、後の Step 8 で埋める |

「issue を先に作って後で spec を詰める」パターンは「`current/` にある」分岐そのもの。create-issue で WHAT / WHY / 完了条件まで書いた issue が既にある状態で、このskillが発火して spec.md と 実装方針を埋める。

複数の独立 subsystem に見える依頼（例「認証・課金・通知を一気に作る」）は最初に指摘し、サブ feature に分解する。分解後、最初の 1 つだけを対象にこのプロセスを進める。

### Step 2: タイプ判定

issue の labels と性質から A / B / C のどれかを宣言する（適用範囲の節を参照）:

- **A**: trivial。このskillから離脱し、そのまま実装に入る
- **B**: bug / refactor / chore / infra / task / 小規模 feature 拡張。issue 実装方針だけ書く
- **C**: 新規 feature / 仕様変更 / 複数 feature にまたがる新機能。spec.md も書く

判定結果を 1 行で宣言する（例: 「タイプ B: cloudflare secret 整備の infra タスク。spec.md は書かない」）。判定に迷ったら B から始めて、対話の中で C に切り替えてよい。

### Step 3: スコープ判定

判定軸:

- **新規 feature か** — `src/features/<feature>/` が存在しない場合
- **既存 feature の拡張か** — 既存 spec.md にセクション追加 or 既存セクションの書き換え
- **shared / core への影響があるか** — feature 間の境界を超える変更はリスクが高い

判定結果を 1 行で宣言してから質問フェーズに進む（例: 「既存 color-extract feature の拡張、shared 影響なし」）。タイプ B のときは「feature を特定できない / 該当しない」と宣言してよい。

### Step 4: 質問

- 1 メッセージ 1 問
- 目的 → 制約 → 成功基準 の順で深掘り
- multiple choice を優先する。open-ended は最小限
- oshicolor の規約（feature-based 構成、import 方向、TanStack Query / Jotai の役割分担、URL state は search params、usecases は React 非依存、Cloudflare Workers / D1 / R2 制約）に反する選択肢は事前に弾く

### Step 5: 2〜3 案の比較

1 案しかないと感じても、対案を捻り出す。

- 各案にトレードオフを書く
- 推奨案を明示し、理由を述べる
- 既存 feature との一貫性を判断軸に入れる

### Step 6: 設計のセクション単位提示

最低限カバーするべき項目（複雑さに応じてスケール）:

- **architecture**: feature の責任範囲、shared / core / 他 feature との境界
- **構成要素**: components / hooks / usecases / repositories / stores の分担
- **データフロー**: server state（TanStack Query）/ client state（Jotai）/ URL state（search params）の使い分け
- **エラーハンドリング**: 失敗パスとユーザー提示
- **テスト方針**: usecase の単体テストを最優先する設計か

各セクションごとに「ここまで合っていますか」を確認し、合意を取って前進する。矛盾が見つかれば前のセクションに戻って直す。

### Step 7: spec.md の書き出し（WHAT）

タイプ C のときだけ実行する。B のときはスキップして Step 8 に進む。

保存先: `docs/features/<feature>/spec.md`

- 新規 feature ならディレクトリも作る
- 既存 spec.md を差し替える場合は事前に diff を提示し承認を取る
- テンプレ `.claude/templates/spec.md` の構造を踏襲（frontmatter / 概要 / 入出力 / アルゴリズム / 主要な型・定数 / 依存）
- UI 系 feature は「アルゴリズム / 処理フロー」セクションを省略してよい
- 文体は `/write-sentence` のルール（体言止め禁止、見出しに丸カッコ禁止、章冒頭で主張宣言、WHY 明記）
- `last-updated` は今日、`status` は実装前なので `planned`
- 「過去の検討経緯」は書かない。git に任せる
- このタスク固有の HOW 情報（触るファイル、テスト戦略など）は書かない。それは Step 8 で issue に書く

### Step 8: issue の実装方針を埋める（HOW）

対象: `docs/issue/current/<NNN>-*.md` の `実装方針` セクション

埋める小節（テンプレ `.claude/templates/issue.md` 参照）:

- **設計アプローチ**: spec.md の仕様をどう実装に落とすかを 3〜5 行で
- **触るファイル**: 新規作成・編集パスを列挙
- **構造・命名・責務分離**: 主要な変数・関数・型の命名、責務境界
- **使用ライブラリ**: 既存活用範囲、新規追加の理由
- **テスト戦略**: ハッピーパスとエッジケース、モック対象

制約:

- WHAT（feature 仕様、API、型、アルゴリズム）は書かない。それは spec.md にある
- 該当しない小節は「該当なし」と書く
- 小粒な issue では各 1〜2 行で十分
- frontmatter `branch:` も併せて提案する（命名は `<labels[0]>/<番号>-<title-kebab>`）

### Step 9: Self-Review

書いた成果物（タイプ C なら spec.md と issue 両方、B なら issue のみ）を 4 観点で読み直し、見つけたら inline で直す:

1. **Placeholder**: TBD / TODO / 空欄 / 曖昧な記述
2. **Consistency**: spec と issue の間で矛盾していないか、WHAT / HOW の領域が混在していないか（タイプ C のみ）
3. **Scope**: 単一の実装に収まる粒度か、分割すべきか
4. **Ambiguity**: 二通り以上に解釈できる記述はないか

直したら再 review はせず先に進む。複雑な spec では `Task` で subagent を起動して独立レビューさせる選択肢もある（プロンプトは `spec-reviewer-prompt.md` 参照）。

### Step 10: ユーザーレビュー

書き終えたら必ず止めてユーザーに渡す:

- タイプ C: 「spec.md を `<spec-path>` に、issue の実装方針を `<issue-path>` に書きました。」
- タイプ B: 「issue の実装方針を `<issue-path>` に書きました。」

承認が出るまで待つ。変更要求があれば修正し、self-review を再実行する。

### Step 11: 受け渡し

ユーザー承認が出たら:

- 書いた成果物のパスを再掲する（タイプ C なら spec.md と issue、B なら issue のみ）
- issue の frontmatter `branch:` が埋まっているか確認する
- 次の手順を 1 行で提示する（例: `git switch -c <branch>` や TDD なら `/unit-test`）
- このskillの責任はここで終わり。実装は通常フローへ引き継ぐ

## 原則

- **1 問ずつ** — overwhelm しない
- **multiple choice 優先** — 回答コストを最小化する
- **YAGNI を ruthless に** — 要求にない機能を勝手に足さない
- **代替案を必ず探る** — 1 案押し付けは避ける
- **段階的承認** — セクションごとに合意を取り、後戻りを早期化する
- **柔軟に戻る** — 矛盾を見つけたら前のセクションに戻る
- **既存規約を尊重** — CLAUDE.md と既存 spec.md を必ず参照する
- **isolation and clarity** — 各単位について「何をする / どう使う / 何に依存する」が答えられること

## Anti-Pattern

- 「simple すぎて設計不要」と言って実装に直行する
- 1 メッセージに複数の質問を詰める
- 既存 feature の規約を無視して新案を出す
- 設計レビューなしで spec.md を書いて即実装に移る
- 関係ない refactor を設計に紛れ込ませる
- spec.md の保存先を勝手に変える
