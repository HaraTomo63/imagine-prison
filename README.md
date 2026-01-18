# Imagine Prison Terminal

仮想空間型中央刑務所『イマジンプリズン』の端末UI。
仕様書は `SPEC.html` を参照。

## ファイル構成
```text
index.html
SPEC.html
assets/
  css/style.css
  js/app.js
  data/game-data.json
```

## 使い方（ローカル）
- `index.html` をブラウザで開くだけです。

## JSON編集（行動/ステータス）
- `assets/data/game-data.json` を編集してください。
- GM画面は Identity=GM / Action=9999 で起動します。

## GitHub Pages 公開手順
### アップロードするファイル/フォルダ
- `index.html`
- `SPEC.html`
- `assets/`（`css/`, `js/`, `data/`）
- `README.md`（任意）
### 手順
1. GitHubで新規リポジトリを作成。
2. 上記のファイル/フォルダをリポジトリ直下に配置。
3. GitHubのSettings → Pagesで、Sourceをmainブランチの/(root)に設定。
4. 表示されたURLにアクセスして動作確認。
