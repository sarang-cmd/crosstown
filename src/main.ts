// The landing entry has NO Three/Rapier/worker/audio imports or game CSS.
// Explicit /play and all retained game query links boot straight into action.
const query = new URLSearchParams(location.search);
const legacyGame = ['sandbox','training','seed','length','webgl','drive','test','autostart','date','population','explore','setup'].some(k=>query.has(k));
if (location.pathname.replace(/\/$/,'') === '/callback') {
  void import('./radio/callback');
} else if (/^\/play\/?$/.test(location.pathname) || legacyGame) {
  document.querySelector('#app')!.innerHTML='<main id="scene" aria-label="Crosstown city"></main><div id="interface"></div><div id="boot-status" role="status">Finding your side of town…<span class="loading-dot"></span></div>';
  void import('./style.css');
  if (query.has('sandbox')) void import('./foundation');
  else void import('./game');
} else {
  void import('./landing.css');
  document.documentElement.dataset.ready='landing';
}
export {};
