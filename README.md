# 🪞 Specchio Storto

**La sala degli specchi del luna park, dentro il telefono.**
Sedici specchi deformanti in tempo reale, video con la "voce storta", la Giostra, la Rivelazione e la Cabina fototessera.
Tutto gira sul dispositivo: niente account, niente server, niente dati raccolti.

## Cosa fa

| | |
|---|---|
| **16 specchi** | Testone, Bombato, Risucchio, Giraffa, Largone, Vortice, Buco nero, Sciolto, Gelatina, Onde, Fisarmonica, Gemello, Folla, Caleido, Mosaico, Scossa |
| **7 filtri colore** | Naturale, Fumetto, Termico, Neon, Luna park, Acido, Noir. Si combinano con tutti gli specchi (112 combinazioni) |
| **Il dito comanda** | Trascina per spostare il centro della deformazione (per esempio sul naso dell'amico), pizzica con due dita per l'intensità, doppio tocco per uno specchio a sorpresa |
| **Foto e video** | Tocca per la foto, tieni premuto per il video (fino a 15 s) |
| **Voce storta** | Nei video: voce elio, orco, robot, eco, normale o senza audio |
| **🎠 Giostra** | 10 secondi di video, uno specchio diverso a ogni battito, con il nome stampato nel video |
| **🎭 Rivela** | Il video parte irriconoscibile e si svela piano piano con un rullo di tamburi: «CHI È?» … «SORPRESA!» |
| **📸 Cabina** | 4 pose con conto alla rovescia, 4 specchi diversi, una striscia da fototessera del luna park |
| **Album** | Gli ultimi 60 scatti restano nell'app; da lì si condividono, si salvano o si eliminano |
| **Specchio del giorno** | Ogni giorno la stessa combinazione per tutti, da sfidarsi con gli amici. Contatore dei giorni di fila e "specchi scoperti 16/16" |
| **Firma** | Ogni foto e video porta la scritta SPECCHIO STORTO e l'hashtag: chi lo vede sa da dove arriva |
| **Due lingue** | Italiano, e inglese per chi ha il telefono in un'altra lingua |

## Perché può diventare un tormentone

1. **Il formato è già virale.** I filtri deformanti sono tra i più usati di sempre su TikTok e Instagram. Qui funzionano con la fotocamera posteriore, quindi si deforma **l'amico** e non solo se stessi.
2. **Tre format pronti da postare.** *Giostra* è un video ritmato, *Rivela* è un "indovina chi" con la sua suspense, *Cabina* è una striscia verticale perfetta per le storie.
3. **La voce storta raddoppia la risata.** Faccia deformata e voce elio o orco insieme: è il motivo per cui il video si guarda due volte.
4. **Ogni contenuto è una pubblicità.** La firma e l'hashtag `#specchiostorto` sono dentro ogni file condiviso.
5. **Si torna ogni giorno.** Lo Specchio del giorno è uguale per tutti ("oggi tocca Testone + Termico"), poi ci sono la serie di giorni consecutivi e la collezione dei 16 specchi.
6. **Zero frizioni.** Niente registrazione, si apre e funziona in un secondo, anche offline. La privacy totale è un argomento di vendita, soprattutto con i genitori.

## Provare subito

**Nel browser:** serve HTTPS, per esempio con GitHub Pages, oppure `npm run serve` e poi `http://localhost:8080`.

**APK Android:** a ogni push la GitHub Action *APK Android* compila l'app e pubblica l'APK nella pagina **Releases** del repository, come pre-release `apk-1.0.N`.
1. Dal telefono apri *Releases* e tocca `SpecchioStorto-1.0.N.apk`.
2. Android chiede di permettere le installazioni da quella fonte: conferma.
3. Le build successive si installano sopra la precedente senza perdere l'album.

## Struttura

```
index.html, css/, js/, fonts/   l'app (HTML + JS puro, nessun bundler)
  js/shaders.js   i 16 specchi e i 7 filtri (WebGL)
  js/app.js       interfaccia, gesti, modalità, registrazione
  js/audio.js     effetti sonori e voce storta (Web Audio)
  js/store.js     album (IndexedDB) e statistiche locali
  js/native.js    condividi/salva: plugin Capacitor nell'app, Web Share nel browser
sw.js, manifest.json            versione web installabile (PWA) e offline
android/                        progetto Android (Capacitor 8)
scripts/build-www.mjs           copia l'app in www/ per Capacitor
privacy.html                    informativa privacy (serve per gli store)
```

Per compilare l'APK in locale serve Android Studio o l'SDK Android, poi `npm install` e `npm run apk`.

## Verso gli store

**Google Play**
1. Crea la chiave definitiva (da custodire con cura: senza non si aggiorna più l'app):
   `keytool -genkeypair -keystore specchio-store.keystore -alias specchio -keyalg RSA -keysize 2048 -validity 10000`
2. Nei *Settings → Secrets → Actions* del repository aggiungi:
   `SS_KEYSTORE_BASE64` (il file codificato con `base64 -w0`), `SS_KEYSTORE_PASSWORD`, `SS_KEY_ALIAS`, `SS_KEY_PASSWORD`.
3. Da quel momento la Action produce anche il file `.aab` da caricare su Play Console. Account sviluppatore: 25 $ una tantum.
4. La chiave `android/app/anteprima.keystore` è **pubblica** e serve solo per gli APK di prova: non usarla per lo store.

**App Store (iPhone)**: con Capacitor si aggiunge con `npx cap add ios`, ma la compilazione richiede un Mac con Xcode (oppure un runner macOS su GitHub Actions) e l'account Apple Developer (99 $/anno).

**Da completare prima della pubblicazione**
- [ ] Indirizzo email di contatto reale in `privacy.html` (ora c'è un segnaposto)
- [ ] Pubblicare `privacy.html` a un indirizzo pubblico (va bene GitHub Pages) da indicare nello store
- [ ] Screenshot e video promozionale (la modalità Rivela è perfetta per il trailer)
- [ ] Verificare che il nome "Specchio Storto" sia libero come marchio

## Idee per le prossime versioni

- **Specchi che seguono la faccia** (rilevamento del volto sul dispositivo): il Testone resta sulla testa anche se ti muovi
- **Duetto**: schermo diviso tra fotocamera frontale e posteriore, tu e l'amico deformati insieme
- **Specchi stagionali**: Halloween (Zucca), Natale (Palla di vetro), Carnevale. Ogni festa porta un motivo per riaprire l'app
- **Pacchetto Premium** (acquisto unico, per esempio 2,99 €): specchi extra, video senza firma e più lunghi, cornici esclusive per la Cabina
- **Salvataggio diretto in Galleria** (adesso finisce in Documenti/SpecchioStorto o si condivide)
- **Musichette del luna park** sotto la Giostra
