/* Suoni del luna park e "voce storta".
   Tutto sintetizzato con Web Audio: nessun file audio da scaricare. */

export const VOICES = ['v_normale', 'v_elio', 'v_orco', 'v_robot', 'v_eco', 'v_muto'];

let ctx = null;
let recDest = null;          // destinazione che finisce nel video registrato
let micStream = null;
let micChain = null;         // { source, out, stop }

export function audio(){
  if(!ctx){
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    ctx = new AC();
  }
  if(ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/* Ogni suono va alle casse e, se stiamo registrando, anche nel video. */
function outs(){
  const list = [ctx.destination];
  if(recDest) list.push(recDest);
  return list;
}

function tone({ type = 'sine', f0, f1 = f0, dur = 0.15, vol = 0.2, at = 0 }){
  const c = audio(); if(!c) return;
  const t = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  outs().forEach(d => g.connect(d));
  o.start(t); o.stop(t + dur + 0.05);
}

let muted = false;
export function setMuted(m){ muted = m; }

export const sfx = {
  boing(){ if(muted) return; tone({ type: 'triangle', f0: 180, f1: 620, dur: 0.18, vol: 0.18 });
           tone({ type: 'sine', f0: 620, f1: 240, dur: 0.22, vol: 0.12, at: 0.12 }); },
  click(){ if(muted) return; tone({ type: 'square', f0: 1800, f1: 600, dur: 0.05, vol: 0.06 }); },
  ding(){ if(muted) return; tone({ type: 'sine', f0: 1320, dur: 0.35, vol: 0.18 });
          tone({ type: 'sine', f0: 1980, dur: 0.25, vol: 0.07 }); },
  tick(){ if(muted) return; tone({ type: 'square', f0: 880, f1: 860, dur: 0.07, vol: 0.08 }); },
  shutter(){ if(muted) return; tone({ type: 'sawtooth', f0: 3000, f1: 200, dur: 0.09, vol: 0.08 }); },
  tada(){ if(muted) return; [523, 659, 784, 1047].forEach((f, i) =>
           tone({ type: 'triangle', f0: f, dur: 0.3, vol: 0.13, at: i * 0.09 })); },
  whoosh(){ if(muted) return; tone({ type: 'sawtooth', f0: 90, f1: 900, dur: 0.6, vol: 0.05 }); }
};

/* ---------- voce storta ---------- */

/* Pitch shifter a due linee di ritardo: il tempo di ritardo scorre a dente
   di sega, due finestre di Hann sfasate di mezzo periodo nascondono il salto. */
function pitchShifter(c, input, ratio){
  const W = 0.08;                                  // finestra in secondi
  const f = Math.abs(ratio - 1) / W;               // frequenza della sega
  const N = 32;
  const sawR = new Float32Array(N), sawI = new Float32Array(N);
  for(let n = 1; n < N; n++) sawI[n] = -2 / (Math.PI * n);   // sega -1 → 1
  const hanR = new Float32Array(2), hanI = new Float32Array(2);
  hanR[1] = -0.5;                                            // 0.5 - 0.5cos
  const saw = c.createPeriodicWave(sawR, sawI, { disableNormalization: true });
  const han = c.createPeriodicWave(hanR, hanI, { disableNormalization: true });

  const out = c.createGain();
  const nodes = [];
  const start = c.currentTime + 0.02;
  for(let i = 0; i < 2; i++){
    const d = c.createDelay(1);
    d.delayTime.value = W / 2;
    const mod = c.createOscillator(); mod.setPeriodicWave(saw); mod.frequency.value = f;
    const depth = c.createGain(); depth.gain.value = ratio > 1 ? -W / 2 : W / 2;
    mod.connect(depth).connect(d.delayTime);

    const win = c.createOscillator(); win.setPeriodicWave(han); win.frequency.value = f;
    const amp = c.createGain(); amp.gain.value = 0.5;
    win.connect(amp.gain);

    input.connect(d).connect(amp).connect(out);
    const t = start + i * (0.5 / f);
    mod.start(t); win.start(t);
    nodes.push(mod, win);
  }
  return { out, stop: () => nodes.forEach(n => { try{ n.stop(); }catch(e){} }) };
}

function robot(c, input){
  const ring = c.createGain(); ring.gain.value = 0;
  const lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 55;
  lfo.connect(ring.gain);
  input.connect(ring);
  const shaper = c.createBiquadFilter(); shaper.type = 'bandpass'; shaper.frequency.value = 1400; shaper.Q.value = 0.8;
  const mix = c.createGain(); mix.gain.value = 1.6;
  ring.connect(shaper).connect(mix);
  lfo.start();
  return { out: mix, stop: () => { try{ lfo.stop(); }catch(e){} } };
}

function echo(c, input){
  const out = c.createGain();
  const d = c.createDelay(1); d.delayTime.value = 0.23;
  const fb = c.createGain(); fb.gain.value = 0.45;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2500;
  input.connect(out);
  input.connect(d); d.connect(lp).connect(fb).connect(d);
  lp.connect(out);
  return { out, stop: () => {} };
}

export async function getMic(){
  if(micStream && micStream.getAudioTracks().some(t => t.readyState === 'live')) return micStream;
  micStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true }, video: false
  });
  return micStream;
}

/* Prepara la traccia audio del video: microfono con effetto + effetti sonori. */
export async function startRecordingAudio(voice){
  const c = audio(); if(!c) return null;
  recDest = c.createMediaStreamDestination();
  if(voice !== 'v_muto'){
    try{
      const ms = await getMic();
      const source = c.createMediaStreamSource(ms);
      let chain;
      if(voice === 'v_elio') chain = pitchShifter(c, source, 1.7);
      else if(voice === 'v_orco') chain = pitchShifter(c, source, 0.62);
      else if(voice === 'v_robot') chain = robot(c, source);
      else if(voice === 'v_eco') chain = echo(c, source);
      else chain = { out: source, stop: () => {} };
      chain.out.connect(recDest);
      micChain = { source, ...chain };
    }catch(e){
      micChain = null;
      throw Object.assign(new Error('mic'), { partial: recDest.stream });
    }
  }
  return recDest.stream;
}

export function stopRecordingAudio(){
  if(micChain){
    try{ micChain.out.disconnect(); }catch(e){}
    try{ micChain.source.disconnect(); }catch(e){}
    micChain.stop();
    micChain = null;
  }
  recDest = null;
}

/* Il microfono si spegne quando non serve, così l'icona della privacy sparisce. */
export function releaseMic(){
  if(micStream){ micStream.getTracks().forEach(t => t.stop()); micStream = null; }
}
