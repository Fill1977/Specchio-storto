/* Specchio Storto — la sala degli specchi nel telefono. */
import { VERT, FRAG, EFFECTS, COLORS } from './shaders.js';
import { t } from './i18n.js';
import { sfx, VOICES, audio, startRecordingAudio, stopRecordingAudio, releaseMic } from './audio.js';
import { addItem, listItems, deleteItem, prefs, markFound, foundCount, touchStreak, dailyPick } from './store.js';
import { isNative, shareBlob, saveBlob, fileName, vibrate } from './native.js';

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const VOICE_ICONS = ['🎤', '🎈', '👹', '🤖', '🏔️', '🔇'];
const MAX_VIDEO_MS = 15000;

/* ============ testi ============ */
document.documentElement.lang = t('kicker') === 'Sala degli specchi' ? 'it' : 'en';
document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
document.querySelectorAll('[data-i18n-html]').forEach(el => el.innerHTML = t(el.dataset.i18nHtml));
document.querySelectorAll('[data-i18n-label]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nLabel)));
document.querySelectorAll('.mode').forEach(el => el.textContent = t('m_' + el.dataset.mode));
$('shareBtn').textContent = t('share');
$('saveBtn').textContent = t('save');
$('delBtn').textContent = t('del');
$('closeBtn').textContent = t('close');

/* ============ stato ============ */
const S = {
  fx: clamp(prefs.get('fx', 0), 0, EFFECTS.length - 1),
  color: clamp(prefs.get('color', 0), 0, COLORS.length - 1),
  voice: clamp(prefs.get('voice', 0), 0, VOICES.length - 1),
  mode: 'foto',
  front: true,
  center: [0, 0],
  fxOverride: null,     // la giostra e la cabina cambiano specchio da sole
  kOverride: null,      // la rivelazione anima l'intensità
  overlay: null,        // scritta impressa nel video
  busy: false,
  paused: false,
  live: false
};

/* ============ WebGL ============ */
const cv = $('c');
const gl = cv.getContext('webgl', { preserveDrawingBuffer: true, alpha: false, antialias: false });
const video = document.createElement('video');
video.playsInline = true; video.muted = true; video.autoplay = true;
video.setAttribute('playsinline', '');
let stream = null, tex = null, U = {}, built = false;
const t0 = performance.now();

function fail(msg){
  const e = $('err');
  e.textContent = msg; e.classList.add('on');
}

function build(){
  if(built) return true;
  if(!gl){ fail(t('errWebgl')); return false; }
  const mk = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, mk(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  ['uTex','uCover','uAspect','uTime','uK','uMode','uColor','uMirror','uCenter','uTexel']
    .forEach(n => U[n] = gl.getUniformLocation(prog, n));

  tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);   // il video parte dall'alto, la texture dal basso
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  built = true;
  return true;
}

function resize(){
  if(!gl) return;
  const d = Math.min(window.devicePixelRatio || 1, 2);
  cv.width  = Math.round(cv.clientWidth  * d);
  cv.height = Math.round(cv.clientHeight * d);
  gl.viewport(0, 0, cv.width, cv.height);
}
window.addEventListener('resize', resize);

async function openCamera(){
  try{
    if(!navigator.mediaDevices?.getUserMedia) throw new Error('insecure');
    if(stream) stream.getTracks().forEach(tr => tr.stop());
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: S.front ? 'user' : 'environment',
               width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    $('err').classList.remove('on');
  }catch(err){
    if(location.protocol !== 'https:' && location.hostname !== 'localhost' && !isNative){
      fail(t('errHttps'));
    } else if(err.name === 'NotAllowedError'){
      fail(t('errDenied'));
    } else {
      fail(t('errCam', err.message || err.name));
    }
    throw err;
  }
}

function closeCamera(){
  if(stream){ stream.getTracks().forEach(tr => tr.stop()); stream = null; }
}

function currentK(){
  return S.kOverride ?? $('amount').value / 100;
}

function render(){
  if(video.readyState < 2 || !video.videoWidth) return false;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
  const ca = cv.width / cv.height;
  const va = video.videoWidth / video.videoHeight;
  const cover = ca > va ? [1, va / ca] : [ca / va, 1];
  const fx = EFFECTS[S.fxOverride ?? S.fx];
  gl.uniform1i(U.uTex, 0);
  gl.uniform2f(U.uCover, cover[0], cover[1]);
  gl.uniform1f(U.uAspect, ca);
  gl.uniform1f(U.uTime, (performance.now() - t0) / 1000);
  gl.uniform1f(U.uK, currentK());
  gl.uniform1i(U.uMode, fx.id);
  gl.uniform1i(U.uColor, COLORS[S.color].id);
  gl.uniform1f(U.uMirror, S.front ? 1 : 0);
  gl.uniform2f(U.uCenter, S.center[0], S.center[1]);
  gl.uniform2f(U.uTexel, 1 / video.videoWidth, 1 / video.videoHeight);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return true;
}

function loop(){
  requestAnimationFrame(loop);
  if(S.paused) return;
  if(render() && rec) compose();
}

/* ============ composizione: firma e scritte nel file finale ============ */
const comp = document.createElement('canvas');
const cx = comp.getContext('2d');

function sizeComp(maxH){
  const s = Math.min(1, maxH / cv.height);
  comp.width  = Math.max(2, Math.round(cv.width  * s / 2) * 2);
  comp.height = Math.max(2, Math.round(cv.height * s / 2) * 2);
}

function drawSign(c, w, h){
  const fs = Math.round(w * 0.05);
  c.save();
  c.textAlign = 'right';
  c.textBaseline = 'alphabetic';
  c.font = `${fs}px Bungee, sans-serif`;
  const x = w - fs * 0.7, y = h - fs * 1.5;
  c.fillStyle = '#FF2D8A'; c.fillText('SPECCHIO STORTO', x + fs * 0.08, y + fs * 0.08);
  c.fillStyle = '#FFD84D'; c.fillText('SPECCHIO STORTO', x, y);
  c.font = `600 ${Math.round(fs * 0.55)}px Archivo, sans-serif`;
  c.fillStyle = 'rgba(247,239,227,.9)';
  c.fillText(t('tag'), x, y + fs * 0.85);
  c.restore();
}

function drawOverlay(c, w, h){
  const o = S.overlay;
  if(!o || performance.now() > o.until) return;
  const fs = Math.round(w * (o.size || 0.13));
  c.save();
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `${fs}px Bungee, sans-serif`;
  const y = h * (o.y || 0.2);
  c.lineJoin = 'round';
  c.lineWidth = fs * 0.16;
  c.strokeStyle = '#140A1E';
  c.strokeText(o.text, w / 2, y);
  c.fillStyle = '#FF2D8A';
  c.fillText(o.text, w / 2 + fs * 0.06, y + fs * 0.06);
  c.fillStyle = o.color || '#FFD84D';
  c.fillText(o.text, w / 2, y);
  c.restore();
}

function compose(){
  cx.drawImage(cv, 0, 0, comp.width, comp.height);
  drawOverlay(cx, comp.width, comp.height);
  drawSign(cx, comp.width, comp.height);
}

function canvasBlob(c, type = 'image/jpeg', q = 0.92){
  return new Promise(res => c.toBlob(res, type, q));
}

async function makeThumb(src){
  const w = 240, h = 320;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const s = Math.max(w / src.width, h / src.height);
  const dw = src.width * s, dh = src.height * s;
  g.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return canvasBlob(c, 'image/jpeg', 0.8);
}

/* ============ piccoli effetti di scena ============ */
let hintTimer = 0;
function hint(text, ms = 2400){
  const h = $('hint');
  h.textContent = text; h.classList.add('on');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => h.classList.remove('on'), ms);
}

