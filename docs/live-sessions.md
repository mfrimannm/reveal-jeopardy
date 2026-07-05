# Live sessions og buzzer-system

Live sessions forbinder hostens board med deltagernes mobiltelefoner. Host starter en session, appen viser et session-id, et join-link og en QR-kode, og deltagere kan derefter buzze i realtid.

## Host-flow

1. Åbn appen og vælg spil.
2. Gå til `Settings`.
3. Find panelet `Live session`.
4. Tryk `Start live session`.
5. Del QR-koden eller join-linket.
6. Vent på at deltagere vises under `Deltagere`.
7. Tryk `Start game`.
8. Klik et spørgsmål på boardet.
9. Buzzer-listen ryddes automatisk, og buzzers åbnes.
10. Se rækkefølgen under `Buzzers`.
11. Giv point med scoreknapperne.

Når hosten åbner et nyt spørgsmål, kalder frontenden live API'et for at rydde buzzers, åbne buzzers og sætte `current_question`.

## Deltager-flow

Deltagere åbner:

```text
/play/<SESSION_ID>
```

De skriver navn, vælger hold og trykker `Join`. Derefter får de en buzzer-knap.

Status på mobilen:

- `Klar`: deltageren kan buzze.
- `Du buzzede først`: deltageren var først.
- `Du buzzede som nr. X`: deltageren buzzede senere.
- `Buzzers låst`: hosten har låst buzzers.

## Host-knapper

- `Start live session`: opretter en session for det aktuelle spil.
- `Reset session`: nulstiller live score, brugte spørgsmål, aktuelt spørgsmål og buzzers.
- `Stop session`: sletter sessionen fra serverens hukommelse.
- `Ryd buzzers`: fjerner den aktuelle buzzer-rækkefølge.
- `Lås buzzers`: blokerer nye buzzes.
- `Åbn buzzers`: åbner igen for nye buzzes.

## Score-sync

Når hosten giver point i et live spil, opdateres både lokal browser-score og live session score. Hvis live sync fejler, fortsætter lokal scoring stadig, og hosten får en fejlbesked i live-panelet.

## Autorisation

Live host-handlinger kræver enten:

- admin-login via cookie, eller
- sessionens host-token sendt som `X-Live-Host-Token`.

Frontenden gemmer host-token i browserens `localStorage` for det aktuelle spil, så hosten kan genindlæse siden og fortsætte, hvis server-sessionen stadig findes.

## Persistens

Live sessions ligger kun i serverens hukommelse:

- deltagere
- buzzers
- live score
- aktuelt spørgsmål
- host-token

De forsvinder ved server- eller container-restart. Spilfiler og uploads forsvinder ikke, hvis Docker volume er sat korrekt op.

## Netværk

QR-koden bruger `window.location.origin`. Hvis hosten åbner appen som `http://localhost:8000`, får deltagerne også et `localhost`-link, og det virker normalt ikke på deres telefoner.

Brug i stedet:

- serverens domæne på VPS
- host-computerens LAN-IP på lokalt netværk, for eksempel `http://192.168.1.42:8000`

Reverse proxyen skal understøtte WebSockets til `/ws/sessions/<SESSION_ID>`.
