# Quiz-mode

Quiz-mode er en brugerarbejdsgang i den eksisterende Jeopardy-app. Der er ikke en separat quiz-knap eller separat quiz-backend. Du bruger samme board, spørgsmål, svar og scorekontrol til en mere fri quiz.

## Hvornår quiz-mode passer

Brug quiz-mode når:

- spørgsmålene skal stilles i runder eller emner
- hosten vil styre rækkefølgen manuelt
- flere hold kan få point på samme spørgsmål
- deltagerne eventuelt skal buzze fra mobilen

## Opret en quiz

1. Åbn `Settings`.
2. Åbn `Question maker`.
3. Log ind som admin.
4. Skriv quiztitel og game id.
5. Brug kategorier som runder, emner eller sværhedsgrader.
6. Brug point som værdi eller spørgsmålsnummer.
7. Udfyld spørgsmål og svar.
8. Tryk `Gem spil`.

Eksempel:

- Kategori 1: `Runde 1`
- Kategori 2: `Runde 2`
- Kategori 3: `Finale`

## Afvikl quiz uden buzzers

1. Tryk `Start game`.
2. Vælg et spørgsmål.
3. Lad holdene svare.
4. Tryk `Show answer`.
5. Giv point til det relevante hold.
6. Appen går tilbage til boardet og markerer spørgsmålet som brugt.

Hvis flere hold skal have point:

1. Åbn spørgsmålet.
2. Slå `Flere teams` til.
3. Giv plus- eller minuspoint til flere hold.
4. Gå tilbage til boardet.

## Afvikl quiz med buzzers

1. Start en live session fra `Settings`.
2. Del QR-koden.
3. Lad deltagere joine.
4. Start spillet.
5. Åbn et spørgsmål.
6. Den første deltager i buzzer-listen svarer.
7. Lås eventuelt buzzers, mens der svares.
8. Ryd buzzers, hvis spørgsmålet skal åbnes for alle igen.

Se også [live-sessions.md](live-sessions.md).

## Indhold der virker godt i quiz-mode

Question maker understøtter:

- tekst med fed, kursiv, links, inline code og simple lister
- billeder
- YouTube
- lokal video
- lyd
- hints
- HTML for speciallayout
- speaker notes

Hints vises som reveal.js fragments. Host kan bruge piletasterne til at gå gennem hints.

## Begrænsninger

- Quiz-mode har ikke separat deltagerbesvarelse eller automatisk rettelse.
- Deltagertelefoner er kun buzzers, ikke fulde svarformularer.
- Live sessions overlever ikke server-restart.
- Score gemmes lokalt i hostens browser, mens live score kun ligger i live session-hukommelsen.
