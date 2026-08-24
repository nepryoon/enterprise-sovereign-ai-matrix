# Guida al deployment di matrix.neuromorphicinference.com

> **Ambito e verifica.** Runbook per il commit di questo repository, riesaminato il **22 agosto 2026**. Non acquistare nulla e non eseguire test LLM live senza autorizzazione. I link primari elencati in §32 sono quelli da ricontrollare il giorno dell'installazione; dalla workstation di redazione l'accesso HTTP esterno è stato bloccato dal proxy (403), quindi versioni e prezzi correnti **non sono stati verificabili online**. Questa limitazione è intenzionalmente esplicita.

## 1. Risultato finale

Mission Control sarà disponibile solo a `https://matrix.neuromorphicinference.com`. Il browser usa REST/SSE same-origin `/api/v1`; Next.js inoltra sulla rete Docker ad `api:8000`. Cloudflare termina TLS e il tunnel raggiunge esclusivamente `web:3000`. PostgreSQL, LiteLLM, Ollama, ClickHouse, Redis e MinIO non pubblicano porte; Langfuse è solo su loopback `127.0.0.1:3001`.

```mermaid
flowchart LR
 I[Internet] --> CF[Cloudflare HTTPS / Access opzionale]
 CF --> T[cloudflared]
 T --> W[web :3000]
 W -->|/api/v1 REST + SSE| A[api :8000]
 A --> P[(PostgreSQL)]
 A --> L[LiteLLM :4000]
 L --> O[Ollama :11434]
 A -. trace redatte .-> F[Langfuse web/worker]
 F --> C[(ClickHouse)] & R[(Redis)] & M[(MinIO)]
```

**Correzione obbligatoria inclusa:** il Compose originario pubblicava web/API e il frontend predefiniva `localhost:8000`, incompatibile con tunnel → solo web. Questo commit aggiunge il rewrite Next same-origin e `docker-compose.production.yml`; usare sempre entrambi in produzione. Langfuse resta opzionale per il workflow (export best-effort), ma i suoi container sono nel Compose base.

## 2. Prerequisiti

| Classe | Requisito |
|---|---|
| Obbligatorio | Amministrazione della zona Cloudflare `neuromorphicinference.com`, DNS attivo, VPS Ubuntu 24.04 LTS, SSH a chiave, Git, Docker Engine/Compose v2, `curl`, `dig`, `openssl`, 80 GB liberi |
| Cloud provider | Account/billing Hetzner e chiave pubblica SSH; nessun token Hetzner entra nell'app |
| Opzionale | `OPENAI_API_KEY` solo con `INFERENCE_MODE=litellm`; `ANTHROPIC_API_KEY` è presente nell'esempio ma **non consumata** dall'attuale LiteLLM config |
| Solo Langfuse | 16 GB RAM raccomandati, chiavi progetto create nella UI, storage di backup |

Egress VPS: TCP 443 (GitHub, registry, Cloudflare, provider opzionale), DNS UDP/TCP 53, NTP UDP 123. Cloudflare Tunnel usa connessioni in uscita (QUIC UDP 7844, fallback HTTPS TCP 7844/443 secondo documentazione); ingresso: solo SSH 22 limitato al proprio IP. Non servono 80/443 inbound.

Scelta breve: Hetzner EU offre buon rapporto costo/sovranità; un VPS europeo equivalente riduce vendor lock-in ma va prezzato; una macchina locale elimina il canone ma dipende da corrente/ISP. **Raccomandato:** Hetzner Norimberga/Falkenstein, Ubuntu 24.04, almeno 8 vCPU, 16 GB RAM, 80–160 GB SSD e volume/backup separato. CPU-only col modello compatto è lenta e non adatta ad alta concorrenza. Stack ridotto senza Langfuse: 4 vCPU/8 GB/80 GB. Stack completo: 8 vCPU/16 GB/160 GB. Verificare SKU/prezzo sul listino prima dell'ordine; budget operativo prudenziale in §32, sempre < €250/mese e nessuna GPU presunta.

## 3. Checklist credenziali

| Credenziale | Obbligatoria | Dove crearla | Dove conservarla | Può essere committata |
|---|---|---|---|---|
| Chiave privata SSH | Sì | workstation (`ssh-keygen`) | agent/keystore workstation | No |
| `POSTGRES_PASSWORD` | Sì | `openssl` | `.env` 600 + backup cifrato | No |
| `LITELLM_MASTER_KEY` | Sì | `openssl` | `.env` | No |
| segreti Langfuse/ClickHouse/Redis/MinIO | Sì per stack base | `openssl` | `.env` | No |
| `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` | Solo export trace | progetto Langfuse UI | `.env` | No |
| `OPENAI_API_KEY` | Solo cloud live | console OpenAI | `.env`/secret manager | No |
| `CLOUDFLARE_TUNNEL_TOKEN` | Metodo A | Zero Trust dashboard | `.env` | No |
| UUID + JSON tunnel | Metodo B | `cloudflared tunnel create` | `/etc/cloudflared`, 600 | No |

