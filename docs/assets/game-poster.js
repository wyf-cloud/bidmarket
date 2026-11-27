// In-engine vector key art: independent planes and silhouettes, with no external asset requests.
export const motifs=['desk','print','bind','vault','lift','hall'];
export const routeBrief=['踏过格子间','避开喷纸口','上下路分岔','暗处甩开幽灵','跨过电梯井','冲进开标台'];
const glyphs=[
  '<path d="M4 20h32v5H4zm4 5v11m24-11v11M11 8h20v12H11zm10 12v-3"/><path d="M15 12h11m-11 4h7"/>',
  '<path d="M5 12h30v18H5zm5 0V4h20v8M11 24h18v12H11zm4 5h10m-10 4h10m5-16h3"/>',
  '<path d="M3 31h34v5H3zM9 31V18h22v13M9 18l3-9h18l4 9M15 9V5h11v4m-10 15h9m-7 3h8"/>',
  '<rect x="6" y="5" width="28" height="30" rx="3"/><rect x="11" y="10" width="18" height="20" rx="1"/><circle cx="20" cy="20" r="5"/><path d="M20 15v10m-5-5h10"/>',
  '<path d="M7 35V11h26v24M20 11v24M14 7l3-3 3 3m3-3 3 3 3-3M4 35h32"/>',
  '<path d="M4 5h32v15H4zm4 22h24l-3 8H11zM12 13h5m5 0h6m-8 13v-3l5-3"/>'
];
export const chapterIcon=i=>`<svg aria-hidden="true" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${glyphs[i]}</svg>`;
export const brandIcon=`<svg aria-hidden="true" viewBox="0 0 38 38" fill="none"><path d="M20 4 5 23h12l-1 11 17-21H21l-1-9Z" fill="currentColor"/><path d="M4 10h8M3 29h8M28 28h6" stroke="currentColor" stroke-width="1.5"/></svg>`;
const skyline=Array.from({length:18},(_,i)=>{const x=i*44-12, h=22+(i*37%106);return `<path d="M${x} 350v-${h}h33v${h}" fill="${i%3?'#172847':'#263552'}"/><path d="M${x+6} ${356-h}v${h-15}m10 -${h-15}v${h-15}" stroke="#ffc075" stroke-opacity="${i%4*.12+.1}" stroke-dasharray="3 11"/>`;}).join('');
const shelves=Array.from({length:6},(_,i)=>`<g transform="translate(${i*20} 0)"><path d="M0 0h14l2 47H0Z" fill="${['#d35d49','#edaa62','#566f92','#789eae'][i%4]}"/><path d="M4 8h6m-6 5h6M4 37h6" stroke="#efe5dc" stroke-opacity=".55"/></g>`).join('');
const sheets=[[205,339,-21],[311,383,12],[493,246,-23],[590,152,-18],[642,241,25],[565,352,-25],[445,392,17]].map(([x,y,r],i)=>`<g transform="translate(${x} ${y}) rotate(${r}) scale(${.52+i%3*.19})"><path d="M0 4h27l11 11v43H0Z" fill="#030d21" opacity=".55"/><path d="M0 0h27l11 11v43H0Z" fill="#fff3cd"/><path d="M27 0v11h11M7 24h23M7 32h18M7 40h13" fill="none" stroke="#bb7751" stroke-width="2"/></g>`).join('');
export const keyArt=`<svg class="night-poster" viewBox="0 0 720 550" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<defs>
  <linearGradient id="poster-sky" x2="0" y2="1"><stop stop-color="#10192f"/><stop offset=".66" stop-color="#46466a"/><stop offset="1" stop-color="#eb8e62"/></linearGradient>
  <radialGradient id="poster-halo"><stop stop-color="#ffc680" stop-opacity=".42"/><stop offset="1" stop-color="#ff9f54" stop-opacity="0"/></radialGradient>
  <linearGradient id="poster-floor" x2="0" y2="1"><stop stop-color="#283751"/><stop offset="1" stop-color="#0a1123"/></linearGradient>
  <linearGradient id="poster-shirt" x2=".8" y2="1"><stop stop-color="#fff4db"/><stop offset="1" stop-color="#8fd0d6"/></linearGradient>
  <pattern id="poster-blinds" patternUnits="userSpaceOnUse" width="8" height="13"><path d="M0 0h8" stroke="#141f36" stroke-opacity=".57" stroke-width="2"/></pattern>
</defs>
<path d="M0 0h720v550H0Z" fill="#0d1528"/><path d="M85 45h598v327H85Z" fill="url(#poster-sky)"/>
<circle cx="518" cy="202" r="205" fill="url(#poster-halo)"/><circle cx="535" cy="150" r="61" fill="#ffc881" opacity=".92"/>
<path d="M87 220h593M87 239h593" stroke="#ffbb82" stroke-opacity=".22" stroke-width="2"/>
${skyline}<path d="M85 45h598v311H85Z" fill="url(#poster-blinds)"/>
<path d="M85 48h598v310H85zM274 48v310M472 48v310M666 48v310M85 264h598" stroke="#162339" stroke-width="11" fill="none"/>
<path d="M68 359h652v191H0v-93Z" fill="url(#poster-floor)"/><path d="M720 385H80M720 422H52m668 55H17M234 362 119 550m222-188-34 188m167-188 49 188m69-188 122 188" stroke="#7f96ad" stroke-opacity=".2" fill="none"/>
<path d="M570 359h150v120H570Z" fill="#182037" stroke="#435773" stroke-width="3"/><path d="M582 374h138v76H582Z" fill="#0c1428"/><g transform="translate(590 396)">${shelves}</g>
<path d="M95 384h145l30 20H85zM90 409h169v15H90zm9 19h10v73H99zm136 0h10v73h-10Z" fill="#1b2d48" stroke="#4b637f" stroke-width="2"/><path d="M117 315h78v59h-78Z" fill="#102036" stroke="#647e95" stroke-width="4"/><path d="M124 323h64v40h-64Z" fill="#314e63"/><path d="M132 335h43m-43 8h32m-32 8h38" stroke="#84d4cf" stroke-width="2"/><path d="M150 373h12v14h-12" fill="#647e95"/>
<path d="M334 437c40 3 111 4 170 4m-198 13c70 2 111 1 161 1m-104 14h49" stroke="#95b9cc" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>
${sheets}
<g transform="translate(405 263) scale(1.35)" stroke="#11192b" stroke-width="5" stroke-linejoin="round">
 <path d="M-53 9q-29 3-28 28l6 44 42-18-1-55Z" fill="#9f502f"/><path d="M-66 23q12-12 25-13M-69 53l23-10" fill="none" stroke="#ffc180" stroke-width="2.5"/>
 <path d="m-40 57-11 40-42 13 8 15 51-12 24-35m9-16 40 22-1 28 24-2 2-41L16 42" fill="#254366"/>
 <path d="m-89 105-12 12 3 16 28-5-3-14zm125 0-2 15 40 1 2-11-15-5Z" fill="#111c30"/>
 <path d="M-47 3q-10 15-7 30l13 29 48-8 8-39L2-3z" fill="url(#poster-shirt)"/>
 <path d="m-14 7 6 13-8 28 8 8 9-14-3-25 4-9" fill="#bd4d40" stroke-width="2"/>
 <path d="M-45 11-64 27-94 14l-7 12 34 24 26-12M2 8l30 8 21-28 14 12-22 36-29-4" fill="url(#poster-shirt)"/>
 <path d="m-100 27-15-9 3-10 15 6m151-26 8-12 16 9-12 15" fill="#efac7a" stroke-width="3"/>
 <path d="M-39-29q1-30 32-29 29 0 33 24l-2 21-9 3-6 15-18 4-15-13-9-12Z" fill="#ecad7e"/>
 <path d="M-45-19q-10-26 6-41 23-20 59-1l9-1-3 17-15 8-18-5-12 8-5 13-9-5-3 12Z" fill="#22283c"/>
 <path d="m-36-52 16-6m2 23 17 2m7 1 17 2m-20-1-2 12H-15l-4-14m26 1 1 11 12 1" stroke="#7e5c58" stroke-width="2.5" fill="none"/>
 <path d="m8-9 8-1" stroke="#8c4840" stroke-width="2"/>
 <path d="M50-25h40v59H50Z" fill="#cf7b45" transform="rotate(-15 65 0)"/><path d="m54-17 30-8m-22 32 20-5" stroke="#ffe3ac" stroke-width="2"/>
</g>
<path d="M664 143h43v-31h-43Z" fill="#1b283b" stroke="#f0a965" stroke-width="2"/><circle cx="675" cy="127" r="3" fill="#fd856d"/><path d="M685 127h12m-6-6 6 6-6 6" fill="none" stroke="#ffcc80" stroke-width="2"/>
</svg>`;