function banner(text){
  const b = $('banner');
  b.textContent = text;
  b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
}

function flash(){
  const f = $('flash');
  f.classList.remove('pop'); void f.offsetWidth; f.classList.add('pop');
}

async function countdown(n){
  const c = $('count');
  for(let i = n; i > 0; i--){
    c.textContent = i;
    c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
    sfx.tick(); vibrate(15);
    await sleep(900);
  }
}

function setBusy(b){
  S.busy = b;
  $('hud').classList.toggle('busy', b);
  $('top').style.visibility = b ? 'hidden' : '';
}

/* ============ specchi, colori, voci ============ */
const strip = $('strip');

function buildStrip(){
  const found = new Set(prefs.get('found', []));
  strip.innerHTML = '';
  EFFECTS.forEach((fx, i) => {
    const b = document.createElement('button');
    b.className = 'tick';
    b.innerHTML = `<span class="em" aria-hidden="true">${fx.emoji}</span>${t(fx.key)}`
                + (found.has(fx.key) ? '' : '<span class="new" aria-hidden="true"></span>');
    b.setAttribute('aria-pressed', i === S.fx);
    b.onclick = () => { selectFx(i); sfx.boing(); vibrate(8); };
    strip.appendChild(b);
  });
}

function selectFx(i, { announce = true } = {}){
  S.fx = i;
  prefs.set('fx', i);
  $('amount').value = Math.round(EFFECTS[i].k * 100);
  [...strip.children].forEach((el, j) => el.setAttribute('aria-pressed', i === j));
  const el = strip.children[i];
  if(el){
    el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    el.querySelector('.new')?.remove();
  }
  if(announce) banner(t(EFFECTS[i].key));
  discover(EFFECTS[i].key);
}

