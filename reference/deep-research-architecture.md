# Architettura del sistema

L’**Enterprise Sovereign AI Decision Matrix** si basa su un’architettura a componenti integrati. Di seguito uno schema semplificato con **Mermaid.js** (sintassi `graph LR`) per illustrare i moduli principali e le loro interazioni:

```mermaid
graph LR
  subgraph UI
    A[Next.js Frontend\n(Mission Control UI + SSE/WS)]
  end

  subgraph Backend
    B[FastAPI\n(Multi-Agent Gateway)]
    C[LangGraph Engine\n(Agent State Machine)]
    D[LiteLLM Proxy\n(LLM Routing Gateway)]
    E[Database\n(SQLite/PostgreSQL)]
    F[Langfuse\n(Observability & Tracing)]
  end

  A --> |SSE stream| B
  B --> C
  B --> D
  C -->|persist state| E
  C -->|trace events| F
  D -->|calls LLMs / Ollama| External[“Cloud LLMs”]
  D --> Ollama[(Ollama/vLLM Server\n(on-prem LLMs))]

  External -.-> F
  Ollama -.-> F

  style UI fill:#E8F0FE,stroke:#4A90E2
  style Backend fill:#F1F3F5,stroke:#333
```

Nella figura:
- **UI (Next.js)**: un dashboard “Mission Control Matrix” in stile enterprise, che usa SSE/WebSocket per lo streaming in tempo reale dello stato degli agenti.
- **FastAPI Backend**: riceve richieste dalla UI e coordina i vari componenti.
- **LangGraph Engine**: implementa il motore multi-agente come una macchina a stati deterministica. Ogni nodo agente è un *state* del grafo, le transizioni sono regole fisse. La persistenza checkpoint salva lo stato del grafo (per affidabilità e HITL) su DB (es. SQLite/Postgres). Grazie a LangGraph è possibile gestire flussi multi-agente stateful.
- **LiteLLM Proxy**: un gateway OpenAI-compatibile che instrada ogni richiesta al modello più adeguato. Ad esempio, può usare modelli veloci/cheap (es. GPT-3.5) per attività di triage, modelli avanzati (es. GPT-4, Claude) per decisioni critiche, e ricadute “sovereign” (es. modelli locali tipo Llama via Ollama/vLLM) per dati sensibili. Questa configurazione è fatta in un file `config.yaml` di LiteLLM.
- **Osservabilità (Langfuse)**: colleziona tracce, log di esecuzione e metriche di costo per ogni passo agente. Langfuse è un’**piattaforma open-source di LLM engineering** progettata per il monitoraggio e il debug delle app LLM; supporta tracciatura di chiamate LLM, log utente, gestione prompt e metriche.
- **Database**: per persistere checkpoint e dati. In sviluppo può essere SQLite, in produzione PostgreSQL o ClickHouse (usato da Langfuse).

Questa architettura **a eventi** usa SSE/WebSocket per aggiornamenti live, favorendo flussi reattivi. Il motore di orchestrazione LangGraph rende espliciti gli stati e le transizioni (simile a una matrice decisionale). Un modulo Human-In-The-Loop (HITL) può interrompere la catena al bisogno, salvando lo stato e attendendo l’approvazione umana.

## Struttura del repository GitHub

Si consiglia un **monorepo** organizzato per servizi e moduli. Ad esempio:

