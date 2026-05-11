# spec reviewer プロンプトテンプレ

`feature-design` の Self-Review で複雑さを感じたら、`Task` ツールで general-purpose subagent を起動して独立レビューを依頼する。以下はそのプロンプトテンプレ。

**用途**: spec.md が実装計画として完成度に達しているかを独立視点で検証する。

**起動タイミング**: spec.md を書いた直後、ユーザーレビュー前。

```
Task tool (general-purpose):
  description: "Review feature spec"
  prompt: |
    あなたは spec.md のレビュアー。実装計画として完成しているかを検証する。

    **対象**: <SPEC_FILE_PATH>
    **参照**: oshicolor の CLAUDE.md と `.claude/templates/spec.md`

    ## チェック観点

    | 観点 | 確認内容 |
    |------|---------|
    | Completeness | TODO / TBD / placeholder / 空欄 / 曖昧記述 |
    | Consistency | セクション間の矛盾、architecture と機能記述の整合 |
    | Clarity | 二通り以上に解釈できて実装者が誤読する可能性 |
    | Scope | 単一の実装で完結する粒度か、分割すべきか |
    | YAGNI | 要求外の機能 / 過剰な抽象 |
    | 規約整合 | feature-based 構成、import 方向、状態管理ルール、命名規則と矛盾しないか |

    ## 判定基準

    実装計画として致命的な穴があるときだけ Issues として挙げる。
    軽微な言い回しの好み、セクションの詳細度のばらつきなどは挙げない。

    重大な欠陥がなければ Approved とする。

    ## 出力フォーマット

    ## Spec Review

    **Status**: Approved | Issues Found

    **Issues**:
    - [section名]: [具体的な問題] — [実装計画への影響]

    **Recommendations** (任意、ブロックしない):
    - [改善提案]
```

**返却値**: Status、Issues（あれば）、Recommendations。これを元にユーザーレビュー前の最終調整を行う。
