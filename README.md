# Gestionale Studio Legale

Strumenti rapidi per l'agenda, le scadenze e la sincronizzazione con Excel/Apple Calendar.

## Avvio rapido (macOS)
1. Installare **Node 20** (consigliato tramite nvm o Homebrew).
2. Da Terminale: `npm run bootstrap` per installare dipendenze backend/frontend.
3. Costruire l'interfaccia: `npm run build --prefix frontend`.
4. Creare l'eseguibile universale: `npm run build:exe` (genera `dist/gestionale-dev-macos-*.`).
5. Avviare `Start Gestionale.command` con doppio click oppure da shell: `./Start\ Gestionale.command`.

> L'eseguibile ricerca automaticamente la cartella del progetto e, se presente, usa il build frontend servito dal backend.

## Esportazione/Importazione Excel
- Esporta clienti, pratiche, fatture, spese, scadenze/udienze e amministrazioni di sostegno con intestazioni colorate e colonne auto-dimensionate.
- Importa file Excel creati dal gestionale o fogli personalizzati: gli ID mancanti vengono generati, le date sono normalizzate e le scadenze importano anche delegato e note udienza.

## Sincronizzazione Apple Calendar
- Link ICS: `/api/calendar/ics` (copiabile dalla pagina calendario).
- In Apple Calendar: **File → Nuova iscrizione calendario** e incollare il link ICS per vedere udienze, scadenze e deleghe con promemoria 30 minuti prima.