function discover(key){
  const { count, isNew } = markFound(key);
  if(isNew && count === EFFECTS.length){
    setTimeout(() => { hint(t('allFound'), 3500); sfx.tada(); }, 700);
  }
}

function selectColor(i, { announce = true } = {}){
  S.color = i;
  prefs.set('color', i);
  $('colorLbl').textContent = i ? t(COLORS[i].key) : '';
  $('colorBtn').firstChild.textContent = COLORS[i].emoji;
  if(announce) hint(COLORS[i].emoji + ' ' + t(COLORS[i].key), 1400);
}

function selectVoice(i, { announce = true } = {}){
  S.voice = i;
  prefs.set('voice', i);
  $('voiceBtn').firstChild.textContent = VOICE_ICONS[i];
  $('voiceLbl').textContent = i ? t(VOICES[i]).replace(/^(Voce|voice)\s*/i, '').replace(/\s*voice$/i, '') : '';
  if(announce) hint(VOICE_ICONS[i] + ' ' + t(VOICES[i]), 1400);
}

function randomFx(except){
  let i;
  do{ i = Math.floor(Math.random() * EFFECTS.length); }while(i === except && EFFECTS.length > 1);
  return i;
}

function surprise(){
  selectFx(randomFx(S.fx));
  selectColor(Math.random() < 0.55 ? 0 : 1 + Math.floor(Math.random() * (COLORS.length - 1)), { announce: false });
  sfx.whoosh(); vibrate([10, 40, 10]);
}

/* ============ gesti sullo schermo ============ */
const stage = $('stage');
const pts = new Map();
let pinch = null, lastTap = { t: 0, x: 0, y: 0 }, reticleTimer = 0;

function setCenter(x, y){
  const r = cv.getBoundingClientRect();
  const aspect = r.width / r.height;
  S.center = [((x - r.left) / r.width - 0.5) * aspect, 0.5 - (y - r.top) / r.height];
  const ret = $('reticle');
  ret.style.left = x + 'px'; ret.style.top = y + 'px';
  ret.classList.add('on');
  clearTimeout(reticleTimer);
  reticleTimer = setTimeout(() => ret.classList.remove('on'), 500);
}

function pinchDist(){
  const [a, b] = [...pts.values()];
  return Math.hypot(a.x - b.x, a.y - b.y) || 1;
}

stage.addEventListener('pointerdown', e => {
  if(!S.live) return;
  stage.setPointerCapture?.(e.pointerId);
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now() });
  if(pts.size === 2) pinch = { d: pinchDist(), k: +$('amount').value };
  else if(pts.size === 1) setCenter(e.clientX, e.clientY);
});

stage.addEventListener('pointermove', e => {
  const p = pts.get(e.pointerId);
  if(!p) return;
  p.x = e.clientX; p.y = e.clientY;
  if(pts.size >= 2 && pinch){
    $('amount').value = clamp(pinch.k * pinchDist() / pinch.d, 0, 100);
  } else if(pts.size === 1){
    setCenter(e.clientX, e.clientY);
  }
});

function pointerEnd(e){
  const p = pts.get(e.pointerId);
  if(!p) return;
  pts.delete(e.pointerId);
  if(pts.size < 2) pinch = null;
  const now = performance.now();
  const tap = now - p.t < 250 && Math.hypot(p.x - p.x0, p.y - p.y0) < 12;
  if(tap && pts.size === 0){
    if(now - lastTap.t < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 40 && !S.busy){
      surprise();
      lastTap.t = 0;
    } else {
      lastTap = { t: now, x: p.x, y: p.y };
    }
  }
}
stage.addEventListener('pointerup', pointerEnd);
stage.addEventListener('pointercancel', pointerEnd);