## 4. Preparazione del VPS

Dalla console iniziale (sostituire **solo** `CHIAVE_PUBBLICA_SSH` e `203.0.113.4` con valori dell'operatore):

```bash
apt update && apt full-upgrade -y
apt install -y git curl ca-certificates gnupg openssl ufw fail2ban unattended-upgrades chrony dnsutils
adduser deploy
usermod -aG sudo deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
printf '%s\n' 'CHIAVE_PUBBLICA_SSH' > /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys
timedatectl set-timezone Etc/UTC
systemctl enable --now chrony fail2ban unattended-upgrades
ufw default deny incoming; ufw default allow outgoing
ufw allow from 203.0.113.4 to any port 22 proto tcp
ufw enable
```

Atteso: `chronyc tracking`, `systemctl is-active chrony fail2ban` e `ufw status verbose` risultano attivi; SSH nuovo utente funziona **prima** di chiudere la sessione root. Quindi:

```bash
sudoedit /etc/ssh/sshd_config
# impostare: PermitRootLogin no; PasswordAuthentication no; PubkeyAuthentication yes
sudo sshd -t && sudo systemctl reload ssh
sudo install -d -m 750 -o deploy -g deploy /opt/sovereign-matrix
```

Swap (raccomandato 8 GB per evitare OOM, non sostituisce RAM):

```bash
sudo fallocate -l 8G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
swapon --show
```

Docker usa il driver `json-file`: creare `/etc/docker/daemon.json` dopo l'installazione con `{"log-driver":"local","log-opts":{"max-size":"10m","max-file":"5"}}`, poi `sudo systemctl restart docker`. Non aprire altre porte.

## 5. Installazione Docker

Procedura repository APT ufficiale Ubuntu (ricontrollare il link §32):

```bash
for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do sudo apt-get remove -y "$pkg"; done
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME:-$VERSION_CODENAME} stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run --rm hello-world
sudo usermod -aG docker deploy
```

Rientrare in SSH, poi `docker version` e `docker compose version`. Il gruppo `docker` equivale praticamente a root: solo `deploy` fidato, mai utenti applicativi.

## 6. Clone e preparazione repository

```bash
sudo -u deploy git clone https://github.com/nepryoon/enterprise-sovereign-ai-matrix /opt/sovereign-matrix/app
cd /opt/sovereign-matrix/app
git fetch --tags
git checkout main                    # meglio: un tag/commit revisionato e immutabile
git branch --show-current; git rev-parse HEAD; git status --short
cp .env.example .env
chmod 600 .env
git check-ignore -v .env
```

Atteso: working tree vuoto prima di copiare `.env`; l'ultimo comando cita `.gitignore`. Registrare commit in change ticket.

## 7. Generazione sicura dei segreti

| Variabile | Scopo | Esempio non segreto | Metodo |
|---|---|---|---|
| `POSTGRES_PASSWORD`, `CLICKHOUSE_PASSWORD`, `REDIS_PASSWORD`, `MINIO_ROOT_PASSWORD` | datastore (hex evita caratteri da URL-encoding) | `valore-generato` | `openssl rand -hex 32` |
| `LITELLM_MASTER_KEY`, `LANGFUSE_NEXTAUTH_SECRET`, `LANGFUSE_SALT` | auth/firma | `valore-generato-64hex` | `openssl rand -hex 32` |
| `LANGFUSE_ENCRYPTION_KEY` | cifratura, esattamente 64 hex | `64-caratteri-hex` | `openssl rand -hex 32` |
| token ad alta entropia alternativo | rotazioni future | `128-caratteri-hex` | `openssl rand -hex 64` |
| `OPENAI_API_KEY`, chiavi progetto Langfuse, token tunnel | provider | formato emesso dal provider | console/UI; non rigenerare con OpenSSL |

Inserire l'output direttamente con editor senza stamparlo nei log. `chmod 600 .env`; mai `set -x`, screenshot o commit. Backup: `age -p -o /backup/secrets/env.age .env`, permessi 600, destinazione off-host. Ruotare dopo sospetto incidente e periodicamente; la rotazione datastore richiede coordinamento. Chiavi applicative sono generate dall'operatore, quelle provider sono emesse/revocate dal provider.

## 8. Configurazione `.env`

Template completo delle sole variabili supportate/presenti (valori `GENERARE_...` sono istruzioni esplicite, da sostituire):

```dotenv
APP_ENV=production
APP_BASE_URL=https://matrix.neuromorphicinference.com
NEXT_PUBLIC_API_URL=/api/v1
API_INTERNAL_URL=http://api:8000
CORS_ALLOWED_ORIGINS=https://matrix.neuromorphicinference.com
POSTGRES_USER=matrix
POSTGRES_PASSWORD=GENERARE_HEX_32
POSTGRES_DB=matrix
DATABASE_URL=postgresql+psycopg://matrix:STESSO_POSTGRES_PASSWORD@postgres:5432/matrix
LITELLM_BASE_URL=http://litellm:4000
LITELLM_MASTER_KEY=GENERARE_HEX_32
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=qwen2.5:1.5b-instruct-q4_K_M
INFERENCE_MODE=fake
SOVEREIGN_AVAILABLE=true
RUN_LIVE_LLM_TESTS=false
LANGFUSE_HOST=http://langfuse-web:3000
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_NEXTAUTH_SECRET=GENERARE_HEX_32
LANGFUSE_SALT=GENERARE_HEX_32
LANGFUSE_ENCRYPTION_KEY=GENERARE_ESATTAMENTE_64_HEX
CLICKHOUSE_PASSWORD=GENERARE_HEX_32
REDIS_PASSWORD=GENERARE_HEX_32
MINIO_ROOT_USER=langfuse
MINIO_ROOT_PASSWORD=GENERARE_HEX_32
CLOUDFLARE_TUNNEL_TOKEN=
```

`APP_BASE_URL` è documentale nell'attuale codice; `OLLAMA_MODEL` è coerente ma il LiteLLM YAML ha il modello fissato direttamente. `ANTHROPIC_API_KEY` non è usata. `RUN_LIVE_LLM_TESTS` viene forzata a false nel container API. `fake` è deterministico e non chiama LiteLLM; `litellm` abilita chiamate vere. `SOVEREIGN_AVAILABLE=false` simula fail-closed. `NEXT_PUBLIC_API_URL` è incorporata dal Dockerfile al **build**: dopo modifica eseguire `docker compose ... build web`; `API_INTERNAL_URL` serve al rewrite server Next.

## 9. Verifica Docker Compose prima dell'avvio

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.production.yml config > /tmp/matrix-compose.yml
docker compose --env-file .env -f docker-compose.yml -f docker-compose.production.yml config --quiet
rg -n 'change-me|GENERARE_|REPLACE_WITH' .env /tmp/matrix-compose.yml
sed -n '/ports:/,+3p' /tmp/matrix-compose.yml
sed -n '/healthcheck:/,+8p' /tmp/matrix-compose.yml
docker compose -f docker-compose.yml -f docker-compose.production.yml config --volumes
```

Atteso: nessun placeholder; solo `127.0.0.1:3001:3000`; cinque volumi; health per web, API, PostgreSQL, LiteLLM, Ollama, ClickHouse, Redis e MinIO (Langfuse non ne definisce). `/tmp/matrix-compose.yml` contiene segreti interpolati: `chmod 600` e cancellarlo subito (`shred -u` se filesystem lo supporta). Non incollare `config` nei ticket.

## 10. Primo build

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.production.yml build
```

Prevedere 10–30 minuti e almeno 20–30 GB temporanei, dipendenti da rete/cache; vengono scaricate immagini base Node/Python e dipendenze. L'ultima riga di ogni stage deve essere riuscita. Diagnosticare con output BuildKit e `docker system df`. Solo per cache corrotta/cambio ARG: `docker compose ... build --no-cache web api` (più lento).

## 11. Primo avvio controllato

Il vero grafo dipendenze richiede Ollama prima di LiteLLM e datastore prima di Langfuse:

```bash
DC='docker compose --env-file .env -f docker-compose.yml -f docker-compose.production.yml'
$DC up -d postgres clickhouse redis minio
$DC up -d ollama
$DC up -d litellm
$DC up -d langfuse-web langfuse-worker
$DC up -d api
$DC up -d web
$DC ps
$DC logs --tail=200 postgres ollama litellm api web
```

Atteso: servizi con healthcheck `healthy`; Langfuse web/worker `Up`; nessun restart loop. Non usare `logs` con `--environment` e non stampare `.env`.

## 12. Installazione modello Ollama

Il modello reale è `qwen2.5:1.5b-instruct-q4_K_M`:

```bash
$DC exec ollama ollama pull qwen2.5:1.5b-instruct-q4_K_M
$DC exec ollama ollama list
$DC exec ollama ollama run qwen2.5:1.5b-instruct-q4_K_M 'Rispondi soltanto: OK'
```

Verificare dimensione effettiva in `ollama list` (non fissarla nella guida: può cambiare col manifest); prevedere circa 2–4 GB RAM inclusi overhead e latenza da secondi a minuti su CPU. Se manca, il sovereign live fallisce; una richiesta restricted deve terminare `FAILED`, mai cloud. Non scegliere automaticamente modelli maggiori.

## 13. Configurazione LiteLLM

`config/litellm/config.yaml`: `fast`→`openai/gpt-4.1-nano` (30 s), `balanced`→`gpt-4.1-mini` (45 s), `reasoning`→`o4-mini` (90 s), tutti richiedono `OPENAI_API_KEY`; `sovereign`→Ollama modello sopra (120 s). Router: 2 retry, retry dopo 1 s, cooldown 30 s; solo `fast` può ripiegare su `balanced`; **nessun fallback sovereign**. L'alias balanced esiste ma la policy demo seleziona FAST/REASONING/SOVEREIGN.

```bash
$DC exec litellm python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:4000/health/liveliness').status)"
# Solo dopo approvazione di una chiamata live, payload non sensibile:
$DC exec litellm python -c 'import os,urllib.request,json; r=urllib.request.Request("http://127.0.0.1:4000/v1/chat/completions",data=json.dumps({"model":"sovereign","messages":[{"role":"user","content":"Rispondi OK"}]}).encode(),headers={"Authorization":"Bearer "+os.environ["LITELLM_MASTER_KEY"],"Content-Type":"application/json"}); print(urllib.request.urlopen(r,timeout=180).status)'
```

## 14. Avvio e configurazione Langfuse

Il Compose usa Langfuse `:4` (tag mobile, non digest), PostgreSQL condiviso, ClickHouse 26.4, Redis 7.4 e MinIO S3. **Conflitto operativo obbligatorio:** il tag mobile e l'assenza di healthcheck/migration URL esplicito non permettono di affermare compatibilità con una release futura. Prima del go-live confrontare il file ufficiale v4, bloccare i due image digest e aggiungere qualsiasi variabile/migrazione dichiarata obbligatoria upstream (in particolare verificare `CLICKHOUSE_MIGRATION_URL`). Non indovinare né avviare una migrazione su dati reali. Modifica opzionale: DB PostgreSQL dedicato per isolamento.

Avviare come §11, controllare `logs`, poi dalla workstation:

```bash
ssh -N -L 3001:127.0.0.1:3001 deploy@SERVER_IP
```

Aprire `http://127.0.0.1:3001`, creare account/progetto e generare public/secret key; scriverle in `.env`, poi `$DC up -d --force-recreate api`. Chiudere SSH con Ctrl-C. Una nuova esecuzione deve mostrare trace ID correlato in UI/API e trace Langfuse; tuttavia l'attuale `TraceAdapter` è una implementazione failure-isolated minimale e non invia contenuto al server: **la correlazione remota completa richiede implementazione applicativa ulteriore**, non va dichiarata funzionante. Non loggare prompt sensibili; redigere/metadati soltanto.

## 15. Creazione Cloudflare Tunnel

### Metodo A — Dashboard Zero Trust (raccomandato)

Cloudflare → Zero Trust → **Networks → Tunnels → Create a tunnel** → `cloudflared` → nome `sovereign-matrix-production` → copiare solo il token in `CLOUDFLARE_TUNNEL_TOKEN`. In **Public Hostname**: subdomain `matrix`, domain `neuromorphicinference.com`, Type `HTTP`, URL `web:3000`; salvare. Avviare:

```bash
$DC --profile tunnel up -d cloudflared
$DC logs --tail=200 cloudflared
```

Dashboard deve indicare Healthy. Il token non è il JSON credenziali.

### Metodo B — file di configurazione

`infra/cloudflare/config.yml.example` contiene UUID, `credentials-file`, hostname, `http://web:3000` e catch-all `http_status:404`. Copiarlo fuori Git:

```bash
sudo install -d -m 700 /etc/cloudflared
sudo install -m 600 infra/cloudflare/config.yml.example /etc/cloudflared/config.yml
sudoedit /etc/cloudflared/config.yml
sudo install -m 600 PERCORSO_JSON_EMESSO_DA_CLOUDFLARED /etc/cloudflared/TUNNEL_UUID.json
```

Questo metodo richiede adattare/aggiungere un servizio Compose che monti config e JSON read-only e esegua `tunnel --config /etc/cloudflared/config.yml run`; non combinarlo col comando `--token`. Il repository implementa direttamente Metodo A, dunque B è per operatori che revisionano prima un override controllato.

## 16. Record DNS

Metodo A crea normalmente il CNAME proxied durante il salvataggio del Public Hostname. Verificare in DNS: nome `matrix`, target `<UUID>.cfargotunnel.com`, proxy arancione, TTL Auto. Metodo B: `cloudflared tunnel route dns TUNNEL_UUID matrix.neuromorphicinference.com` crea il record (richiede certificato/account locale).

```bash
dig matrix.neuromorphicinference.com
dig CNAME matrix.neuromorphicinference.com
```

Con proxy attivo la risposta pubblica può essere IP Cloudflare e il CNAME può essere appiattito: non inventare/confrontare IP fissi. Attendere pochi minuti e ricontrollare dashboard/risolutori autorevoli.

## 17. HTTPS e sicurezza Cloudflare

Universal SSL deve mostrare certificato edge Active; Tunnel cifra il tratto Cloudflare→connector e usa origin HTTP nella rete Docker privata. Impostare Always Use HTTPS, Minimum TLS 1.2 (1.3 consentito). HSTS solo dopo test completo; **mai `includeSubDomains`/preload** senza audit di tutti i sottodomini. Bot Fight Mode è opzionale e va testato con SSE/API. Cache rule: bypass per `/api/*`, niente buffering/trasformazioni SSE. Access raccomandato per demo privata (IdP + allowlist); demo pubblica necessita rate limiting/WAF. Cloudflare non sostituisce auth applicativa.

## 18. CORS, CSP e URL applicativi

Browser e API sono same-origin; `.env` ammette solo `https://matrix.neuromorphicinference.com`. SSE usa EventSource a `/api/v1/.../stream`; API invia `no-cache` e `X-Accel-Buffering: no`. Backend CSP `default-src 'none'; frame-ancestors 'none'`; frontend ha nosniff/referrer/permissions ma non CSP: configurarla al bordo prima del pubblico, includendo almeno script/style/connect necessari e `connect-src 'self'`. Link diretto non richiede iframe. Per embedding futuro usare esclusivamente `frame-ancestors 'self' https://www.neuromorphicinference.com`, mai wildcard; ciò richiede rimuovere/conciliare `X-Frame-Options: DENY` sulla risorsa embedded.

## 19. Avvio completo

```bash
$DC --profile tunnel up -d
$DC ps
$DC logs --tail=200 web
$DC logs --tail=200 api
$DC logs --tail=200 cloudflared
```

| Servizio | Stato atteso | Health | Esposizione |
|---|---|---|---|
| web | Up | `/` | solo tunnel |
| api | Up | `/api/v1/health/live` | privata via web |
| postgres | Up | `pg_isready` | privata |
| litellm | Up | `/health/liveliness` | privata |
| ollama | Up | `ollama list` | privata |
| langfuse-web/worker | Up | log (nessun health Compose) | web loopback / worker privato |
| clickhouse | Up | `/ping` | privata |
| redis | Up | auth PONG | privata |
| minio | Up | `mc ready` | privata |
| cloudflared | Up | dashboard Healthy | egress-only |

## 20. Test URL pubblico

```bash
curl -sS -D- -o /dev/null https://matrix.neuromorphicinference.com/
curl -fsS https://matrix.neuromorphicinference.com/ >/dev/null
curl -fsS https://matrix.neuromorphicinference.com/api/v1/health/live
curl -fsS https://matrix.neuromorphicinference.com/api/v1/health/ready
curl -sS -D- -o /dev/null http://matrix.neuromorphicinference.com/
```

Atteso: HTTPS 200, health `{"status":"ok"}`/`ready`, HTTP redirect HTTPS, header sicurezza, nessuno stack trace/listing. Da host esterno verificare che `SERVER_IP:3000,8000,4000,5432,11434,6379,8123,9000,9001` non rispondano; non effettuare scansioni senza autorizzazione.

## 21. Smoke test applicativo

Lo script reale accetta la **base API senza `/api/v1`**:

```bash
CF_ACCESS_CLIENT_ID='<service-token-id>' \
CF_ACCESS_CLIENT_SECRET='<service-token-secret>' \
  ./scripts/demo-smoke-test.sh https://matrix.neuromorphicinference.com
# test privato diretto senza pubblicare API:
$DC exec -T api sh -c 'command -v curl >/dev/null' # l'immagine API normalmente non include curl
curl --fail http://127.0.0.1:8000/api/v1/health/live # solo se override temporaneo loopback autorizzato
```

Lo script crea HIGH_RISK, attende `WAITING_APPROVAL`, approva e attende `COMPLETED`. **Non verifica da solo reject, audit dettagliato o SSE**, contrariamente a una descrizione più ampia: verificarli manualmente §22. Quando Access è abilitato, configura obbligatoriamente un service token con scope minimo nei secret GitHub `CF_ACCESS_CLIENT_ID` e `CF_ACCESS_CLIENT_SECRET`; lo script invia entrambi gli header Cloudflare a ogni richiesta. Durante una migrazione in cui l'hostname non è ancora protetto, i secret possono essere assenti e lo stesso gate verifica l'endpoint pubblico senza header. In alternativa, eseguilo dal VPS attraverso un percorso autenticato; non esporre FastAPI. Un override temporaneo deve bindare esclusivamente `127.0.0.1:8000:8000` e poi essere rimosso.

## 22. Test manuale Mission Control

| Test | Risultato atteso |
|---|---|
| Dashboard/Agent Matrix | caricamento, agenti e timeline aggiornati |
| PUBLIC low risk | COMPLETED, FAST, niente approvazione |
| PUBLIC high risk | REASONING → WAITING_APPROVAL; approve → COMPLETED |
| Reject con motivo | terminale FAILED/abort previsto e audit distinto |
| Restricted | SOVEREIGN/Ollama, approvazione richiesta |
| SSE e refresh/reconnect | eventi live, heartbeat, replay senza duplicazioni materiali |
| token/latenza/costo | KPI presenti e coerenti; fake deterministico |
| provider failure | FAILED tipizzato, nessun cloud |
| trace ID/audit | correlation/execution ID coerenti nell'API |
| Langfuse | solo dopo implementazione export reale: trace correlata; altrimenti registrare gap §14 |

Con DevTools verificare nessuna chiamata a `localhost`, CORS error o cache SSE.

## 23. Verifica sovereign routing

Usare solo stringhe fittizie della UI (`SAFE`, `HIGH_RISK`, `SENSITIVE`, `PROVIDER_FAILURE`). In fake mode: low/public→FAST; high/public→REASONING; restricted→SOVEREIGN. Impostare temporaneamente `SOVEREIGN_AVAILABLE=false`, ricreare API, inviare restricted fittizia e attendere FAILED; cercare audit/provider senza dati personali. Ripristinare true. In live mode, arrestare Ollama (`$DC stop ollama`) solo in finestra di test, inviare restricted e confermare FAILED; verificare i log LiteLLM non mostrino alias cloud, poi `$DC up -d ollama`. La policy e il LiteLLM YAML non hanno fallback sovereign.

## 24. Backup

Backup giornaliero, retention 7 giornalieri/4 settimanali/6 mensili, directory `/var/backups/sovereign-matrix` 700, copia cifrata off-host:

```bash
sudo install -d -m 700 -o deploy -g deploy /var/backups/sovereign-matrix
STAMP=$(date -u +%Y%m%dT%H%M%SZ); B=/var/backups/sovereign-matrix/$STAMP; install -d -m 700 "$B"
$DC exec -T postgres pg_dump -U matrix -d matrix -Fc > "$B/postgres.dump"
$DC exec -T clickhouse sh -c 'clickhouse-client --password "$CLICKHOUSE_PASSWORD" --query "BACKUP ALL TO Disk(\x27backups\x27, \x27snapshot.zip\x27)"' # solo dopo configurazione disk backup ufficiale
cp docker-compose.yml docker-compose.production.yml "$B/"
age -p -o "$B/env.age" .env
sha256sum "$B"/* > "$B/SHA256SUMS"
```

Il comando ClickHouse è **un modello non eseguibile finché non si configura il disk `backups`** secondo docs ufficiali; in alternativa fermare Langfuse/worker e usare snapshot coerente provider dei volumi ClickHouse+MinIO. Non copiare tar di volumi attivi. PostgreSQL `pg_dump` è consistente online; MinIO contiene payload Langfuse e va salvato coerentemente con ClickHouse. Per volumi Ollama/cache si può riscaricare il modello. Test restore trimestrale su stack isolato: creare DB vuoto, `pg_restore --clean --if-exists`, ripristinare snapshot ClickHouse/MinIO coordinato, avviare e smoke; mai provare per la prima volta in produzione.

## 25. Aggiornamento applicazione

```bash
# 1 backup §24 e annotare OLD=$(git rev-parse HEAD)
git fetch --tags
git checkout TAG_REVISIONATO
git pull --ff-only                 # solo se si è scelta una branch; inutile su tag detached
$DC config --quiet
$DC pull
$DC build
$DC up -d
$DC ps
./scripts/demo-smoke-test.sh https://matrix.neuromorphicinference.com
$DC logs --since=30m api web langfuse-web
```

Leggere release note/migrazioni PostgreSQL, Langfuse e ClickHouse prima di `up`; non aggiornare tag mobile alla cieca. Health + smoke + manual SSE/HITL sono gate.

## 26. Rollback

Conservare commit, file Compose risolto (cifrato), digest immagini e backup schema precedente. Se nessuna migrazione incompatibile:

```bash
git checkout OLD_COMMIT
$DC config --quiet
$DC build web api
$DC up -d
$DC ps
./scripts/demo-smoke-test.sh https://matrix.neuromorphicinference.com
```

Se schema incompatibile: fermare writer (`$DC stop api langfuse-worker langfuse-web`), preservare DB fallito, ripristinare backup in istanza/volumi nuovi secondo runbook testato, puntare il vecchio stack e avviare. Non eseguire mai `docker compose down -v` nel rollback ordinario: **`-v` elimina i dati persistenti**. Preferire blue/green/snapshot atomico e decisione DBA.

## 27. Monitoraggio operativo

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml ps
docker stats --no-stream
docker system df
df -h; free -h; swapon --show
docker volume ls
docker compose -f docker-compose.yml -f docker-compose.production.yml logs --since=1h
$DC exec postgres psql -U matrix -d matrix -c "SELECT pg_size_pretty(pg_database_size('matrix'));"
$DC exec clickhouse sh -c 'clickhouse-client --password "$CLICKHOUSE_PASSWORD" --query "SELECT formatReadableSize(sum(bytes_on_disk)) FROM system.parts WHERE active"'
time $DC exec ollama ollama run qwen2.5:1.5b-instruct-q4_K_M 'OK'
```

Allarmi: disco >75/85%, RAM/swap sostenuta, restart, health unhealthy, tunnel disconnected, crescita ClickHouse/Postgres, latenza Ollama, error rate API/Langfuse. Controllare dashboard Cloudflare e fatturazione OpenAI; stop live a soglia budget.

## 28. Troubleshooting

| Problema | Possibile causa | Diagnosi | Correzione |
|---|---|---|---|
| DNS non risolve | record/zone errati | `dig`, dashboard | correggere Public Hostname/CNAME |
| tunnel unhealthy | token/egress | log cloudflared, UDP/TCP 7844 | ruotare token, consentire egress |
| 502 | web unhealthy/nome origin | `ps`, log web/cloudflared | origin `http://web:3000`, ripristinare health |
| frontend non raggiunge API | build vecchio/rewrite | DevTools, `NEXT_PUBLIC_API_URL` | impostare `/api/v1`, rebuild web |
| CORS | origine errata | response/browser | origine HTTPS esatta, ricreare API |
| SSE disconnect/buffering | cache/proxy/timeout | `curl -N`, log | bypass cache `/api/*`, preservare heartbeat |
| API unhealthy | DB/init | log api, ready | ripristinare PostgreSQL/config |
| database unhealthy | password/disco | log + `pg_isready` | password coerente, liberare disco/restore |
| LiteLLM unhealthy | config/Ollama | log + liveliness | validare YAML, avviare Ollama |
| Ollama senza modello | pull mancante | `ollama list` | pull modello esatto |
| sovereign fallisce | modello/down | log LiteLLM/Ollama | ripristinare locale; non aggiungere fallback cloud |
| Langfuse senza trace | chiavi/export non implementato | log API/UI | chiavi corrette; implementare adapter reale (§14) |
| ClickHouse unhealthy | password/storage/versione | log/ping | spazio, password, compatibilità release |
| Redis unhealthy | password mismatch | `redis-cli -a ... ping` | riallineare e ricreare |
| MinIO unhealthy | credenziali/storage | log, `mc ready` | riallineare, permessi/restore |
| disco pieno | immagini/log/dati | `df`, `docker system df` | retention; prune solo oggetti confermati inutilizzati |
| RAM esaurita | stack/Ollama | `free`, kernel log | ridurre concorrenza, più RAM, stack ridotto |
| restart loop | config/dependency | `ps`, `logs --tail=200` | correggere prima causa, non loopare restart |
| secret non valido | placeholder/formato | controllo offline `.env` | ruotare e riallineare dipendenze |
| build Next | rete/ARG/RAM | output BuildKit | rete/spazio; API URL `/api/v1`; rebuild |
| HTTPS non pronto | Universal SSL/DNS | Edge Certificates, `curl -v` | attendere emissione, correggere zone; non bypass TLS |

## 29. Hardening finale

- [ ] root e password SSH disabilitati; chiavi e UFW/fail2ban/patch attivi
- [ ] `.env` 600, scanner pulito, backup cifrato e rotazione provata
- [ ] solo Langfuse `127.0.0.1:3001`; DB/Ollama/LiteLLM/Redis/ClickHouse/MinIO non pubblici
- [ ] nessun Docker socket montato; immagini/digest revisionati; first-party non-root
- [ ] Cloudflare Access se privata, WAF/rate limit se pubblica
- [ ] CORS/CSP ristrette; no wildcard/iframe inatteso
- [ ] log/trace senza prompt sensibili; retention e backup restore provati
- [ ] secret provider con minimo privilegio e budget; nessun live test automatico

## 30. Checklist go-live

### Infrastruttura
- [ ] sizing, UTC/NTP, patch, SSH, firewall, disco/swap verificati
### DNS e Cloudflare
- [ ] tunnel Healthy, DNS proxied, TLS valido, cache API bypass, Access/WAF testati
### Applicazione
- [ ] commit registrato, Compose production, tutti i servizi attesi, modello installato
### Sicurezza
- [ ] hardening §29, porte esterne negate, segreti/scanner puliti
### Test
- [ ] health, smoke, approve/reject, SSE/reconnect, fail-closed eseguiti
### Backup
- [ ] backup off-host cifrato e restore isolato riuscito
### Osservabilità
- [ ] metriche/log/allarmi; gap Langfuse §14 accettato o corretto

## 31. Checklist post go-live

**Dopo 15 min:** health/restart/log error, tunnel, REST/SSE, latenza/RAM. **Dopo 24 h:** disco/crescita DB, backup giornaliero e checksum, certificato/DNS, costi/API e Access audit. **Dopo 7 giorni:** restore campione, patch/CVE/digest, capacità, retention, falsi positivi WAF/rate limit, rotazione e FinOps forecast.

## 32. Costi e fonti ufficiali

| Voce | Costo iniziale | Costo mensile prudenziale | Obbligatoria | Note |
|---|---:|---:|---|---|
| VPS EU completo | €0 | €40–100 | Sì | confermare SKU/listino Hetzner |
| volume/storage | €0 | €10–25 | consigliato | dipende da GB |
| backup off-host | €0 | €10–25 | Sì | retention §24 |
| Cloudflare Tunnel | €0 | €0 (piano idoneo) | Sì | Access può dipendere dal piano |
| API LLM | €0 | €0–60 | No | fake/local default, hard stop |
| dominio esistente | €0 | €0 qui | Sì | rinnovo fuori perimetro |
| contingency | €0 | €30 | No | non è autorizzazione di spesa |
| **Totale massimo pianificato** | **€0** | **€75–240** | | sotto €250 |

Fonti primarie da aprire/verificare prima dell'esecuzione (tentativo 22-08-2026 bloccato 403 dal proxy di redazione):

- Docker: [Ubuntu Engine](https://docs.docker.com/engine/install/ubuntu/), [Compose plugin](https://docs.docker.com/compose/install/linux/), [backup volumi](https://docs.docker.com/engine/storage/volumes/#back-up-restore-or-migrate-data-volumes).
- Cloudflare: [tunnel remotely managed](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-remote-tunnel/), [DNS tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/routing-to-tunnel/dns/), [Access](https://developers.cloudflare.com/cloudflare-one/policies/access/).
- Hetzner: [location](https://docs.hetzner.com/cloud/general/locations/), [listino Cloud](https://www.hetzner.com/cloud/).
- Ollama: [Docker](https://docs.ollama.com/docker).
- LiteLLM: [Proxy quick start](https://docs.litellm.ai/docs/proxy/quick_start).
- Langfuse: [Docker Compose self-host](https://langfuse.com/self-hosting/deployment/docker-compose), [self-hosting](https://langfuse.com/self-hosting).
- PostgreSQL 16: [`pg_dump`](https://www.postgresql.org/docs/16/app-pgdump.html), [`pg_restore`](https://www.postgresql.org/docs/16/app-pgrestore.html).
- ClickHouse: [backup/restore](https://clickhouse.com/docs/en/operations/backup).

Differenze upstream/repository da non ignorare: immagini repository sono pin puntuali salvo Langfuse `:4`; Compose Langfuse va diffato col release ufficiale; backup generico volume Docker non garantisce coerenza di DB attivi; `ANTHROPIC_API_KEY` e `OLLAMA_MODEL` non governano l'attuale LiteLLM YAML; trace adapter non esporta ancora; API pubblica è ora proxy same-origin via Next.

## 33. Evidenza, limiti e responsabilità esterne

Prima del change: salvare output (senza segreti) di commit, versioni Docker, `config --quiet`, `ps`, health e smoke. Credenziali, acquisto VPS, scelta tag, proprietà DNS, tunnel/Access, API provider, accettazione costo, migrazioni Langfuse e test pubblico sono azioni umane. Questa guida non rende production-ready autenticazione/tenancy dell'app: Cloudflare Access è il confine raccomandato. Nessuna chiamata a pagamento è necessaria in `fake`.
