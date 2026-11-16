#!/usr/bin/env node
/**
 * Refresh the built-in CoinGecko fallback snapshot inside index.html.
 *   node scripts/update-snapshot.mjs --data data.json
 * data.json.charts = [d365, d90, d7] outputs of CoinGecko get-coin-market-chart ({startTs,endTs,prices}).
 */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const i=process.argv.indexOf('--data'); const d=JSON.parse(fs.readFileSync(process.argv[i+1],'utf8'));
const [d365,d90,d7]=d.charts||[]; if(!d365||!d90||!d7) { console.error('need charts [d365,d90,d7]'); process.exit(2); }
const pack=c=>({startTs:+c.startTs,endTs:+c.endTs,prices:c.prices.map(v=>Math.round(Array.isArray(v)?v[1]:v))});
const snap={d365:pack(d365),d90:pack(d90),d7:pack(d7),asOf:+d7.endTs};
const f=path.join(root,'index.html'); let s=fs.readFileSync(f,'utf8');
const re=/const CG_SNAPSHOT = \{.*?\};/s; if(!re.test(s)) { console.error('snapshot line not found'); process.exit(3); }
s=s.replace(re,'const CG_SNAPSHOT = '+JSON.stringify(snap)+';');
s=s.replace(/\/\/ CoinGecko get-coin-market-chart snapshot .*\n/, `// CoinGecko get-coin-market-chart snapshot (id=bitcoin; days=365/90/7), taken ${new Date(snap.asOf).toISOString().slice(0,10)} — fallback when the live API is unreachable\n`);
fs.writeFileSync(f,s); console.log('snapshot updated to',new Date(snap.asOf).toISOString());