/* ============ scatti ============ */
async function takePhoto(){
  flash(); sfx.shutter(); vibrate(20);
  render();
  sizeComp(2200);
  compose();
  const blob = await canvasBlob(comp, 'image/jpeg', 0.92);
  if(!blob) return;
  const thumb = await makeThumb(comp);
  keep({ blob, thumb, type: blob.type });
}

/* ---- registrazione video ---- */
let rec = null, recChunks = [], recStart = 0, recTimer = 0, recLimit = MAX_VIDEO_MS, recThumb = null;

function pickMime(){
  if(!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
  const list = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a',
    'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return list.find(m => MediaRecorder.isTypeSupported(m)) || '';
}

async function startRec(limit = MAX_VIDEO_MS){
  if(rec) return false;
  if(!window.MediaRecorder || !comp.captureStream){ hint(t('errRec'), 3500); return false; }
  sizeComp(1280);
  render(); compose();
  recThumb = null;
  const vs = comp.captureStream(30);
  let as = null;
  try{
    as = await startRecordingAudio(VOICES[S.voice]);
  }catch(e){
    as = e.partial || null;
    hint(t('micDenied'), 3000);
  }
  const tracks = [...vs.getVideoTracks(), ...(as ? as.getAudioTracks() : [])];
  const mime = pickMime();
  try{
    rec = new MediaRecorder(new MediaStream(tracks),
      Object.assign({ videoBitsPerSecond: 6_000_000, audioBitsPerSecond: 128_000 }, mime ? { mimeType: mime } : {}));
  }catch(e){
    stopRecordingAudio(); releaseMic();
    hint(t('errRec'), 3500);
    return false;
  }
  recChunks = [];
  rec.ondataavailable = e => { if(e.data && e.data.size) recChunks.push(e.data); };
  rec.start(250);
  recStart = performance.now();
  recLimit = limit;
  $('recInfo').classList.add('on');
  $('shot').classList.add('rec');
  tickRec();
  return true;
}

function tickRec(){
  if(!rec) return;
  const el = performance.now() - recStart;
  const s = Math.floor(el / 1000);
  $('recTime').textContent = `0:${String(s).padStart(2, '0')}`;
  $('ring').setAttribute('stroke-dasharray', `${clamp(el / recLimit, 0, 1) * 100} 100`);
  if(!recThumb && el > 600) makeThumb(comp).then(b => recThumb = b);
  if(el >= recLimit && S.mode === 'foto'){ finishRec(); return; }
  recTimer = requestAnimationFrame(tickRec);
}

function stopRec(){
  return new Promise(res => {
    if(!rec){ res(null); return; }
    const r = rec;
    cancelAnimationFrame(recTimer);
    r.onstop = () => {
      const type = (r.mimeType || recChunks[0]?.type || 'video/webm').split(';')[0];
      res(recChunks.length ? new Blob(recChunks, { type }) : null);
    };
    try{ r.stop(); }catch(e){ res(null); }
    rec = null;
    stopRecordingAudio(); releaseMic();
    $('recInfo').classList.remove('on');
    $('shot').classList.remove('rec');
    $('ring').setAttribute('stroke-dasharray', '0 100');
  });
}

async function finishRec(){
  const tooShort = performance.now() - recStart < 700;
  const blob = await stopRec();
  if(!blob || tooShort){ if(tooShort) hint(t('hint_foto')); return; }
  const thumb = recThumb || await makeThumb(comp);
  keep({ blob, thumb, type: blob.type });
}

/* ---- modalità GIOSTRA: uno specchio diverso a ogni battito ---- */
async function runGiostra(){
  setBusy(true);
  await countdown(3);
  const ok = await startRec(10000);
  if(!ok){ setBusy(false); return; }
  let cur = S.fx;
  const end = performance.now() + 10000;
  while(performance.now() < end && rec){
    cur = randomFx(cur);
    S.fxOverride = cur;
    $('amount').value = Math.round(EFFECTS[cur].k * 100);
    const name = t(EFFECTS[cur].key).toUpperCase();
    banner(name);
    S.overlay = { text: name, until: performance.now() + 900, y: 0.24, size: 0.11 };
    discover(EFFECTS[cur].key);
    sfx.ding(); vibrate(12);
    await sleep(1250);
  }
  S.overlay = null;
  await finishRec();
  S.fxOverride = null;
  $('amount').value = Math.round(EFFECTS[S.fx].k * 100);
  setBusy(false);
}

/* ---- modalità RIVELA: parte irriconoscibile, poi si svela ---- */
async function runRivela(){
  setBusy(true);
  S.kOverride = 1;
  await countdown(3);
  const ok = await startRec(8000);
  if(!ok){ S.kOverride = null; setBusy(false); return; }
  const start = performance.now();
  S.overlay = { text: t('who'), until: start + 2600, y: 0.2 };
  banner(t('who'));
  let lastBeat = 0, tadaDone = false;
  while(rec){
    const e = performance.now() - start;
    if(e < 2600){
      S.kOverride = 1;
      if(e - lastBeat > 330){ sfx.tick(); lastBeat = e; }
    } else if(e < 6200){
      const x = (e - 2600) / 3600;
      S.kOverride = 1 - x * x * (3 - 2 * x);
      if(e - lastBeat > 200 - x * 120){ sfx.tick(); lastBeat = e; }
    } else {
      S.kOverride = 0;
      if(!tadaDone){
        tadaDone = true; sfx.tada(); vibrate([20, 30, 60]);
        S.overlay = { text: t('surprise'), until: start + 8000, y: 0.2, color: '#35E0E8' };
        banner(t('surprise'));
      }
    }
    if(e >= 8000) break;
    await sleep(30);
  }
  S.overlay = null;
  await finishRec();
  S.kOverride = null;
  setBusy(false);
}

/* ---- modalità CABINA: quattro pose, una striscia da fototessera ---- */
async function runCabina(){
  setBusy(true);
  const shots = [];
  let cur = S.fx;
  for(let i = 0; i < 4; i++){
    if(i > 0) cur = randomFx(cur);
    S.fxOverride = cur;
    $('amount').value = Math.round(EFFECTS[cur].k * 100);
    banner(t(EFFECTS[cur].key));
    discover(EFFECTS[cur].key);
    await sleep(500);
    await countdown(i === 0 ? 3 : 2);
    render();
    flash(); sfx.shutter(); vibrate(20);
    const fw = 540, fh = 720;
    const f = document.createElement('canvas');
    f.width = fw; f.height = fh;
    const g = f.getContext('2d');
    const s = Math.max(fw / cv.width, fh / cv.height);
    g.drawImage(cv, (fw - cv.width * s) / 2, (fh - cv.height * s) / 2, cv.width * s, cv.height * s);
    shots.push({ canvas: f, name: t(EFFECTS[cur].key) });
    await sleep(350);
  }
  S.fxOverride = null;
  $('amount').value = Math.round(EFFECTS[S.fx].k * 100);
  sfx.tada();
  const stripC = drawBoothStrip(shots);
  const blob = await canvasBlob(stripC, 'image/jpeg', 0.92);
  setBusy(false);
  if(!blob) return;
  const thumb = await makeThumb(shots[0].canvas);
  keep({ blob, thumb, type: blob.type });
}

function drawBoothStrip(shots){
  const fw = 540, fh = 720, pad = 40, gap = 26, head = 170, foot = 130;
  const W = fw + pad * 2, H = head + shots.length * fh + (shots.length - 1) * gap + foot;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#F7EFE3';
  g.fillRect(0, 0, W, H);
  // bordo dentellato da biglietto
  g.fillStyle = '#140A1E';
  for(let y = 14; y < H; y += 28){
    g.beginPath(); g.arc(0, y, 8, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(W, y, 8, 0, Math.PI * 2); g.fill();
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '58px Bungee, sans-serif';
  g.fillStyle = '#FF2D8A'; g.fillText('SPECCHIO', W / 2 + 4, 66 + 4);
  g.fillStyle = '#140A1E'; g.fillText('SPECCHIO', W / 2, 66);
  g.fillStyle = '#FFD84D'; g.fillText('STORTO', W / 2 + 4, 126 + 4);
  g.fillStyle = '#FF2D8A'; g.fillText('STORTO', W / 2, 126);
  shots.forEach((s, i) => {
    const y = head + i * (fh + gap);
    g.fillStyle = '#140A1E';
    g.fillRect(pad - 6, y - 6, fw + 12, fh + 12);
    g.drawImage(s.canvas, pad, y, fw, fh);
    g.save();
    g.translate(pad + 18, y + fh - 22);
    g.rotate(-0.06);
    g.font = '26px Bungee, sans-serif';
    g.textAlign = 'left';
    const tw = g.measureText(s.name).width;
    g.fillStyle = '#FFD84D';
    g.fillRect(-10, -22, tw + 20, 42);
    g.fillStyle = '#140A1E';
    g.fillText(s.name, 0, 0);
    g.restore();
  });
  const d = new Date();
  g.fillStyle = '#140A1E';
  g.font = '600 24px Archivo, sans-serif';
  g.fillText(d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }), W / 2, H - foot / 2 - 16);
  g.font = '800 22px Archivo, sans-serif';
  g.fillStyle = '#FF2D8A';
  g.fillText(t('tag'), W / 2, H - foot / 2 + 20);
  return c;
}

/* ============ pulsante di scatto ============ */
const shot = $('shot');
let holdTimer = 0, holding = false, pressing = false;

shot.addEventListener('pointerdown', e => {
  e.preventDefault();
  if(!S.live || S.busy) return;
  audio();
  if(S.mode !== 'foto') return;
  shot.setPointerCapture?.(e.pointerId);
  pressing = true;
  holdTimer = setTimeout(async () => {
    holdTimer = 0;
    holding = true;
    vibrate(30);
    const ok = await startRec(MAX_VIDEO_MS);
    if(ok && !pressing) finishRec();       // dito già alzato mentre chiedeva il microfono
    if(!ok) holding = false;
  }, 330);
});

function shotUp(){
  if(!pressing) return;
  pressing = false;
  if(holdTimer){ clearTimeout(holdTimer); holdTimer = 0; takePhoto(); return; }
  if(holding){ holding = false; if(rec) finishRec(); }
}
shot.addEventListener('pointerup', shotUp);
shot.addEventListener('pointercancel', shotUp);
shot.addEventListener('contextmenu', e => e.preventDefault());

shot.addEventListener('click', () => {
  if(!S.live || S.busy) return;
  if(S.mode === 'giostra') runGiostra();
  else if(S.mode === 'rivela') runRivela();
  else if(S.mode === 'cabina') runCabina();
});
shot.addEventListener('keydown', e => {
  if(S.mode === 'foto' && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); takePhoto(); }
});

