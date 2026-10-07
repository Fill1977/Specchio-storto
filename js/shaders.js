/* Specchio Storto — shader WebGL
   Ogni "specchio" è una deformazione delle coordinate (warp) applicata
   prima di leggere il fotogramma della fotocamera. I filtri colore
   lavorano dopo, sul colore letto. */

export const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

export const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2  uCover;      // correzione riempimento schermo
uniform float uAspect;     // proporzione del canvas
uniform float uTime;
uniform float uK;          // intensità 0..1
uniform int   uMode;       // specchio
uniform int   uColor;      // filtro colore
uniform float uMirror;     // fotocamera frontale: immagine specchiata
uniform vec2  uCenter;     // centro della deformazione (spostabile col dito)
uniform vec2  uTexel;      // 1 / dimensione del video

const float TAU = 6.2831853;

vec2 warp(vec2 p, float k){
  float r = length(p);
  float a = atan(p.y, p.x);

  if(uMode == 0){                       // BOMBATO — lente da pesce
    float R = 0.8;
    if(r > 0.0005 && r < R){
      float nr = pow(r / R, 1.0 + k * 1.8) * R;
      p = p / r * nr;
    }
  } else if(uMode == 1){                // RISUCCHIO — pinch
    float R = 0.9;
    if(r > 0.0005 && r < R){
      float nr = pow(r / R, 1.0 / (1.0 + k * 1.6)) * R;
      p = p / r * nr;
    }
  } else if(uMode == 2){                // VORTICE
    float t = 1.0 - clamp(r / 0.75, 0.0, 1.0);
    a += k * 4.0 * t * t;
    p = vec2(cos(a), sin(a)) * r;
  } else if(uMode == 3){                // ONDE
    p.x += sin(p.y * 26.0 + uTime * 2.2) * 0.05 * k;
    p.y += cos(p.x * 22.0 + uTime * 1.7) * 0.05 * k;
  } else if(uMode == 4){                // FISARMONICA — alto/basso che respira
    float w = sin(uTime * 1.1);
    p.y *= mix(1.0, 0.45 + w * 0.25, k);
    p.x *= mix(1.0, 1.55 - w * 0.3, k);
  } else if(uMode == 5){                // GEMELLO — specchio verticale
    p.x = mix(p.x, abs(p.x) * sign(sin(uTime * 0.4) + 0.001), k);
  } else if(uMode == 6){                // MOSAICO
    float n = mix(160.0, 9.0, k);
    p = floor(p * n) / n;
  } else if(uMode == 7){                // SCOSSA — glitch a fasce
    float band = floor(p.y * 14.0);
    float j = fract(sin(band * 91.7 + floor(uTime * 9.0) * 13.3) * 43758.5453);
    p.x += (j - 0.5) * 0.22 * k * step(0.55, j);
  } else if(uMode == 8){                // TESTONE — testa enorme, corpo piccolo
    float R = 0.42;
    if(r > 0.0005){
      float nr = r < R
        ? pow(r / R, 1.0 + k * 1.6) * R
        : R + (r - R) * (1.0 + k * 1.4);
      p = p / r * nr;
    }
  } else if(uMode == 9){                // GIRAFFA — collo infinito
    p.y *= mix(1.0, 0.32, k * exp(-p.y * p.y * 4.0));
  } else if(uMode == 10){               // LARGONE — faccia a pizza
    p.x *= mix(1.0, 0.38, k * exp(-p.x * p.x * 5.0));
  } else if(uMode == 11){               // CALEIDOSCOPIO
    float n = floor(mix(3.0, 12.0, k) + 0.5);
    float seg = TAU / n;
    float aa = mod(a + uTime * 0.15, seg);
    aa = abs(aa - seg * 0.5);
    p = vec2(cos(aa), sin(aa)) * r * 0.9;
  } else if(uMode == 12){               // FOLLA — tanti cloni
    float n = 1.0 + floor(k * 3.999);
    vec2 q = vec2(p.x / uAspect, p.y);
    q = fract(q * n + 0.5) - 0.5;
    p = vec2(q.x * uAspect, q.y);
  } else if(uMode == 13){               // SCIOLTO — la faccia cola
    float drip = 0.55 + 0.45 * sin(p.x * 11.0 + sin(p.x * 5.0 + uTime * 0.7) * 2.0);
    float w = clamp(0.55 - p.y, 0.0, 1.2);
    p.y += k * 0.32 * drip * w * (0.85 + 0.15 * sin(uTime * 1.3));
  } else if(uMode == 14){               // BUCO NERO
    float t = 1.0 - clamp(r / 0.9, 0.0, 1.0);
    a += k * (3.0 + sin(uTime * 0.8)) * t * t;
    float nr = r * (1.0 + k * 1.8 * t * t);
    p = vec2(cos(a), sin(a)) * nr;
  } else if(uMode == 15){               // GELATINA — tremola tutto
    float s = 1.0 + k * 0.16 * sin(uTime * 7.0 - r * 12.0);
    p *= s;
    p.x += sin(p.y * 5.0 + uTime * 5.0) * 0.035 * k;
  }
  return p;
}

vec2 toTex(vec2 p){
  vec2 uv = p + 0.5;
  uv = (uv - 0.5) * uCover + 0.5;
  if(uMirror > 0.5) uv.x = 1.0 - uv.x;
  return uv;
}

float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }

