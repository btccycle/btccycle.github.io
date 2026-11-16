# BTC Cycle Tracker

Bitcoin halving-cycle analytics: overlays past cycles on the current one, measures price and time gaps, and projects the next top under three gap-adjusted scenarios. Korean (`#ko`) and English (`#en`) views.

- **Live data:** CoinGecko public API, called from the visitor's browser. Price every 15 minutes; daily UTC closes hourly. A new close re-runs the whole analysis.
- **Fallback:** a built-in CoinGecko snapshot (`CG_SNAPSHOT` in `index.html`) is used if the API is unreachable or rate-limited.
- **No build step:** a single static `index.html` (Chart.js from cdnjs, fonts from Google Fonts).

## Deploy (GitHub Pages)

1. Push this folder to a repository's `main` branch.
2. Repository **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `(root)`**.
3. The site is at `https://btccycle.github.io/`. Set that URL in the `og:url` meta tag and make the `og:image` / `twitter:image` URLs absolute so X shows the preview card.

## Daily X drafts

```bash
node scripts/update-snapshot.mjs --data data.json     # refresh the fallback snapshot
node scripts/draft-posts.mjs --data data.json --out out --site https://btccycle.github.io/ --og
```

`data.json` holds CoinGecko data:

```json
{ "price":  {"usd": 64964, "usd_24h_change": -0.97, "last_updated_at": 1794771080},
  "charts": [ {"startTs": 0, "endTs": 0, "prices": []}, "…days=90…", "…days=7…" ] }
```

`charts` are `get-coin-market-chart` outputs for `days` = 365, 90 and 7 (≤120 evenly spaced prices between `startTs` and `endTs`). `prices: [[ms, usd], …]` from `/coins/bitcoin/market_chart` also works.

Outputs: `drafts-YYYY-MM-DD.md` / `.json` (daily post, insight post and a 5-part thread, in Korean and English, with X-weighted lengths checked against 280) and `card-ko.png` / `card-en.png` (1200×675 post images). `--og` also rewrites `og-image.png`.

Requires Node 18+ and Playwright with Chrome or Chromium.

## Method

See **Methodology & formulas** at the bottom of the page. In short: daily closes are normalized as log multiples from a cycle anchor; similarity combines return correlation, level correlation, amplitude-scaled shape error and DTW; the forecast aligns the closest cycle by its time gap τ and scales its remaining path by a factor k (β, diminishing-returns trend, or the last cycle's multiple).

Historical-analog calculations, not investment advice. Price data by [CoinGecko](https://www.coingecko.com/en/api).
