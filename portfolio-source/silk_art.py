"""我用三层透明玻璃折面保留无需 WebGL 的完整视觉。"""
from pathlib import Path
import json

def silk_art():
    markup = '''<div class="era-silk" aria-hidden="true"><svg viewBox="0 0 900 900" focusable="false"><defs>
<linearGradient id="spatial-body" x1=".1" y1="0" x2=".9" y2="1"><stop stop-color="#fff" stop-opacity=".96"/><stop offset=".18" stop-color="#caedff" stop-opacity=".76"/><stop offset=".39" stop-color="#80a9f0" stop-opacity=".57"/><stop offset=".52" stop-color="#fff" stop-opacity=".83"/><stop offset=".72" stop-color="#a3c4f5" stop-opacity=".5"/><stop offset=".88" stop-color="#b9a7df" stop-opacity=".64"/><stop offset="1" stop-color="#f4faff" stop-opacity=".9"/></linearGradient>
<linearGradient id="spatial-side" x1="0" y1=".3" x2="1" y2=".7"><stop stop-color="#dbeaff" stop-opacity=".4"/><stop offset=".3" stop-color="#83abec" stop-opacity=".55"/><stop offset=".6" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#9f91ce" stop-opacity=".5"/></linearGradient>
<linearGradient id="spatial-edge"><stop stop-color="#fff"/><stop offset=".5" stop-color="#fff" stop-opacity=".15"/><stop offset="1" stop-color="#6289c9" stop-opacity=".65"/></linearGradient>
<radialGradient id="spatial-pearl" cx=".3" cy=".2" r=".8"><stop stop-color="#fff"/><stop offset=".4" stop-color="#e4f8ff" stop-opacity=".76"/><stop offset=".8" stop-color="#abc2ee" stop-opacity=".4"/><stop offset="1" stop-color="#a599d0" stop-opacity=".7"/></radialGradient></defs>
<g class="era-fold era-fold-one"><path d="M303 215C347 136 472 137 515 213C555 283 524 313 583 348C655 390 668 493 614 550C562 605 552 629 530 698C506 780 389 797 338 731C284 660 333 596 285 553C229 501 196 456 216 392C236 331 269 279 303 215Z" fill="url(#spatial-body)" stroke="url(#spatial-edge)" stroke-width="2"/><path d="M322 239C357 171 447 168 482 219C523 278 494 329 557 371C614 410 629 465 596 513" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="5"/><path d="M360 683C392 730 468 721 488 672" fill="none" stroke="#eff9ff" stroke-opacity=".7" stroke-width="4"/></g>
<g class="era-fold era-fold-two"><path d="M441 278C510 246 576 299 559 358C546 400 519 434 527 479C542 552 486 607 428 585C375 564 367 504 393 461C417 421 383 378 394 337C401 312 421 287 441 278Z" fill="url(#spatial-side)" stroke="url(#spatial-edge)" stroke-width="2"/><path d="M437 303C493 272 535 311 519 357C505 398 485 433 494 480" fill="none" stroke="#fff" stroke-opacity=".65" stroke-width="3"/></g>
<g class="era-fold era-fold-three"><circle cx="655" cy="247" r="36" fill="url(#spatial-pearl)" stroke="#fff" stroke-opacity=".9" stroke-width="2"/><circle cx="205" cy="650" r="23" fill="url(#spatial-pearl)" stroke="#fff" stroke-width="1.5"/><ellipse cx="644" cy="232" rx="12" ry="7" fill="#fff" stroke="none" opacity=".7"/></g>
</svg></div>'''

    meta=json.loads((Path(__file__).parent/'hero-art.json').read_text())
    art=f'<div class="spatial-art"><img class="spatial-hero-art" src="{meta["src"]}" alt="" width="{meta["width"]}" height="{meta["height"]}" decoding="async" fetchpriority="high"/></div>'
    return markup.replace('</div>',art+'</div>')