vec3 hue(vec3 c, float h){
  const vec3 k = vec3(0.57735);
  float ca = cos(h);
  return c * ca + cross(k, c) * sin(h) + k * dot(k, c) * (1.0 - ca);
}

float edge(vec2 uv){
  vec2 d = uTexel * 1.5;
  float l = luma(texture2D(uTex, uv - vec2(d.x, 0.0)).rgb);
  float rr = luma(texture2D(uTex, uv + vec2(d.x, 0.0)).rgb);
  float u = luma(texture2D(uTex, uv + vec2(0.0, d.y)).rgb);
  float b = luma(texture2D(uTex, uv - vec2(0.0, d.y)).rgb);
  return length(vec2(rr - l, u - b));
}

vec3 thermal(float t){
  vec3 c1 = vec3(0.05, 0.0, 0.25);
  vec3 c2 = vec3(0.55, 0.0, 0.7);
  vec3 c3 = vec3(1.0, 0.2, 0.2);
  vec3 c4 = vec3(1.0, 0.85, 0.1);
  vec3 c5 = vec3(1.0, 1.0, 0.95);
  if(t < 0.25) return mix(c1, c2, t / 0.25);
  if(t < 0.5)  return mix(c2, c3, (t - 0.25) / 0.25);
  if(t < 0.75) return mix(c3, c4, (t - 0.5) / 0.25);
  return mix(c4, c5, (t - 0.75) / 0.25);
}

void main(){
  vec2 p = vUv - 0.5;
  p.x *= uAspect;
  p = warp(p - uCenter, uK) + uCenter;
  p.x /= uAspect;

  vec2 uv = toTex(p);
  vec3 col;
  if(uMode == 7){                       // separazione RGB sulla scossa
    float s = 0.012 * uK;
    col.r = texture2D(uTex, toTex(p + vec2( s, 0.0))).r;
    col.g = texture2D(uTex, uv).g;
    col.b = texture2D(uTex, toTex(p - vec2( s, 0.0))).b;
  } else {
    col = texture2D(uTex, uv).rgb;
  }

  if(uColor == 1){                      // FUMETTO
    vec3 q = floor(col * 5.0 + 0.5) / 5.0;
    float e = edge(uv);
    col = mix(q * 1.08, vec3(0.08, 0.04, 0.12), smoothstep(0.12, 0.28, e));
  } else if(uColor == 2){               // TERMICO
    col = thermal(clamp(luma(col) * 1.1, 0.0, 1.0));
  } else if(uColor == 3){               // NEON
    float e = smoothstep(0.05, 0.25, edge(uv));
    vec3 tint = 0.5 + 0.5 * cos(TAU * (vec3(0.0, 0.33, 0.67) + uv.y + uTime * 0.2));
    col = col * 0.12 + tint * e * 1.4;
  } else if(uColor == 4){               // LUNA PARK — seppia e grana
    float l = luma(col);
    col = vec3(l * 1.08, l * 0.9, l * 0.7) + vec3(0.06, 0.03, 0.0);
    float g = fract(sin(dot(vUv * 913.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
    col += (g - 0.5) * 0.08;
    vec2 v = vUv - 0.5;
    col *= 1.0 - dot(v, v) * 1.3;
  } else if(uColor == 5){               // ACIDO
    col = hue(col, uTime * 1.5 + uv.y * 3.0);
    col = mix(vec3(luma(col)), col, 1.9);
  } else if(uColor == 6){               // NOIR
    float l = luma(col);
    l = smoothstep(0.18, 0.82, l);
    col = vec3(l);
  }

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

/* id = indice nello shader; k = intensità consigliata (0..1) */
export const EFFECTS = [
  { id: 8,  key: 'testone',      emoji: '🎃', k: 0.7 },
  { id: 0,  key: 'bombato',      emoji: '🐡', k: 0.6 },
  { id: 1,  key: 'risucchio',    emoji: '🫠', k: 0.6 },
  { id: 9,  key: 'giraffa',      emoji: '🦒', k: 0.75 },
  { id: 10, key: 'largone',      emoji: '🍕', k: 0.75 },
  { id: 2,  key: 'vortice',      emoji: '🌀', k: 0.6 },
  { id: 14, key: 'buconero',     emoji: '🕳️', k: 0.6 },
  { id: 13, key: 'sciolto',      emoji: '🍦', k: 0.6 },
  { id: 15, key: 'gelatina',     emoji: '🍮', k: 0.6 },
  { id: 3,  key: 'onde',         emoji: '🌊', k: 0.6 },
  { id: 4,  key: 'fisarmonica',  emoji: '🪗', k: 0.6 },
  { id: 5,  key: 'gemello',      emoji: '👯', k: 1.0 },
  { id: 12, key: 'folla',        emoji: '👥', k: 0.5 },
  { id: 11, key: 'caleido',      emoji: '🔮', k: 0.35 },
  { id: 6,  key: 'mosaico',      emoji: '🧩', k: 0.6 },
  { id: 7,  key: 'scossa',       emoji: '⚡', k: 0.6 }
];

export const COLORS = [
  { id: 0, key: 'c_naturale', emoji: '🎨' },
  { id: 1, key: 'c_fumetto',  emoji: '💥' },
  { id: 2, key: 'c_termico',  emoji: '🔥' },
  { id: 3, key: 'c_neon',     emoji: '🌈' },
  { id: 4, key: 'c_lunapark', emoji: '🎡' },
  { id: 5, key: 'c_acido',    emoji: '🧪' },
  { id: 6, key: 'c_noir',     emoji: '🎩' }
];