/* ============ modalità ============ */
document.querySelectorAll('.mode').forEach(b => b.onclick = () => {
  if(S.busy) return;
  S.mode = b.dataset.mode;
  document.querySelectorAll('.mode').forEach(x => x.setAttribute('aria-pressed', x === b));
  shot.dataset.mode = S.mode;
  hint(t('hint_' + S.mode));
  sfx.click(); vibrate(6);
});

/* ============ anteprima, album ============ */
let sheetItem = null, sheetURL = null;

async function keep(item){
  const id = await addItem(item);
  item.id = id;
  updateAlbumBtn(item.thumb);
  openSheet(item);
}

function openSheet(item){
  sheetItem = item;
  const m = $('sheetMedia');
  m.innerHTML = '';
  if(sheetURL) URL.revokeObjectURL(sheetURL);
  sheetURL = URL.createObjectURL(item.blob);
  if(item.type.startsWith('video')){
    const v = document.createElement('video');
    v.src = sheetURL; v.playsInline = true; v.loop = true; v.controls = true; v.autoplay = true;
    v.setAttribute('playsinline', '');
    m.appendChild(v);
    v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
  } else {
    const img = document.createElement('img');
    img.src = sheetURL; img.alt = '';
    m.appendChild(img);
  }
  $('delBtn').style.display = item.id != null ? '' : 'none';
  $('sheet').classList.add('on');
  S.paused = true;
}

