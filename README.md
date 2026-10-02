# Fujifilm Lens Database

以 Astro 與 TypeScript 建置的 Fujifilm 原廠 XF、XC、GF 鏡頭靜態資料庫。

## 功能

- 焦段地圖：以 35mm 等效焦距（X ×1.5、GFX ×0.79）、對數刻度呈現全系列焦段涵蓋。
- 搜尋與篩選：系統、系列、類型、焦段預設與等效焦距範圍、最大光圈、重量上限、鏡頭功能；條件同步至網址，可直接分享。
- 清單 / 表格兩種檢視，表格欄位可點擊排序；可切換顯示等效焦距。
- 鏡頭比較：最多 4 支並排比較並標示最佳值（`/compare/?ids=...`），比較清單存於瀏覽器。
- 鏡頭詳細頁：重點規格、系統焦段位置、功能說明、相近焦段鏡頭與上一支 / 下一支。
- 淺色 / 深色模式。

## 本機開發

```sh
pnpm install
pnpm dev
```

## 驗證與建置

```sh
pnpm run validate:data
pnpm run check
pnpm run build
```

推送至 `master` 後，GitHub Actions 會發布至 [GitHub Pages](https://kiras0518.github.io/fujilens/)。
