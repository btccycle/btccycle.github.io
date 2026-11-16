#!/usr/bin/env node
/**
 * Daily X (Twitter) drafts for BTC Cycle Tracker.
 *
 *   node scripts/draft-posts.mjs --data data.json --out out [--site https://you.github.io/btc-cycle-tracker/] [--og]
 *
 * data.json (any of these keys):
 *   price  : {usd, usd_24h_change, last_updated_at}           ← CoinGecko /simple/price, or get-coin-markets mapped
 *   charts : [{startTs, endTs, prices:[...]}, ...]            ← CoinGecko connector get-coin-market-chart outputs
 *   prices : [[ms, usd], ...]                                  ← CoinGecko /market_chart prices
 * Writes: out/drafts-YYYY-MM-DD.md, out/drafts-YYYY-MM-DD.json, out/card-ko.png, out/card-en.png  (and og-image.png with --og)
 */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)), root=path.resolve(here,'..');
const arg=k=>{ const i=process.argv.indexOf('--'+k); return i>0?process.argv[i+1]:null; }, flag=k=>process.argv.includes('--'+k);
const dataPath=arg('data'), outDir=path.resolve(arg('out')||'out'), site=(arg('site')||'').replace(/\/?$/,'/');
fs.mkdirSync(outDir,{recursive:true});
const inject=dataPath?JSON.parse(fs.readFileSync(dataPath,'utf8')):{};