function closeSheet(){
  $('sheet').classList.remove('on');
  $('sheetMedia').innerHTML = '';
  if(sheetURL){ URL.revokeObjectURL(sheetURL); sheetURL = null; }
  sheetItem = null;
  S.paused = $('albumPanel').classList.contains('on');
}

$('closeBtn').onclick = closeSheet;
$('shareBtn').onclick = async () => {
  if(!sheetItem) return;
  try{
    const r = await shareBlob(sheetItem.blob, fileName(sheetItem.type), t('tag') + ' 🪞');
    if(r === 'downloaded') hint(t('shareFail'));
  }catch(e){ hint(String(e.message || e)); }
};
$('saveBtn').onclick = async () => {
  if(!sheetItem) return;
  try{
    const where = await saveBlob(sheetItem.blob, fileName(sheetItem.type));
    hint(where ? t('savedIn', where) : t('saved'));
    vibrate(15);
  }catch(e){ hint(String(e.message || e)); }
};
$('delBtn').onclick = async () => {
  if(!sheetItem || sheetItem.id == null) return;
  await deleteItem(sheetItem.id);
  closeSheet();
  refreshAlbum();
};

let albumURLs = [];
async function refreshAlbum(){
  const items = await listItems();
  albumURLs.forEach(u => URL.revokeObjectURL(u));
  albumURLs = [];
  const grid = $('grid');
  grid.innerHTML = '';
  if(!items.length){
    grid.innerHTML = `<p class="empty">${t('albumEmpty')}</p>`;
  }
  items.forEach(it => {
    const b = document.createElement('button');
    const u = URL.createObjectURL(it.thumb);
    albumURLs.push(u);
    b.innerHTML = `<img src="${u}" alt="">` + (it.type.startsWith('video') ? '<span class="play">▶</span>' : '');
    b.onclick = () => openSheet(it);
    grid.appendChild(b);
  });
  updateAlbumBtn(items[0]?.thumb);
}

