#!/usr/bin/env node
/**
 * Merge daily UTC closes into index.html (const CG_CLOSES).
 *   node scripts/add-closes.mjs --data data.json
 * data.json.charts: CoinGecko get-coin-market-chart outputs ({startTs, endTs, prices:[...]}), e.g. days "7".
 * Each 00:00 UTC point (within 45 min) becomes the previous UTC day's close.
 */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'), DAY=864e5;
const i=process.argv.indexOf('--data'); const d=JSON.parse(fs.readFileSync(process.argv[i+1],'utf8'));
const add=[];
for(const c of d.charts||[]){
  const P=c.prices||[], n=P.length; if(n<2) continue; const st=+c.startTs, en=+c.endTs, step=(en-st)/(n-1);
  P.forEach((p,k)=>{ const pair=Array.isArray(p), ts=pair?+p[0]:st+k*step, v=pair?+p[1]:+p; const m=Math.round(ts/DAY);
    if(v>0 && m*DAY<=Date.now() && Math.abs(ts-m*DAY)<=45*60e3) add.push([m-1,Math.round(v*100)/100,Math.abs(ts-m*DAY)]); });
}
const f=path.join(root,'index.html'); let s=fs.readFileSync(f,'utf8');
const re=/const CG_CLOSES = (\[.*?\]);/s; const cur=JSON.parse(s.match(re)[1]);
// keep the best (closest-to-midnight) point per day; a stored close is replaced only by a point within 20 min of 00:00 UTC
const best=new Map(); for(const [day,v,e] of add){ const b=best.get(day); if(!b||e<b[1]) best.set(day,[v,e]); }
const map=new Map(cur.map(([day,v])=>[day,v]));
for(const [day,[v,e]] of best){ if(!map.has(day)||e<=20*60e3) map.set(day,v); }
const out=[...map.entries()].sort((a,b)=>a[0]-b[0]);
s=s.replace(re,'const CG_CLOSES = '+JSON.stringify(out)+';'); fs.writeFileSync(f,s);
console.log(JSON.stringify({added:best.size,total:out.length,last:out.length?new Date(out[out.length-1][0]*DAY).toISOString().slice(0,10):null}));