let chromium; for(const p of ['playwright','/opt/npm-tools/node_modules/playwright/index.mjs']){ try{ ({chromium}=await import(p)); break; }catch(e){} }
if(!chromium) { console.error('playwright not found'); process.exit(2); }
const exe=[process.env.CHROME,'/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(p=>p&&fs.existsSync(p));
const browser=await chromium.launch(exe?{executablePath:exe}:{});

async function readPage(lang){
  const p=await browser.newPage({viewport:{width:1280,height:900}});
  await p.addInitScript(d=>{ window.__BTCCT_INJECT=d; try{localStorage.clear()}catch(e){} }, inject);
  await p.route('**/*',r=>{ const u=r.request().url(); return u.startsWith('file:')?r.continue():r.abort(); });
  await p.goto('file://'+path.join(root,'index.html')+'#'+lang);
  await p.waitForFunction(()=>window.BTCCT&&window.BTCCT.summary(),null,{timeout:20000});
  const r=await p.evaluate(()=>({s:window.BTCCT.summary(),ser:window.BTCCT.series()})); await p.close(); return r;
}
const {s,ser}=await readPage('ko');

/* ---------- formatting ---------- */
const usd=v=>'$'+Math.round(v).toLocaleString('en-US'), k=v=>v>=1000?'$'+(v/1000).toFixed(v>=100000?0:1)+'k':usd(v);
const pc=(v,d=1)=>(v>0?'+':'')+(v*100).toFixed(d)+'%', ym=d=>d.slice(0,7);
// X weighted length: CJK/Hangul count 2, URLs count 23
const xlen=t=>{ let n=0; const urls=t.match(/https?:\/\/\S+/g)||[]; let rest=t; urls.forEach(u=>{rest=rest.replace(u,'');n+=23;}); for(const ch of rest){ const c=ch.codePointAt(0); n+=(c>=0x1100&&c<=0x11FF)||(c>=0x2E80&&c<=0xD7AF)||(c>=0xF900&&c<=0xFAFF)||(c>=0xFF00&&c<=0xFFEF)||c>0xFFFF?2:1; } return n; };
const B=s.scenarios.find(x=>x.key==='B'), A=s.scenarios.find(x=>x.key==='A'), C=s.scenarios.find(x=>x.key==='C');
const lagKo=Math.abs(s.best.lagDays)<4?'비슷한 속도':(s.best.lagDays>0?`${s.best.lagDays}일 앞서`:`${-s.best.lagDays}일 뒤처져`);
const lagEn=Math.abs(s.best.lagDays)<4?'on pace':(s.best.lagDays>0?`${s.best.lagDays}d ahead`:`${-s.best.lagDays}d behind`);
const chg=s.ch24!=null?` (24h ${pc(s.ch24/100)})`:'';
const url=site.startsWith('http')?site:'';
const posts={
 ko:[
  {type:'daily', text:`#비트코인 사이클 트래커 ${s.asOfClose}\n\nBTC ${usd(s.price)}${chg}\n고점 대비 ${pc(s.fromTop)} · 고점 후 ${s.daysSinceTop}일\n\n가장 비슷한 사이클: ${s.best.cycle}(${s.best.year}), ${lagKo} 진행\n반복 시 다음 고점 ${ym(s.nextTop.date)} · ${k(B.target)}\n\n※ 역사적 유비, 투자 조언 아님${url?'\n'+url+'#ko':''}`},
  {type:'insight', text:`과거 고점→신고점 회복: 1177 → 1080 → 847일\n이번 사이클은 ${s.daysSinceTop}일째 (평균의 ${Math.round(s.ath.progress*100)}%)\n\n추세대로면 신고점 회복 ${ym(s.ath.est.trend)}, 평균이면 ${ym(s.ath.est.avg)}\n\n#비트코인 #BTC${url?'\n'+url+'#ko':''}`},
  {type:'thread', parts:[
    `🧵 비트코인, 지금 어느 사이클과 닮았나 (${s.asOfClose} 종가)`,
    `1/ 가장 비슷한 사이클은 ${s.best.cycle}(${s.best.year}), 유사도 ${Math.round(s.best.score)}/100. 오늘은 그 사이클의 ${s.best.equivalentDate}에 해당합니다.`,
    `2/ 같은 경과일 기준 가격 괴리 ${pc(s.best.gapToday,0)}, 진폭은 ${s.best.beta.toFixed(2)}배. 시간축으로는 ${lagKo} 진행 중.`,
    `3/ 반복 가정 시 다음 고점 ${ym(s.nextTop.date)} (범위 ${ym(s.nextTop.range[0])}~${ym(s.nextTop.range[1])}).\n보수 ${k(A.target)} / 기준 ${k(B.target)} / 낙관 ${k(C.target)}`,
    `4/ 역사적 패턴을 반복한다고 가정한 계산일 뿐 예측이나 투자 조언이 아닙니다.${url?' 전체 분석: '+url+'#ko':''}`]}
 ],
 en:[
  {type:'daily', text:`#Bitcoin Cycle Tracker ${s.asOfClose}\n\nBTC ${usd(s.price)}${chg}\n${pc(s.fromTop)} from top · day ${s.daysSinceTop} since top\n\nClosest cycle: ${s.best.cycle} (${s.best.year}), ${lagEn}\nIf it repeats: next top ${ym(s.nextTop.date)} · ${k(B.target)}\n\nHistorical analog, not financial advice${url?'\n'+url+'#en':''}`},
  {type:'insight', text:`Top → new ATH took 1177 → 1080 → 847 days in past cycles.\nThis cycle: day ${s.daysSinceTop} (${Math.round(s.ath.progress*100)}% of the average).\n\nOn trend, a new ATH lands ${ym(s.ath.est.trend)}; on average, ${ym(s.ath.est.avg)}.\n\n#Bitcoin #BTC${url?'\n'+url+'#en':''}`},
  {type:'thread', parts:[
    `🧵 Which Bitcoin cycle does today look like? (${s.asOfClose} close)`,
    `1/ Closest match: ${s.best.cycle} (${s.best.year}), score ${Math.round(s.best.score)}/100. Today maps to ${s.best.equivalentDate} in that cycle.`,
    `2/ Price gap at the same elapsed day: ${pc(s.best.gapToday,0)}; amplitude ${s.best.beta.toFixed(2)}×. Time: ${lagEn}.`,
    `3/ If it repeats, next top ${ym(s.nextTop.date)} (range ${ym(s.nextTop.range[0])}–${ym(s.nextTop.range[1])}).\nConservative ${k(A.target)} / base ${k(B.target)} / optimistic ${k(C.target)}`,
    `4/ A calculation assuming history repeats, not a forecast or financial advice.${url?' Full analysis: '+url+'#en':''}`]}
 ]};
// length check
for(const L of ['ko','en']) for(const p of posts[L]){ const items=p.parts||[p.text]; p.lengths=items.map(xlen); p.ok=p.lengths.every(n=>n<=280); }

/* ---------- card image (self-contained SVG, no chart library) ---------- */
function card(lang,w=1200,h=675){
  const ko=lang==='ko', T=(a,b)=>ko?a:b;
  const all=[...ser.actual,...ser.scen.A,...ser.scen.B,...ser.scen.C].filter(p=>p[1]>0);
  const x0=ser.actual[0][0], x1=Math.max(...all.map(p=>p[0])), lo=Math.min(...all.map(p=>p[1]),s.top.price)*0.9, hi=Math.max(...all.map(p=>p[1]),s.top.price)*1.08;
  const L={x:610,y:150,w:500,h:380}, X=d=>L.x+(d-x0)/(x1-x0)*L.w, Y=v=>L.y+L.h-(Math.log(v)-Math.log(lo))/(Math.log(hi)-Math.log(lo))*L.h;
  const path=pts=>pts.filter(p=>p[1]>0).map((p,i)=>(i?'L':'M')+X(p[0]).toFixed(1)+' '+Y(p[1]).toFixed(1)).join(' ');
  const col={A:'#9085e9',B:'#0ca30c',C:'#d55181'};
  const ticks=[20e3,30e3,50e3,75e3,100e3,150e3,200e3,300e3,500e3,1e6].filter(v=>v>lo&&v<hi);
  const font=`font-family="IBM Plex Sans KR, Noto Sans CJK KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif"`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#0e0e0d}</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${font}>
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1f26"/><stop offset="1" stop-color="#121314"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<text x="56" y="78" fill="#7fb0ef" font-size="18" font-weight="600" letter-spacing="3">BTC CYCLE TRACKER</text>
<text x="56" y="112" fill="#8f8e86" font-size="20">${T(s.asOfClose+' 종가 기준','As of '+s.asOfClose+' close')}</text>
<text x="56" y="196" fill="#f0efec" font-size="64" font-weight="700">${usd(s.price)}</text>
<text x="56" y="238" fill="#e66767" font-size="26" font-weight="600">${pc(s.fromTop)} <tspan fill="#c3c2b7" font-weight="400">${T('사이클 고점 대비','from cycle top')}</tspan></text>
<text x="56" y="300" fill="#8f8e86" font-size="19">${T('가장 비슷한 사이클','Closest cycle')}</text>
<text x="56" y="336" fill="#f0efec" font-size="30" font-weight="700">${s.best.cycle} (${s.best.year}) <tspan fill="#c3c2b7" font-size="20" font-weight="400">${T('유사도','score')} ${Math.round(s.best.score)} · ${ko?lagKo:lagEn}</tspan></text>
<text x="56" y="396" fill="#8f8e86" font-size="19">${T('반복 시 다음 고점','If it repeats — next top')}</text>
<text x="56" y="436" fill="#0ca30c" font-size="38" font-weight="700">${ym(s.nextTop.date)} · ${k(B.target)}</text>
<text x="56" y="474" fill="#c3c2b7" font-size="20">${T('보수','Cons.')} ${k(A.target)} · ${T('낙관','Opt.')} ${k(C.target)} · ${T('기준 수익','base return')} ${pc(B.ret,0)}</text>
${ticks.map(v=>`<line x1="${L.x}" x2="${L.x+L.w}" y1="${Y(v)}" y2="${Y(v)}" stroke="#262624"/><text x="${L.x+L.w+8}" y="${Y(v)+5}" fill="#8f8e86" font-size="14" font-family="monospace">${k(v)}</text>`).join('')}
<line x1="${L.x}" x2="${L.x+L.w}" y1="${Y(s.top.price)}" y2="${Y(s.top.price)}" stroke="#8f8e86" stroke-dasharray="4 5"/>
<text x="${L.x+6}" y="${Y(s.top.price)-8}" fill="#8f8e86" font-size="14">${T('직전 고점','Prior top')} ${k(s.top.price)}</text>
<line x1="${X(ser.lastDay)}" x2="${X(ser.lastDay)}" y1="${L.y}" y2="${L.y+L.h}" stroke="#3987e5" stroke-dasharray="3 4"/>
<path d="${path(ser.scen.A)}" fill="none" stroke="${col.A}" stroke-width="2" stroke-dasharray="7 5"/>
<path d="${path(ser.scen.C)}" fill="none" stroke="${col.C}" stroke-width="2" stroke-dasharray="7 5"/>
<path d="${path(ser.scen.B)}" fill="none" stroke="${col.B}" stroke-width="3"/>
<path d="${path(ser.actual)}" fill="none" stroke="#3987e5" stroke-width="3.5"/>
<circle cx="${X(ser.nextTopDay)}" cy="${Y(B.target)}" r="7" fill="${col.B}" stroke="#121314" stroke-width="3"/>
<text x="${L.x}" y="${L.y+L.h+32}" fill="#8f8e86" font-size="15"><tspan fill="#3987e5">━</tspan> ${T('실제','Actual')}   <tspan fill="${col.B}">━</tspan> ${T('기준','Base')}   <tspan fill="${col.A}">╍</tspan> ${T('보수','Cons.')}   <tspan fill="${col.C}">╍</tspan> ${T('낙관','Opt.')}</text>
<text x="56" y="${h-40}" fill="#8f8e86" font-size="16">${T('역사적 유비 기반 시나리오 · 투자 조언 아님','Historical-analog scenario · not financial advice')} · ${T('시세','Data')}: CoinGecko${url?' · '+url.replace(/^https?:\/\//,'').replace(/\/$/,''):''}</text>
</svg></body></html>`;
}
async function shot(html,file,w=1200,h=675){ const p=await browser.newPage({viewport:{width:w,height:h}}); await p.route('**/*',r=>r.request().url().startsWith('data:')||r.request().url().startsWith('about:')?r.continue():r.abort()); await p.setContent(html); await p.screenshot({path:file,clip:{x:0,y:0,width:w,height:h}}); await p.close(); }
await shot(card('ko'),path.join(outDir,'card-ko.png'));
await shot(card('en'),path.join(outDir,'card-en.png'));
if(flag('og')) await shot(card('en',1200,630),path.join(root,'og-image.png'),1200,630);
await browser.close();

/* ---------- write drafts ---------- */
const day=s.asOfClose;
const md=[`# X drafts — ${day}`,'',`BTC ${usd(s.price)}${chg} · ${pc(s.fromTop)} from top · closest ${s.best.cycle} (${s.best.year}, score ${Math.round(s.best.score)}) · next top ${s.nextTop.date} · base ${usd(B.target)} (${pc(B.ret,0)})`,'',
 ...['ko','en'].flatMap(L=>[`## ${L==='ko'?'한국어':'English'}`,'',...posts[L].flatMap(p=>[`### ${p.type} ${p.ok?'':'⚠️ over 280'} (${p.lengths.join(' / ')})`,'',...(p.parts?p.parts.map(t=>t+'\n\n---'):[p.text]),'',`Image: card-${L}.png`,''])])].join('\n');
fs.writeFileSync(path.join(outDir,`drafts-${day}.md`),md);
fs.writeFileSync(path.join(outDir,`drafts-${day}.json`),JSON.stringify({summary:s,posts},null,2));
console.log(JSON.stringify({ok:true,day,files:[`drafts-${day}.md`,`drafts-${day}.json`,'card-ko.png','card-en.png'],lengths:Object.fromEntries(['ko','en'].map(L=>[L,posts[L].map(p=>p.lengths)]))}));
