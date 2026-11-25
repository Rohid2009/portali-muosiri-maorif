// Тасвири саҳифаи асосӣ: бинои мактаб, китобҳо, кулоҳи хатм ва китоби кушода (SVG-и худамон).
const SVG = `<svg viewBox="0 0 560 470" class="h-auto w-full max-w-[560px]" role="img" aria-label="Кулоҳи хатм дар болои китобҳо ва китоби кушода">
 <defs>
  <linearGradient id="bld" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fa8ff" stop-opacity=".34"/><stop offset="1" stop-color="#2a5bd8" stop-opacity="0"/></linearGradient>
  <radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#3c8cff" stop-opacity=".75"/><stop offset="1" stop-color="#3c8cff" stop-opacity="0"/></radialGradient>
  <linearGradient id="capTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a4a70"/><stop offset=".5" stop-color="#1a2440"/><stop offset="1" stop-color="#0c1224"/></linearGradient>
  <linearGradient id="skull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2642"/><stop offset="1" stop-color="#0a0f1e"/></linearGradient>
  <linearGradient id="bA" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1846b8"/><stop offset="1" stop-color="#0e2a78"/></linearGradient>
  <linearGradient id="bB" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a63e0"/><stop offset="1" stop-color="#173f9e"/></linearGradient>
  <linearGradient id="bC" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#163683"/><stop offset="1" stop-color="#0b1f55"/></linearGradient>
  <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfe0ff"/></linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd76a"/><stop offset="1" stop-color="#d99a10"/></linearGradient>
  <filter id="blur18"><feGaussianBlur stdDeviation="18"/></filter><filter id="blur6"><feGaussianBlur stdDeviation="6"/></filter>
 </defs>
 <g fill="url(#bld)">
  <path d="M300 120 L430 70 L560 120 V340 H300z"/>
  <rect x="300" y="118" width="260" height="10" fill="#9cc2ff" opacity=".25"/>
 </g>
 <g fill="#9cc2ff" opacity=".22">
  <rect x="318" y="140" width="22" height="30" rx="3"/><rect x="364" y="140" width="22" height="30" rx="3"/><rect x="410" y="140" width="22" height="30" rx="3"/><rect x="456" y="140" width="22" height="30" rx="3"/><rect x="502" y="140" width="22" height="30" rx="3"/><rect x="318" y="188" width="22" height="30" rx="3"/><rect x="364" y="188" width="22" height="30" rx="3"/><rect x="410" y="188" width="22" height="30" rx="3"/><rect x="456" y="188" width="22" height="30" rx="3"/><rect x="502" y="188" width="22" height="30" rx="3"/><rect x="318" y="236" width="22" height="30" rx="3"/><rect x="364" y="236" width="22" height="30" rx="3"/><rect x="410" y="236" width="22" height="30" rx="3"/><rect x="456" y="236" width="22" height="30" rx="3"/><rect x="502" y="236" width="22" height="30" rx="3"/><rect x="318" y="284" width="22" height="30" rx="3"/><rect x="364" y="284" width="22" height="30" rx="3"/><rect x="410" y="284" width="22" height="30" rx="3"/><rect x="456" y="284" width="22" height="30" rx="3"/><rect x="502" y="284" width="22" height="30" rx="3"/>
 </g>
 <ellipse cx="300" cy="372" rx="230" ry="44" fill="url(#glow)" filter="url(#blur18)"/>
 <!-- китоби поёнӣ -->
 <path d="M110 318 L170 290 L500 290 L440 318z" fill="#2a5ad0"/>
 <rect x="110" y="318" width="330" height="44" rx="4" fill="url(#bA)"/>
 <path d="M440 318 L500 290 V334 L440 362z" fill="#0a1f5c"/>
 <rect x="122" y="324" width="306" height="32" rx="3" fill="url(#pg)"/>
 <path d="M126 332h298M126 340h298M126 348h298" stroke="#b9cdf5" stroke-width="1.2"/>
 <rect x="300" y="318" width="16" height="44" fill="url(#gold)"/>
 <!-- китоби миёна -->
 <path d="M140 266 L195 240 L470 240 L415 266z" fill="#3f78ec"/>
 <rect x="140" y="266" width="275" height="34" rx="4" fill="url(#bB)"/>
 <path d="M415 266 L470 240 V274 L415 300z" fill="#123a99"/>
 <rect x="150" y="271" width="255" height="24" rx="3" fill="url(#pg)"/>
 <path d="M154 278h247M154 285h247" stroke="#b9cdf5" stroke-width="1.1"/>
 <!-- китоби болоӣ -->
 <path d="M160 222 L210 198 L455 198 L405 222z" fill="#244a9e"/>
 <rect x="160" y="222" width="245" height="30" rx="4" fill="url(#bC)"/>
 <path d="M405 222 L455 198 V228 L405 252z" fill="#081a48"/>
 <rect x="168" y="227" width="229" height="5" fill="url(#gold)"/><rect x="168" y="242" width="229" height="4" fill="url(#gold)"/>
 <!-- кулоҳи хатм -->
 <ellipse cx="308" cy="208" rx="74" ry="12" fill="#000" opacity=".35" filter="url(#blur6)"/>
 <path d="M248 160 q60 26 120 0 v44 q-60 22 -120 0z" fill="url(#skull)"/>
 <path d="M308 92 L430 136 L308 180 L186 136z" fill="url(#capTop)"/>
 <path d="M308 92 L430 136 L308 140 L186 136z" fill="#fff" opacity=".07"/>
 <path d="M186 136 L308 180 L430 136" fill="none" stroke="#5f75a8" stroke-width="1.5" opacity=".6"/>
 <circle cx="308" cy="136" r="6" fill="url(#gold)"/>
 <path d="M308 136 Q360 140 404 146 V210" fill="none" stroke="url(#gold)" stroke-width="3.2" stroke-linecap="round"/>
 <path d="M398 206 h12 l5 46 h-22z" fill="url(#gold)"/><path d="M396 250 h20" stroke="#b97f05" stroke-width="2"/>
 <path d="M401 214v34M405 214v36M409 214v34" stroke="#b97f05" stroke-width="1" opacity=".7"/>
 <!-- китоби кушода -->
 <ellipse cx="330" cy="430" rx="190" ry="26" fill="#3c8cff" opacity=".5" filter="url(#blur18)"/>
 <path d="M330 404 C285 384 215 380 160 392 L146 452 C205 440 285 444 330 466 C375 444 455 440 514 452 L500 392 C445 380 375 384 330 404z" fill="#1d4fc4"/>
 <path d="M330 398 C288 378 222 374 170 384 L158 442 C212 432 288 436 330 456z" fill="url(#pg)"/>
 <path d="M330 398 C372 378 438 374 490 384 L502 442 C448 432 372 436 330 456z" fill="url(#pg)"/>
 <path d="M330 398 V456" stroke="#9cbcf5" stroke-width="2"/>
 <g stroke="#a9c3f2" stroke-width="2" stroke-linecap="round" fill="none">
  <path d="M186 400c40-6 90-4 128 10M184 412c40-6 90-4 128 10M182 424c40-6 90-4 128 10"/>
  <path d="M346 410c38-14 88-16 128-10M346 422c38-14 88-16 128-10M346 434c38-14 88-16 128-10"/>
 </g>
 <ellipse cx="330" cy="404" rx="120" ry="16" fill="#fff" opacity=".25" filter="url(#blur6)"/>
</svg>`;

export function HeroArt() {
  return <div className="grid place-items-center" dangerouslySetInnerHTML={{ __html: SVG }} />;
}
