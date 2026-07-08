# タバネル(TABANERU)プロジェクト引き継ぎ書

出張・訪問サービスの個人事業主向け「ひとり業務管理」無料Webアプリ。
オーナー(ユーザー)は非エンジニア。営業・マーケ・接客が得意。説明は専門用語を避け平易に。

## 役割プロトコル
- **フェイブル**(claude-fable-5): 戦略立案・意思決定の壁打ち
- **オーパス**(claude-opus-4-8): 機能開発・複雑な実装
- **サン**(claude-sonnet-5): 文言・投稿文・軽作業
- ユーザーが名前で呼んだらその役として振る舞う。返答は簡潔に。

## プロダクト構成
- `app/index.html` — アプリ本体(単一HTML・vanilla JS・バックエンドなし)
  - データは利用者端末のlocalStorage(キー `genba_note_v1` — **互換のため変更禁止**)
  - 機能: 予定/顧客/見積・請求・領収書/まとめ請求/LINEメッセージ生成/売上チャート/検索/バックアップ
- `lp/index.html` — 紹介LP(+ `lp/ogp.png` OGP画像)
- `telemetry/` — Cloudflare Worker(同意制の匿名利用統計。D1保存)
- ルートの `index.html` はProgate練習ページ(触らない)

## 本番URL
- LP: https://dbtg-mgn.github.io/lp/
- アプリ: https://dbtg-mgn.github.io/app/
- 統計受け皿: https://genbanote-telemetry.genbanote.workers.dev (Cloudflare / 更新には新規APIトークンが必要)
- アクセス計測: GoatCounter(サイトコード `genbanote`)
- ウェイティングリスト: https://forms.gle/GehKym1Afdf79RVx9 (Googleフォーム)

## 開発フロー
1. `git fetch origin main && git checkout -B claude/revenue-examples-k3to5g origin/main`(マージ済みなら作り直し)
2. 実装 → Playwright(グローバル導入済み・executablePath: /opt/pw-browsers/chromium-1194/chrome-linux/chrome)で検証
3. コミット→プッシュ→PR作成 → **ユーザーの「公開OK」を待ってから**マージ
4. GitHub Pagesのデプロイは稀に一時失敗する(mainへの空コミットで再実行)

## 絶対に守ること(ブランドの約束)
- 基本機能はずっと無料 / 広告なし / 登録不要 / 書類に透かしなし / 圏外でも動く
- 利用者の顧客情報・売上を運営側に送らない(計測は匿名の訪問数と同意制の統計のみ)
- **Xの自動DM・自動一括操作は絶対にしない**(規約違反・凍結リスク)
- 破壊的操作・外部公開・課金関連は必ずユーザーの承認を得る

## 戦略メモ
- POD: 「予定・顧客・請求の一体化(束ねる)」。書類作成専業(ジムー等)とは棚が違う
- 収益: Phase 0=無料で「週1利用者10人」→ ウェイティングリスト登録数で有料(クラウド同期・月480円想定)のニーズ検証 → Phase 2でCloudflare等へ引っ越して課金開始(GitHub Pagesは商用SaaS不可)
- X: @tabaneru_jp(公式)。投稿は予約投稿で半自動化。旧名ゲンバノートはGEMBA Note(MetaMoJi)と衝突するため改名済み

## 現在地(2026-07-07時点)
- 公開済み: アプリv0.5 / LP / 計測 / OGPカード / 改名
- PR #6(ウェイティングリスト導線)= ユーザーの「公開OK」待ち
- 次: 2週間分のX投稿文セット作成 → 最初の10人への布教
