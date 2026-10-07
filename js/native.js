/* Condividi e salva: nell'app Android passa dai plugin nativi di Capacitor,
   nel browser usa Web Share e il download classico. */

const Cap = window.Capacitor;
export const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());

/* I plugin si creano solo quando servono: un problema qui non deve mai
   bloccare l'avvio dell'app. Se manca registerPlugin si parla col ponte nativo. */
function plugin(name){
  if(typeof Cap.registerPlugin === 'function') return Cap.registerPlugin(name);
  return new Proxy({}, { get: (_, method) => opts => Cap.nativePromise(name, method, opts) });
}
let fs = null, sh = null;
const Filesystem = () => fs || (fs = plugin('Filesystem'));
const Share = () => sh || (sh = plugin('Share'));

function toBase64(blob){
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

export function fileName(type){
  const ext = type.includes('mp4') ? 'mp4' : type.includes('webm') ? 'webm'
            : type.includes('jpeg') ? 'jpg' : 'png';
  const d = new Date();
  const stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0')
              + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0')
              + String(d.getSeconds()).padStart(2, '0');
  return `specchio-storto-${stamp}.${ext}`;
}

function download(blob, name){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 8000);
}

/* Ritorna 'shared' | 'cancelled' | 'downloaded' */
export async function shareBlob(blob, name, text){
  if(isNative){
    const data = await toBase64(blob);
    const w = await Filesystem().writeFile({ path: name, data, directory: 'CACHE' });
    try{
      await Share().share({ title: 'Specchio Storto', text, files: [w.uri], dialogTitle: 'Specchio Storto' });
      return 'shared';
    }catch(e){
      return /cancel/i.test(e && e.message || '') ? 'cancelled' : Promise.reject(e);
    }
  }
  const file = new File([blob], name, { type: blob.type });
  if(navigator.canShare && navigator.canShare({ files: [file] })){
    try{
      await navigator.share({ files: [file], text });
      return 'shared';
    }catch(e){
      if(e.name === 'AbortError') return 'cancelled';
    }
  }
  download(blob, name);
  return 'downloaded';
}

/* Ritorna il percorso leggibile dove è finito il file, o null nel browser. */
export async function saveBlob(blob, name){
  if(isNative){
    const data = await toBase64(blob);
    await Filesystem().writeFile({
      path: 'SpecchioStorto/' + name, data, directory: 'DOCUMENTS', recursive: true
    });
    return 'Documents/SpecchioStorto';
  }
  download(blob, name);
  return null;
}

export function vibrate(ms){
  try{ navigator.vibrate && navigator.vibrate(ms); }catch(e){}
}
