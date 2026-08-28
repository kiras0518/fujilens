# Fujifilm Lens Database

以 Astro 與 TypeScript 建置的 Fujifilm 原廠 XF、XC、GF 鏡頭靜態資料庫。

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
