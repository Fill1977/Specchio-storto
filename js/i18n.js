/* Testi dell'app. Italiano di casa, inglese per il resto del mondo. */

const IT = {
  kicker: 'Sala degli specchi',
  note: 'Sedici specchi deformanti dentro la fotocamera. Tutto resta nel telefono: <b>niente account, niente server, niente registrazioni.</b>',
  enter: 'Entra nella sala',
  daily: 'Specchio del giorno',
  streak: n => `🔥 ${n} ${n === 1 ? 'giorno' : 'giorni di fila'}`,
  found: (a, b) => `Specchi scoperti ${a}/${b}`,
  allFound: 'Hai scoperto tutti gli specchi! 🏆',

  testone: 'Testone', bombato: 'Bombato', risucchio: 'Risucchio', giraffa: 'Giraffa',
  largone: 'Largone', vortice: 'Vortice', buconero: 'Buco nero', sciolto: 'Sciolto',
  gelatina: 'Gelatina', onde: 'Onde', fisarmonica: 'Fisarmonica', gemello: 'Gemello',
  folla: 'Folla', caleido: 'Caleido', mosaico: 'Mosaico', scossa: 'Scossa',

  c_naturale: 'Naturale', c_fumetto: 'Fumetto', c_termico: 'Termico', c_neon: 'Neon',
  c_lunapark: 'Luna park', c_acido: 'Acido', c_noir: 'Noir',

  v_normale: 'Voce normale', v_elio: 'Voce elio', v_orco: 'Voce orco',
  v_robot: 'Voce robot', v_eco: 'Voce eco', v_muto: 'Senza audio',

  m_foto: 'Foto', m_giostra: 'Giostra', m_rivela: 'Rivela', m_cabina: 'Cabina',
  hint_foto: 'Tocca per la foto · tieni premuto per il video',
  hint_giostra: 'Tocca: 10 secondi, uno specchio diverso ogni battito',
  hint_rivela: 'Tocca: parte deformato, poi si rivela. Indovina chi è!',
  hint_cabina: 'Tocca: 4 pose, 4 specchi, una striscia da fototessera',
  hint_drag: 'Trascina il dito per spostare lo specchio · due dita per l\'intensità · doppio tocco = sorpresa',

  who: 'CHI È?', surprise: 'SORPRESA!', ready: 'PRONTI?',
  share: 'Condividi', save: 'Salva', close: 'Rifai', del: 'Elimina',
  album: 'Album', albumEmpty: 'Ancora niente. Fai il primo scatto storto!',
  saved: 'Salvato ✓', savedIn: p => `Salvato in ${p}`, shared: 'Condiviso ✓',
  shareFail: 'Condivisione non disponibile: ho scaricato il file.',
  tag: '#specchiostorto',

  flip: 'Cambia fotocamera', shot: 'Scatta', amount: 'Intensità effetto',
  colorBtn: 'Filtro colore', voiceBtn: 'Effetto voce', effects: 'Specchi',
  errWebgl: 'WebGL non è disponibile su questo dispositivo. Prova con Chrome o Safari aggiornati.',
  errHttps: 'La fotocamera funziona solo su HTTPS. Apri la pagina da un indirizzo https:// (o da localhost).',
  errDenied: 'Permesso negato. Riattiva la fotocamera dalle impostazioni e riprova.',
  errCam: m => 'Fotocamera non raggiungibile: ' + m,
  errRec: 'Questo dispositivo non sa registrare video dal browser. Le foto funzionano!',
  micDenied: 'Microfono negato: registro il video senza audio.',
  privacy: 'Privacy'
};

const EN = {
  kicker: 'Hall of mirrors',
  note: 'Sixteen funhouse mirrors inside your camera. Everything stays on your phone: <b>no accounts, no servers, no uploads.</b>',
  enter: 'Step inside',
  daily: 'Mirror of the day',
  streak: n => `🔥 ${n} ${n === 1 ? 'day' : 'days in a row'}`,
  found: (a, b) => `Mirrors found ${a}/${b}`,
  allFound: 'You found every mirror! 🏆',

  testone: 'Big Head', bombato: 'Bulge', risucchio: 'Pinch', giraffa: 'Giraffe',
  largone: 'Pancake', vortice: 'Swirl', buconero: 'Black Hole', sciolto: 'Melt',
  gelatina: 'Jelly', onde: 'Waves', fisarmonica: 'Accordion', gemello: 'Twin',
  folla: 'Crowd', caleido: 'Kaleido', mosaico: 'Pixel', scossa: 'Glitch',

  c_naturale: 'Natural', c_fumetto: 'Comic', c_termico: 'Thermal', c_neon: 'Neon',
  c_lunapark: 'Funfair', c_acido: 'Acid', c_noir: 'Noir',

  v_normale: 'Normal voice', v_elio: 'Helium voice', v_orco: 'Ogre voice',
  v_robot: 'Robot voice', v_eco: 'Echo voice', v_muto: 'No audio',

  m_foto: 'Photo', m_giostra: 'Carousel', m_rivela: 'Reveal', m_cabina: 'Booth',
  hint_foto: 'Tap for a photo · hold for video',
  hint_giostra: 'Tap: 10 seconds, a new mirror on every beat',
  hint_rivela: 'Tap: starts warped, then reveals. Guess who!',
  hint_cabina: 'Tap: 4 poses, 4 mirrors, one photo-booth strip',
  hint_drag: 'Drag to move the mirror · two fingers for strength · double tap = surprise',

  who: 'WHO IS IT?', surprise: 'SURPRISE!', ready: 'READY?',
  share: 'Share', save: 'Save', close: 'Retake', del: 'Delete',
  album: 'Album', albumEmpty: 'Nothing yet. Take your first warped shot!',
  saved: 'Saved ✓', savedIn: p => `Saved to ${p}`, shared: 'Shared ✓',
  shareFail: 'Sharing not available: the file was downloaded.',
  tag: '#funhousemirror',

  flip: 'Switch camera', shot: 'Shoot', amount: 'Effect strength',
  colorBtn: 'Color filter', voiceBtn: 'Voice effect', effects: 'Mirrors',
  errWebgl: 'WebGL is not available on this device. Try an up-to-date Chrome or Safari.',
  errHttps: 'The camera only works over HTTPS. Open the page from an https:// address (or localhost).',
  errDenied: 'Permission denied. Re-enable the camera in settings and try again.',
  errCam: m => 'Camera unavailable: ' + m,
  errRec: 'This device cannot record video from the browser. Photos still work!',
  micDenied: 'Microphone denied: recording without sound.',
  privacy: 'Privacy'
};

const lang = (navigator.language || 'it').toLowerCase().startsWith('it') ? 'it' : 'en';
const T = lang === 'it' ? IT : EN;

export const LANG = lang;
export function t(key, ...args){
  const v = T[key] ?? IT[key] ?? key;
  return typeof v === 'function' ? v(...args) : v;
}