```
/ (root)
├── frontend/             # Next.js 14 App Router, Tailwind, shadcn/ui, Tremor
│   ├── pages/           # Endpoints e componenti UI
│   ├── components/      # Carta matrice agenti, modali HITL
│   ├── public/          # Assets
│   ├── tailwind.config.js
│   └── next.config.js
│
├── backend/              # FastAPI + LangGraph + LiteLLM config
│   ├── app/
│   │   ├── main.py      # Avvio server
│   │   ├── agents/      # Definizioni nodi/state LangGraph
│   │   ├── routes/      # Endpoints REST/SSE FastAPI
│   │   └── utils/       # Logica comune
│   ├── requirements.txt
│   └── Dockerfile
│
├── liteLLM/              # Configurazioni LiteLLM Proxy
│   └── config.yaml      # Elenco modelli e politiche di routing
│
├── langfuse/             # Configurazione e setup Langfuse (self-hosted)
│   ├── docker-compose.yml
│   └── .env             # Configurazioni DB e chiavi
│
├── .github/              # CI/CD e GitHub Actions workflows
│   ├── workflows/
│   │   ├── ci.yml       # Test unitari, lint
│   │   └── deploy.yml   # Deploy su VPS via Docker Compose
│   ├── ISSUE_TEMPLATE/  # Template issue (feature, bug, HITL requests)
│   └── PULL_REQUEST_TEMPLATE.md
│
└── docker-compose.yml    # Per sviluppo locale: frontend, backend, liteLLM, ollama, langfuse
```