function updateAlbumBtn(thumb){
  const b = $('albumBtn');
  if(!thumb){ b.textContent = '🖼️'; return; }
  const img = document.createElement('img');
  img.src = URL.createObjectURL(thumb);
  img.alt = '';
  img.onload = () => setTimeout(() => URL.revokeObjectURL(img.src), 1000);
  b.innerHTML = '';
  b.appendChild(img);
}

$('albumBtn').onclick = async () => {
  await refreshAlbum();
  $('albumPanel').classList.add('on');
  S.paused = true;
};
$('albumClose').onclick = () => {
  $('albumPanel').classList.remove('on');
  S.paused = $('sheet').classList.contains('on');
};

/* ============ barra in alto ============ */
$('colorBtn').onclick = () => { selectColor((S.color + 1) % COLORS.length); sfx.click(); vibrate(6); };
$('voiceBtn').onclick = () => { selectVoice((S.voice + 1) % VOICES.length); sfx.click(); vibrate(6); };
$('diceBtn').onclick = () => { if(!S.busy) surprise(); };
$('flip').onclick = async () => {
  if(S.busy || rec) return;
  S.front = !S.front;
  S.center = [0, 0];
  sfx.whoosh();
  try{ await openCamera(); }catch(e){}
};

/* ============ ciclo di vita ============ */
document.addEventListener('visibilitychange', async () => {
  if(!S.live) return;
  if(document.hidden){
    if(rec) await finishRec();
    closeCamera();
  } else {
    try{ await openCamera(); }catch(e){}
  }
});

/* ============ ingresso ============ */
const daily = dailyPick(EFFECTS.length, COLORS.length);
$('dailyName').textContent = `${EFFECTS[daily.effect].emoji} ${t(EFFECTS[daily.effect].key)} + ${t(COLORS[daily.color].key)}`;
$('streak').textContent = t('streak', touchStreak());
$('found').textContent = t('found', foundCount(), EFFECTS.length);

async function enter(pick){
  audio();
  try{
    if(!build()) return;
  }catch(e){ fail(t('errWebgl') + ' ' + e.message); return; }
  resize();
  try{
    await openCamera();
  }catch(e){ return; }
  if(document.fonts?.load){ document.fonts.load('40px Bungee').catch(() => {}); }
  const g = $('gate');
  g.classList.add('out');
  setTimeout(() => g.style.display = 'none', 450);
  $('hud').classList.add('on');
  $('top').classList.add('on');
  resize();
  buildStrip();
  if(pick){ selectFx(pick.effect); selectColor(pick.color, { announce: false }); }
  else { selectFx(S.fx); selectColor(S.color, { announce: false }); }
  selectVoice(S.voice, { announce: false });
  S.live = true;
  sfx.boing();
  refreshAlbum();
  const seen = prefs.get('hints', 0);
  if(seen < 4){ prefs.set('hints', seen + 1); setTimeout(() => hint(t('hint_drag'), 4500), 1300); }
  if(!loopStarted){ loopStarted = true; loop(); }
}
let loopStarted = false;

$('enter').onclick = () => enter();
$('daily').onclick = () => enter(daily);

/* ============ installazione e uso offline (solo sito web) ============ */
if('serviceWorker' in navigator && !isNative && location.protocol === 'https:'){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

/* per i test automatici */
window.__specchio = { S, EFFECTS, COLORS, selectFx, selectColor, takePhoto, surprise };
