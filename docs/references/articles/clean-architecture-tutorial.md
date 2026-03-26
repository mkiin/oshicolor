# Clean Architecture チュートリアル（参考記事要約）

原文: [【初心者完全版】1時間でクリーンアーキテクチャを理解するチュートリアル【TypeScript/Hono/Vitest/TDD】](https://qiita.com/Sicut_study/items/xxx) by @Sicut_study

## 核心メッセージ

- 「クリーンアーキテクチャ」というアーキテクチャは存在しない。あれは「Clean シリーズ」のブランド名
- 本の主張は **依存性逆転（Dependency Inversion）** をしようということ
- DDD の根本思想は「**ドメインを中心に置き、外部の変化から守る**」

## 依存性逆転とは

Switch にゲームカセットがハンダ付けされている状態 → カセットの差込口（インターフェース）を用意する。

```
ハンダ付け: ゲーム機 → ソフト（密結合）
差込口あり: ゲーム機 → 仕様書 ← ソフト（依存性逆転）
```

ソフトウェアでは「仕様書 = interface」。実装の詳細ではなく契約に依存させることで、外部を差し替え可能にする。

## ドメインとは

ソフトウェアが解決しようとしている **現実のビジネス領域そのもの**。

- 確定申告アプリなら「税金の計算ルール」がドメイン
- `価格 * 0.08` がコード中に散らばっていたら税率変更で全体が壊れる
- ドメインにルールを集約し、テストで守る

## レイヤー構成

| レイヤー | 責務 | 外部依存 |
|---------|------|---------|
| **Domain** | ビジネスルール（不変のコア） | なし |
| **UseCase** | ビジネスの流れ（シナリオ） | Domain のみ |
| **Port** | 契約書（interface のみ） | Domain の型のみ |
| **Gateway** | 外部データを Domain 型に翻訳 | Port + Driver |
| **Driver** | 外部世界との通信（API, DB） | 外部ライブラリ |
| **Handler** | リクエスト受付 + DI | UseCase + Gateway |

## 依存の方向

```
Handler → UseCase → Port ← Gateway → Driver
              ↓
           Domain（中心。何にも依存しない）
```

- `UseCase → Port`: UseCase は Port のメソッドを **呼ぶ**（依存する）
- `Port ← Gateway`: Gateway は Port を **実装する**（依存する）。**ここが依存性逆転**
- `Gateway → Driver`: Gateway は Driver を **使う**（依存する）

## テスト戦略

- **Domain**: 必ずテストを書く。プロダクトのコアなのでバグは致命的
- **UseCase**: モック（偽物の Gateway）を差し込んでテスト。外部 API に依存しない安定したテスト
- **Gateway/Driver**: テストの優先度は低い。外部の都合で壊れやすい
- **Handler**: curl や E2E で確認。フレームワーク依存なのでユニットテストのコスパが低い

## DI（依存性注入）の実装パターン

```typescript
// Port（契約書）
interface AIPort {
  ask(text: string): Promise<string>;
}

// Gateway（本物のカセット）
class ChatGPTGateway implements AIPort { ... }
class ClaudeGateway implements AIPort { ... }

// UseCase（カセットの差込口を持つ）
class SummaryUseCase {
  constructor(private readonly aiPort: AIPort) {}
  async execute(text: string) {
    return this.aiPort.ask(text);
  }
}

// Handler（どのカセットを差し込むか決める）
const gateway = new ChatGPTGateway();  // ← ここで差し替え可能
const useCase = new SummaryUseCase(gateway);
```

## 設計判断の指針

1. **ドメインは外部を知らない**: DB, API, UI フレームワークへの依存ゼロ
2. **Port で境界を切る**: UseCase と外部の間に interface を置く
3. **Gateway で翻訳する**: 外部の生データを Domain 型に変換。API の形が変わっても UseCase は影響を受けない
4. **Handler で DI する**: 本番は本物の Gateway、テストはモックを差し込む
5. **ドメインのテストを最優先**: プロダクトの価値の源泉を守る