- **frontend/**: applicazione Next.js (React) con App Router, stilizzata con Tailwind CSS, shadcn/ui e Tremor (grafici). Include componenti per la matrice agenti e modali di HITL.
- **backend/app/**: codice Python FastAPI. `main.py` avvia il server e integra LangGraph (definizione flow agents) e LiteLLM (gateway LLM). Un sotto-pacchetto `agents/` contiene i builder del grafo LangGraph con nodi e transizioni.
- **liteLLM/config.yaml**: definisce i modelli backend. Ad esempio, modelli locali via Ollama (p.es. `model: ollama/llama3.2:3b` con `api_base` al container Ollama) e modelli cloud (OpenAI GPT, Claude, etc.).
- **langfuse/**: setup self-hosted di Langfuse (docker-compose), configurato con un database ClickHouse o PostgreSQL locale, Redis e MinIO (object storage) come da template ufficiale.
- **.github/**: file di CI/CD. Su ogni push/PR GitHub Actions eseguono test su LangGraph (unit test dei nodi e transizioni, separati da uno strato mock per chiamate LLM) e lint (es. flake8/black, ESLint).
- **docker-compose.yml (root)**: orchestri i container principali per sviluppo locale: `frontend`, `backend`, `liteLLM`, `ollama-server` (o altro in Colab), e servizi di supporto (DB).

Questa struttura supporta uno sviluppo *GitHub-first*: ogni cambiamento è atomico, issue-driven e integrabile con gli agenti di coding automatici.

## Strumenti e Stack (budget ≤ €250)

- **Frontend**: *Next.js 14 (App Router)*, *React*, *Tailwind CSS*, *shadcn/ui*, *Tremor* (grafici). Tutti open-source e gratuiti.
- **Backend**: *FastAPI* (Python, asincrono) come gateway. *Python 3.10+*. *LangGraph* (pacchetto LangChain) per il motore multi-agente.
- **LLM Gateway**: *LiteLLM* (open-source proxy OpenAI-compatibile) per il routing intelligente. LiteLLM gestisce load-balancing, cache, e fallback (es. locale vs cloud).
- **Sovranità/Sicurezza**: *Ollama* o *vLLM* (local models) container per dati PII. Modelli open come Llama 3.2, Mistral, o gemelli locali. (Costo zero, richiede GPU/CPU dell’host).
- **Persistenza**: *SQLite* per checkpointer in dev (zero cost), *PostgreSQL* o *ClickHouse* in prod (ClickHouse usato da Langfuse). Tutti open-source.
- **Osservabilità**: *Langfuse (self-hosted)*, piattaforma open-source per tracce LLM. Gruppi tipicamente richiedono Redis e MinIO; occhio a costi e risorse aggiuntive. (MinIO + ClickHouse includibili nel VPS).
- **Infrastruttura**: *VPS Hetzner* (es. cloud tipo CX31/CX51 ~ €5-10/mese a seconda di CPU/RAM). Include traffico e IPv4. Con un budget di €250, si possono coprire alcuni mesi di VPS e altri costi. *Cloudflare Tunnel* (Gratuito su tier base) per esporre servizi sul dominio senza IP pubblico permanente. 
- **CI/CD e Repo**: *GitHub* (repo pubblico; azioni CI gratuite per open source). *Aider*, *Claude Code*, *Cursor CLI* (assistenti codifica) sono tool di sviluppo: Aider è open-source Apache2; Claude Code è un agent di Anthropic per terminale; Cursor CLI è un agente terminale (installabile via `curl`). Questi aiutano ad accelerare lo sviluppo in modo issue-driven.
- **Costi stimati**: VPS Hetzner ~€10/mese; Cloudflare Tunnel gratuito; domini già posseduti; uso di modelli commerciali (OpenAI/Anthropic) limitato (p.es. per demo, spendendo al massimo €50 in API token); tool dev (Aider, Cursor) gratuiti; Langfuse e LiteLLM open-source (costo computazionale marginale).

Una breakdown semplificata del budget (€250): 

- VPS Hetzner (3 mesi) ~ €30  
- Configurazione Langfuse (risorse per Redis/MinIO/ClickHouse) incluso nel VPS con Docker (costi HW superiori eventuali)  
- API token buffer (OpenAI/Claude) ~ €50 (per demo ristretta)  
- Altri abbonamenti (Cloudflare gratuito, Github gratuito, tool dev gratuiti) ~ €0  
- Rimanente: ~€170 per eventuali upgrade (ad esempio GPU VPS se serve inference locale di Llama, o consulenze).

I costi maggiori sono hardware. Tutti i framework software elencati sono senza licenza commerciale. Questo garantisce un proof-of-concept sostenibile nel budget.

## Workflow di sviluppo GitHub-Nativo

1. **Setup del repo**: Creare il repository principale su GitHub. Aggiungere `.gitignore`, `README.md`, LICENZA (ad es. MIT). Configurare branch protetti.
2. **Issue templates**: In `.github/ISSUE_TEMPLATE/` creare template per feature (task), bug, e richieste di intervento umano (HITL). Ogni issue con checklist per sottotask (es. “Implementare nodo LangGraph X”, “Scrivere unit test”, “Revisione UI”).
3. **Boilerplate del progetto**:
   - Per il frontend: eseguire `npx create-next-app@latest frontend --typescript` per inizializzare la base.  
   - Per il backend: usare fastapi template, p.es. `pip install fastapi uvicorn`, creare struttura `backend/app/main.py`.
   - Commit iniziale con struttura vuota.
4. **Autonomi AI Agents**:
   - Configurare Aider (`pip install aider-install && aider-install`) nel repo. 
   - Esempio prompt con Aider/Claude: nel terminale `aider --model o3 --api-key <key>` chiedere “Implementa un endpoint FastAPI `/stream` che invia aggiornamenti SSE dagli agenti.” Aider genererà e committerà i file.
   - Usare Claude Code: `claude code --init` nel repo, quindi scrivere prompt come in chat, es. “Create Next.js component AgentCard che si sottoscrive a SSE `/api/agents` e aggiorna lo stato visivo.”.
   - Cursor CLI: installare via `curl https://cursor.com/install -fsS | bash`, poi ad esempio `cursor init` e `cursor create component AgentMatrix --prompt "Explain Next.js SSE streaming component"`.
5. **CI/CD con GitHub Actions**:
   - Creare workflow `.github/workflows/ci.yml`: su ogni PR esegue lint (`eslint`, `flake8`), unit test Python (`pytest`). Per LangGraph, scrivere test unitari per ogni nodo (usando libreria `pytest` e finti dati), in modo da non dover chiamare modelli reali (mock GPT calls).
   - Configurare actions per lanciare container Docker Compose su branch `main` (deploy).
   - Se possibile, usare issue-driven triggers: es. azioni che reagiscono a label specifiche o commenti per generare report.
6. **Prompt per agenti**: strutturare le attività come conversazioni. Es: 
   - Prompt Aider: “Implementerà un nodo LangGraph `ReviewDataNode` che prende una richiesta utente e restituisce `approved` o `rejected` in base a un modello LLM chiamato `reviewModel`.” 
   - Prompt Claude: “Write a GitHub Action YAML to run pytest and flake8 on all changed files. Ensure it triggers on pull_request.” Claude Code genererà il file workflow.
   - Esempio script Cursor CLI: `cursor run --prompt "Create a Dockerfile for FastAPI app with LangGraph and SQLite"`.
7. **Controllo e iterazione**: Ogni output generato va rivisto e testato manualmente. Gli agenti (Aider/Claude/Cursor) compiono commit autonomi, che vengono poi verificati via CI.

In sostanza, lo sviluppo è **modulare e guidato da issue**. Ad ogni issue del progetto (es. “Implementare grafico di matrice agenti”), si chiede all’agente (Aider/Claude) di creare il codice o componenti necessari, testare e committare. Questo permette sviluppo iterativo veloce, come descritto nelle documentazioni di questi tool.

## Fasi di implementazione end-to-end

1. **Fase 1 – Setup iniziale e LangGraph**:  
   - Creare il repository e scaffolding base.  
   - Definire lo schema dello *state graph* per la decision pipeline: quali sono gli stati (nodi agenti) e le transizioni. Ad esempio: `TriageAgent` → (se complesso) → `ExpertDecisionAgent` → (HITL) → `FinalizeActionAgent`.  
   - Implementare con LangGraph: usare il builder Python per creare nodi come funzioni agent (es. funzioni che chiamano `OpenAI.create(...)`).  
   - Configurare il *checkpointer*: in sviluppo usare `langgraph.checkpoint.sqlite.AsyncSqliteSaver("data.db")`; in produzione `AsyncPostgresSaver` con Postgres DB. Questo assicura persistenza deterministica del flusso.
   - Scrivere unit test per i nodi LangGraph: simulare input e verificare output atteso senza chiamare LLM esterni (mock delle risposte).
2. **Fase 2 – Routing LiteLLM**:  
   - Preparare `liteLLM/config.yaml`: elencare modelli locali (es. `ollama/llama3.2:3b`, `ollama/mistral:7b`) e cloud (es. `gpt-4`, `gpt-3.5-turbo`, `claude-3-xxx`).  
   - Definire regole di routing: p.es. taggare richieste sensibili con un flag affinché LiteLLM le invii sempre agli endpoint Ollama locali. Utilizzare le funzionalità di fallback di LiteLLM: se un modello remoto fallisce o per dati PII, instradare automaticamente a quello locale.  
   - Test: inviare richieste di prova al proxy e verificare che raggiungano i provider corretti (si può controllare gli header `request` nel log di LiteLLM).
3. **Fase 3 – SSE e Backend FastAPI**:  
   - In FastAPI definire endpoint SSE, ad es. `@app.get("/api/agents/stream")`, usando `fastapi-sse` o manualmente `yield`. Questo endpoint dovrebbe inviare eventi JSON in tempo reale ogni volta che uno stato agente cambia (subscribe dallo state graph).  
   - Integrare LangGraph nel backend: l’engine LangGraph gira come parte del servizio. Ogni volta che un agente avanza di stato, fare `await f"{server}.broadcast(...)”` per notificare l’UI via SSE.  
   - Verificare in dev: usare `curl -N http://localhost:8000/api/agents/stream` per vedere flusso eventi.
4. **Fase 4 – UI “Mission Control Matrix”**:  
   - Creare componenti shadcn/ui/Tremor per mostrare la matrice di agenti. Ogni “card” visualizza: stato agente, stato esecuzione (running/waiting/completed), metriche (token usati, latenza).  
   - Configurare SSE nel frontend: un hook React (`useEventSource`) si connette all’endpoint SSE e aggiorna lo stato. Ad esempio, usare `const eventSource = new EventSource("/api/agents/stream");` e gestire `onmessage`.  
   - Implementare il modal HITL: quando un agente richiede approvazione (tramite il middleware LangGraph), il backend invia un evento speciale. La UI deve intercettare e mostrare una finestra modale con pulsanti “Approve/Reject/Modify”. L’input utente poi viene inviato indietro (via API o SSE risposta) per sbloccare il flusso.
   - Styling: la UI avrà un look “matrix di controllo” con schede ordinate in griglia. Utilizzare Tremor per grafici (es. token usage trend).
5. **Fase 5 – Langfuse observability**:  
   - Avviare Langfuse in modalità self-hosted. Usare il `docker-compose.yml` ufficiale. Questo alza servizi: web server Langfuse, worker, Redis, MinIO, ClickHouse, Postgres, ecc. Occorre configurare `.env` con credenziali.  
   - Integrare il logging nel codice Python: ogni volta che si chiama un LLM (via OpenAI SDK o LiteLLM), mandare evento a Langfuse usando il suo SDK Python (richiede `langfuse.client.ApiKeyAuth`). In alternativa, usare callback di LiteLLM (`success_callback`) per inviare tracce. Ciò permette traccia completa di prompt, risposte e costo.  
   - Verificare nel dashboard Langfuse: dovrebbero comparire sessioni d’uso con visualizzazione di ogni passaggio agente, costi token e logs.
6. **Fase 6 – Deploy di produzione**:  
   - Unire tutto in Docker Compose per la VPS Hetzner: i container necessari sono `frontend`, `backend`, `liteLLM`, `ollama-server` (p.es. `llama.cpp` container o `docker.ollama/ollama`), e i servizi Langfuse.  
   - Esempio `docker-compose.yml` (semplificato):
     ```yaml
     version: "3.9"
     services:
       backend:
         build: ./backend
         ports: ["8000:8000"]
         depends_on: [lite_llm, ollama]
         environment:
           - DATABASE_URL=sqlite:///data/langgraph.db
       frontend:
         build: ./frontend
         ports: ["3000:3000"]
         depends_on: [backend]
       lite_llm:
         image: litellm/proxy:latest
         volumes: ["./liteLLM/config.yaml:/app/config.yaml"]
         ports: ["4000:4000"]
       ollama:
         image: ollama/ollama:latest
         ports: ["11434:11434"]
       # Langfuse components:
       langfuse-web:
         image: docker.langfuse.com/langfuse/langfuse-web:4
         ports: ["3001:3000"]  # example port
         depends_on: [postgres, clickhouse, redis, minio]
         env_file: ./langfuse/.env
       langfuse-worker:
         image: docker.langfuse.com/langfuse/langfuse-worker:4
         env_file: ./langfuse/.env
         depends_on: [postgres, redis, clickhouse, minio]
       clickhouse:
         image: clickhouse/clickhouse-server:latest
         ports: ["8123:8123"]
       postgres:
         image: postgres:15
         environment:
           POSTGRES_PASSWORD: example
       redis:
         image: redis:7
       minio:
         image: minio/minio:latest
         environment:
           MINIO_ROOT_USER: minio
           MINIO_ROOT_PASSWORD: miniosecret
         command: server /data
         ports: ["9000:9000"]
     ```
     Questo file lancia tutti i servizi. Va adattato con volumi per persistenza. Langfuse adotta ClickHouse e MinIO per storage.
   - Avviare con `docker compose up -d`. Aprire Cloudflare Tunnel verso le porte 3000 (frontend) e 8000 (backend), così da incapsulare i servizi dietro il dominio `neuromorphicinference.com`.
   - Verificare end-to-end: dal frontend, pilotare agenti e vedere tracce in Langfuse.

## Codice e Configurazioni Pronte all’Uso

**1. LangGraph (Python): nodo HITL d’esempio**  
```python
from langgraph.builder import GraphBuilder
from langchain.agents import create_agent
from langchain.agents.middleware import HumanInTheLoopMiddleware
from langgraph.checkpoint.postgres import AsyncPostgresSaver

# Configuro il checkpointer persistente (Postgres)
checkpointer = AsyncPostgresSaver.from_conn_string(
    "postgresql://user:password@localhost/langgraph_db"
)

# Costruisco l’agente con middleware HITL
agent = create_agent(
    model="gpt-4",
    tools=[your_tool_functions...],  # strumenti disponibili
    middleware=[
        HumanInTheLoopMiddleware(
            interrupt_on={"write_file": True},  # pausa su write_file
            description_prefix="Azione in attesa di approvazione:",
        )
    ],
    checkpointer=checkpointer,
)
graph = GraphBuilder().add_agent("MainAgent", agent).build()

# Esempio di invocazione (thread unico)
result = graph.invoke({"messages": [{"role": "user", "content": "Analizza X"}]})
```
In questo snippet si vede la configurazione di `HumanInTheLoopMiddleware` che *interrompe* l’esecuzione su certe azioni (es. `write_file`), salvando lo stato del grafo nel checkpointer. Il checkpointer asincrono su Postgres garantisce che il thread di conversazione possa riprendere anche dopo un crash o in attesa dell’intervento umano.

**2. LiteLLM config.yaml** (in `liteLLM/config.yaml`):  
```yaml
# Definizione dei modelli serviti dal proxy LiteLLM
model_list:
  # Modelli locali via Ollama (uso locale, sovrano)
  - model_name: llama3
    litellm_params:
      model: ollama/llama3.2:3b
      api_base: http://ollama:11434
  - model_name: mistral7b
    litellm_params:
      model: ollama/mistral:7b
      api_base: http://ollama:11434

  # Modelli cloud (richiedono chiavi API)
  - model_name: gpt-4
    litellm_params:
      model: gpt-4
      api_key: ${OPENAI_API_KEY}
  - model_name: gpt-3.5-turbo
    litellm_params:
      model: gpt-3.5-turbo
      api_key: ${OPENAI_API_KEY}

router_settings:
  routing_strategy: simple-shuffle
  # Esempio: tutte le richieste con "model=gpt-4" vengono indirizzate a GPT-4 cloud
  model_group_alias: { "gpt-4": "gpt-4" }

general_settings:
  master_key: sk-master-key-goes-here
  database_url: "sqlite:///./litellm_logs.db"  # per logging locale

# Abilita cache o policy di fallback se serve
```
Questo file YAML mostra come indicare a LiteLLM più “deployment” sotto un unico nome. Ad esempio, si configura un modello locale “llama3” (via Ollama) e quelli cloud GPT-4/3.5. In fase di routing si può definire quali richieste inviare a quale modello. LiteLLM gestisce automaticamente fallback e load-balancing.

**3. React (Next.js) – Componente AgentCard con SSE**:  
```tsx
import { useEffect, useState } from "react";

interface AgentStatus {
  id: string;
  state: string;
  tokens: number;
  latency: number;
}

export default function AgentCard({ agent }: { agent: AgentStatus }) {
  const [status, setStatus] = useState(agent);
  const [eventSource] = useState(new EventSource("/api/agents/stream"));

  useEffect(() => {
    eventSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.id === agent.id) {
        setStatus(data);
      }
    };
    return () => eventSource.close();
  }, [agent.id, eventSource]);

  return (
    <div className="border p-4 rounded-lg shadow-md">
      <h3 className="text-xl font-bold">Agente {status.id}</h3>
      <p>Stato: <span className="font-mono">{status.state}</span></p>
      <p>Token usati: {status.tokens}</p>
      <p>Latenza: {status.latency} ms</p>
      {status.state === "AWAITING_APPROVAL" && (
        <button className="mt-2 px-4 py-2 bg-blue-500 text-white rounded">Approve</button>
      )}
    </div>
  );
}
```
Questo componente React (per Next.js) si sottoscrive al flusso SSE all’endpoint `/api/agents/stream`. Quando arrivano eventi JSON con aggiornamenti (inviati dal backend FastAPI), aggiorna lo *state* con `setStatus`. Visualizza ID agente, stato corrente, token e latenza. Se lo stato richiede approvazione (“AWAITING_APPROVAL”), mostra un pulsante di approvazione. L’uso di `EventSource` segue la pratica standard SSE. In un’app reale, gestiremo anche gli altri pulsanti (Reject/Edit) e i relativi callback.

**4. Docker Compose – Stack completo** (`docker-compose.yml`):  
```yaml
version: "3.9"
services:
  # Frontend Next.js
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on: [backend]

  # Backend FastAPI
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    depends_on: [lite_llm, ollama]
    environment:
      - DATABASE_URL=sqlite:///data/langgraph.db

  # LiteLLM Proxy
  lite_llm:
    image: litellm/proxy:latest
    ports:
      - "4000:4000"
    volumes:
      - ./liteLLM/config.yaml:/app/config.yaml

  # Ollama (local LLM server)
  ollama:
    image: ghcr.io/ollama/ollama:latest
    ports:
      - "11434:11434"
    # Configurazioni variabili per Ollama se necessarie

  # Langfuse Web UI
  langfuse-web:
    image: docker.langfuse.com/langfuse/langfuse-web:4
    ports:
      - "3001:3000"
    depends_on:
      - langfuse-worker
      - clickhouse
      - postgres
      - redis
      - minio
    env_file: ./langfuse/.env

  # Langfuse Worker
  langfuse-worker:
    image: docker.langfuse.com/langfuse/langfuse-worker:4
    env_file: ./langfuse/.env
    depends_on:
      - postgres
      - redis
      - clickhouse
      - minio

  # Database e storage per Langfuse
  clickhouse:
    image: clickhouse/clickhouse-server:latest
    ports: ["8123:8123"]

  postgres:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: example

  redis:
    image: redis:7

  minio:
    image: minio/minio:latest
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: miniosecret
    command: server /data
    ports: ["9000:9000"]
```

Questo `docker-compose.yml` mette insieme tutti i microservizi. Le parti principali sono `frontend` (Next.js), `backend` (FastAPI + LangGraph), il proxy `lite_llm`, il server locale `ollama`, e il cluster Langfuse (`langfuse-web`, `langfuse-worker`, ClickHouse, Postgres, Redis, MinIO). Langfuse è reso facilmente deployabile grazie all’architettura con ClickHouse e servizi di supporto. Bisogna personalizzare i file `.env` (password, chiavi) e aprire le porte interne necessarie.

## Riferimenti

- LangGraph (LangChain): flussi multi-agente, macchine a stati con persistenza e HITL.  
- LiteLLM: configurazione YAML per routing e load-balancing di modelli.  
- Langfuse: piattaforma osservabilità LLM (self-hosted, Open Source).  
- Aider: tool open-source di pair-programming AI (Apache-2).  
- Claude Code: agente agente di sviluppo in terminale (Anthropic).  
- Cursor CLI: agente AI per terminale (installabile via `curl`).  

Questi riferimenti confermano l’uso degli strumenti menzionati e ne spiegano i principi. Ad esempio, LangGraph descrive il concetto di multi-agent come grafo a stati e il middleware HITL salva lo stato del grafo su persister. Il proxy LiteLLM unifica modelli diversi sotto un’unica API e supporta log/cost tracking. Langfuse è esplicitamente pensato per osservabilità LLM.

In sintesi, l’architettura proposta soddisfa tutti i requisiti: interfaccia operativa in tempo reale, orchestrazione multi-agente con stato persistente, routing intelligente tra LLM e fallback sovrano, auditing completo via Langfuse, e un workflow di sviluppo GitHub-centric grazie ad agenti di coding e CI/CD. Il budget limitato viene rispettato usando soluzioni open-source e risorse cloud economiche.