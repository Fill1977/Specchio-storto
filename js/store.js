/* Album (IndexedDB) e piccole statistiche (localStorage).
   Tutto resta sul dispositivo. */

const DB = 'specchio-storto', STORE = 'album', MAX_ITEMS = 60;
let dbp = null;

function db(){
  if(!dbp){
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}

function tx(mode, fn){
  return db().then(d => new Promise((res, rej) => {
    const t = d.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out && 'result' in out ? out.result : out);
    t.onerror = () => rej(t.error);
  }));
}

export async function addItem(item){
  try{
    const id = await tx('readwrite', s => s.add({ ...item, created: Date.now() }));
    const all = await listItems();
    if(all.length > MAX_ITEMS){
      await tx('readwrite', s => all.slice(MAX_ITEMS).forEach(x => s.delete(x.id)));
    }
    return id;
  }catch(e){ return null; }
}

export async function listItems(){
  try{
    const all = await tx('readonly', s => s.getAll());
    return (all || []).sort((a, b) => b.created - a.created);
  }catch(e){ return []; }
}

export function deleteItem(id){
  return tx('readwrite', s => s.delete(id)).catch(() => {});
}

/* ---------- statistiche ---------- */

function read(k, d){ try{ const v = localStorage.getItem('ss.' + k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } }
function write(k, v){ try{ localStorage.setItem('ss.' + k, JSON.stringify(v)); }catch(e){} }

export const prefs = {
  get: read,
  set: write
};

export function markFound(key){
  const s = new Set(read('found', []));
  const before = s.size;
  s.add(key);
  write('found', [...s]);
  return { count: s.size, isNew: s.size > before };
}

export function foundCount(){ return read('found', []).length; }

function dayStr(d){ return d.toISOString().slice(0, 10); }

/* Giorni consecutivi di visita. */
export function touchStreak(){
  const today = dayStr(new Date());
  const yesterday = dayStr(new Date(Date.now() - 864e5));
  const last = read('lastDay', null);
  let n = read('streak', 0);
  if(last === today) return n;
  n = last === yesterday ? n + 1 : 1;
  write('lastDay', today); write('streak', n);
  return n;
}

/* Lo stesso giorno, lo stesso specchio per tutti: si può sfidare gli amici. */
export function dailyPick(nEffects, nColors){
  const d = new Date();
  let h = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate();
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  return { effect: h % nEffects, color: 1 + ((h >>> 8) % (nColors - 1)) };
}
