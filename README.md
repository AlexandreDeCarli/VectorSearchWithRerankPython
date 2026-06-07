# VectorSearch with Rerank (Python)

<div align="center">

**Busca Semântica por Vetores com Reranking via FlashRank**

[![Python](https://img.shields.io/badge/runtime-Python_3.11-3776AB?logo=python&logoColor=white)](https://www.python.org)
[![FastAPI](https://img.shields.io/badge/backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/frontend-React_18-61dafb?logo=react&logoColor=white)](https://react.dev)
[![MariaDB](https://img.shields.io/badge/dev_db-MariaDB_11.8-003545?logo=mariadb&logoColor=white)](https://mariadb.org)
[![MySQL](https://img.shields.io/badge/prod_db-MySQL_HeatWave-4479A1?logo=mysql&logoColor=white)](https://www.oracle.com/mysql/heatwave/)
[![FlashRank](https://img.shields.io/badge/rerank-FlashRank_0.2-FF6F00?logo=lightning)](https://github.com/PrithivirajDamodaran/FlashRank)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

</div>

---

## O que é?

**VectorSearch with Rerank (Python)** é uma aplicação full-stack de **busca semântica avançada** estruturada em **duas fases** (Retrieval-Augmented Generation / RAG ready). 

Diferente de sistemas de busca vetorial simples, este projeto introduz um estágio secundário de **re-ranqueamento com Cross-Encoder (FlashRank)**. Isso resolve as limitações conceituais de similaridade por cosseno pura (que apenas compara embeddings distantes) ao re-avaliar o contexto semântico real entre a pergunta do usuário e o conteúdo do documento.

### Exemplo prático da Busca em Duas Fases

Ao cadastrar 3 documentos:
1. 📄 *"Como programar redes neurais e IA usando Python"*
2. 📄 *"Guia técnico sobre baterias de carros elétricos"*
3. 📄 *"Receita tradicional de pão de queijo caseiro"*

Pesquisando por: **"criar algoritmos de inteligência artificial"**

```
Fase 1: Vector Recall (Similaridade de Cosseno no Banco)
 ├── 🥇 "redes neurais..." ──▶ 86.4% de similaridade
 ├── 🥈 "baterias..."      ──▶ 41.2% de similaridade
 └── 🥉 "pão de queijo..." ──▶ 14.8% de similaridade

Fase 2: FlashRank Reranking (Re-ordenação Contextual Cross-Encoder)
 ├── 🏆 redes neurais... ──▶ 98.7% de relevância (Pontuação final ajustada)
 └── Outros documentos são filtrados/reordenados com base no score semântico real
```

---

## Arquitetura

```
┌────────────────────────────────────────────────────────┐
│               Docker Container (Python)                │
│                                                        │
│   ┌──────────────────┐     ┌────────────────────────┐  │
│   │  React Frontend  │     │    FastAPI Backend     │  │
│   │  (SPA estática)  │ ──▶ │  REST API + JWT Auth   │  │
│   └──────────────────┘     └───────────┬────────────┘  │
│                                        │               │
│   ┌────────────────────────────────────┘               │
│   ├─▶ backend/sql_dialect.py (Abstração DB)            │
│   ├─▶ backend/migrate.py (Migrations automáticas)      │
│   └─▶ backend/reranker.py (FlashRank Cross-Encoder)     │
└────────────────────────────────────────────────────────┘
    │
    ├──────────────────────────┬─────────────────────────┐
    ▼                          ▼                         ▼
┌────────────────────┐  ┌──────────────┐  ┌─────────────────────────────┐
│ Google Gemini API  │  │ Rerank Engine│  │       Banco de Dados        │
│ gemini-embedding-2 │  │ Multi-modelo │  │                             │
│ 768 dimensões      │  │ (T5/ONNX/HF) │  │  DEV:  MariaDB 11.8 (HNSW)  │
└────────────────────┘  └──────────────┘  │  PROD: MySQL HeatWave (OCI) │
                                         └─────────────────────────────┘
```

### Stack Tecnológico

| Camada | Tecnologia | Função |
|--------|-----------|--------|
| **Runtime** | [Python 3.11](https://www.python.org) | Ambiente de execução estável e padrão para IA |
| **Backend** | [FastAPI](https://fastapi.tiangolo.com) | Framework HTTP de alta performance com validação automática de dados |
| **Reranker** | Hybrid Engine (PyTorch/ONNX) | Suporte nativo a T5 Seq2Seq (monoptt5), FlashRank (ONNX) e Cross-Encoders (HF) |
| **Frontend** | [React 18](https://react.dev) + [Vite](https://vite.dev) | SPA com tema escuro glassmórfico e exibição de Rerank Score |
| **Embeddings** | [Google Gemini API](https://ai.google.dev) | Modelo `gemini-embedding-2` gerando vetores de 768 dimensões |
| **DB Local** | [MariaDB 11.8](https://mariadb.org) | Busca vetorial nativa com índices HNSW acelerados localmente |
| **DB Produção** | [MySQL HeatWave](https://www.oracle.com/mysql/heatwave/) | Busca vetorial corporativa escalável na Oracle Cloud (OCI) |
| **Autenticação** | JWT (HS256) | Autenticação de rotas protegidas usando `python-jose` |

---

## Funcionalidades

### 🔐 Autenticação
- Login administrativo configurado via variáveis de ambiente.
- Sessão stateless segura por Bearer Token JWT.
- Proteção centralizada via injeção de dependências do FastAPI (`Depends(get_current_user)`).

### 📄 CRUD de Documentos
- Gerenciamento completo de documentos (criar, visualizar, listar, editar e excluir).
- Re-geração inteligente de embeddings: a API detecta se o conteúdo mudou e só aciona a API do Gemini se for estritamente necessário, otimizando cota de requisições.

### 🔍 Busca Semântica em Duas Fases
1. **Vector Recall (Fase 1)**: Converte a pesquisa em um vetor e realiza busca de alta velocidade trazendo o top-K candidatos (ajustável via `RERANK_TOP_K`, padrão `50`).
   - Suporta métricas **Cosseno (`COSINE`)**, **Produto Escalar (`DOT`)** e **Euclidiana (`EUCLIDEAN`)**.
2. **Hybrid Reranking (Fase 2)**: Os documentos retornados são re-ranqueados localmente usando o modelo configurado em `RERANK_MODEL` (com fallback automático de arquiteturas).

### 🧠 Motores e Modelos de Reranking

O backend do projeto foi arquitetado com um motor híbrido dinâmico que detecta automaticamente a arquitetura do modelo de reranking configurado na variável `RERANK_MODEL` e escolhe o melhor pipeline de processamento:

#### 1. Seq2Seq T5 (Inferência Generativa)
- **Como funciona**: Modelos baseados em T5 (como o padrão `unicamp-dl/monoptt5-base`) avaliam a relevância de forma generativa. O backend formata o input como `Query: <pergunta> Document: <documento> Relevant:`. O modelo então gera a probabilidade do próximo token (ex: " Sim" ou " Não").
- **Diferencial**: O backend extrai os logits brutos dos tokens afirmativos/negativos em português (` Sim`/` Não`), inglês (` true`/` false` ou ` yes`/` no`) e calcula a função **Softmax** sobre eles. A pontuação de relevância (`rerank_score`) é a probabilidade do token afirmativo.
- **Modelos Recomendados**:
  - `unicamp-dl/monoptt5-base` (Padrão do Projeto - 890MB) — Altíssimo desempenho em português.
  - `unicamp-dl/monoptt5-large` (3.3GB) — Máxima precisão para português (requer mais memória/GPU).
  - `castorini/monot5-base-msmarco-10k` (890MB) — Excelente alternativa para inglês.
- **Requisitos de Hardware**: Médio-Alto (PyTorch). Funciona em CPU, mas se beneficia fortemente de aceleração por GPU (CUDA). Recomenda-se reservar pelo menos 4GB de RAM para o Docker.

#### 2. FlashRank (ONNX Runtime de Alta Velocidade)
- **Como funciona**: Utiliza modelos de Cross-Encoder convertidos para o formato ONNX. A inferência é feita diretamente no processador (CPU) através de threads C++ otimizadas de forma extremamente leve, sem necessidade de PyTorch ou bibliotecas pesadas de Deep Learning.
- **Diferencial**: Latência baixíssima (<50ms para lotes normais) e baixíssimo consumo de memória RAM (<150MB no total).
- **Modelos Recomendados**:
  - `ms-marco-MiniLM-L-12-v2` (50MB) — Muito rápido, ótimo para testes rápidos em inglês.
  - `ms-marco-MultiBERT-L-12` (470MB) — Suporte multilíngue leve.
  - `ce-esci-MiniLM-L12-v2` (50MB) — Ajustado para e-commerce.
- **Requisitos de Hardware**: Mínimos. Roda em qualquer máquina local.

#### 3. Sentence-Transformers (Classificadores Cross-Encoder PyTorch)
- **Como funciona**: Fallback para modelos Cross-Encoder tradicionais do Hugging Face. O modelo prevê uma pontuação numérica direta de similaridade (logit) para cada par de pergunta e documento.
- **Diferencial**: O backend normaliza esses logits aplicando a função **Sigmóide** (`1 / (1 + e^-logit)`), transformando qualquer número real em uma probabilidade elegante de 0.0 a 1.0.
- **Modelos Recomendados**:
  - `nreimers/mmarco-mMiniLMv2-L12-H384-v1` (117MB) — Excelente reranker multilíngue de tamanho moderado.
  - `BAAI/bge-reranker-v2-m3` (1.1GB) — Estado da arte em buscas multilíngues, mas pesado.
- **Requisitos de Hardware**: Baixo a Médio (dependendo do tamanho do modelo).

---

### 📊 Tabela Comparativa de Modelos de Trabalho

| Modelo | Tipo/Motor | Tamanho | Idioma Principal | Velocidade | Consumo de RAM (Aprox.) |
|:---|:---|:---|:---|:---|:---|
| **`unicamp-dl/monoptt5-base`** (Padrão) | Seq2Seq T5 (PyTorch) | ~890 MB | Português | Média | ~1.5 GB |
| **`nreimers/mmarco-mMiniLMv2-L12-H384-v1`** | Cross-Encoder (PyTorch) | ~117 MB | Multilíngue | Alta | ~400 MB |
| **`ms-marco-MiniLM-L-12-v2`** | FlashRank (ONNX) | ~50 MB | Inglês | Altíssima | ~100 MB |
| **`ms-marco-MultiBERT-L-12`** | FlashRank (ONNX) | ~470 MB | Multilíngue | Alta | ~500 MB |
| **`BAAI/bge-reranker-v2-m3`** | Cross-Encoder (PyTorch) | ~2.24 GB | Multilíngue | Baixa-Média | ~2.5 GB |

> [!CAUTION]
> Ao utilizar modelos pesados como `BAAI/bge-reranker-v2-m3` ou `unicamp-dl/monoptt5-base` dentro de containers Docker, garanta que o Docker Desktop (ou daemon de execução) possua limites de memória RAM adequados (mínimo de **4 GB** recomendados, idealmente **6-8 GB** se houver outros containers ativos em paralelo). Caso contrário, o container do backend sofrerá crash silencioso com código **OOM `137`**.

> [!IMPORTANT]
> **Aceleração por CPU & Precisão:**
> Para garantir alto desempenho, o backend carrega os modelos PyTorch em **`float32`** (precisão nativa) no CPU. Embora `bfloat16` reduza o consumo de RAM, a maioria das CPUs virtualizadas no macOS/Docker não possui instruções de hardware nativas para bfloat16, o que força o PyTorch a usar emulação lenta de software (`BLAS gemm`), travando a CPU do host. O carregamento em `float32` nativo roda em frações de segundos, mas exige o limite mínimo de RAM no Docker especificado acima.

---

### 📥 Importação em Lote (Batch Import)
- Importação de JSON contendo múltiplos arquivos estruturados em base64.
- logs em tempo real na tela do console.
- Sistema de proteção contra duplicidade com prevenção de colisões de nomes por prefixo (`#ID`).

### 🛠️ UX Avançado
- **Visualizador Expansivo ("Ver mais")**: Cards na grade de resultados de busca que excedem o tamanho máximo exibem um gatilho de expansão que abre um modal com o texto original em monospace.
- **Excluir Todos (Delete All)**: Opção destrutiva com dupla confirmação e tela de modal para limpar a base de dados vetorial de documentos de forma simples.

---

## Schema do Banco de Dados

```sql
CREATE TABLE IF NOT EXISTS vector_documentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    conteudo MEDIUMTEXT NOT NULL,
    embedding VECTOR(768) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    VECTOR INDEX idx_embedding (embedding) M=8 DISTANCE=cosine
);
```

### Queries de Busca Vetorial (Fase 1: Recall)

As buscas iniciais no banco de dados são traduzidas dinamicamente de acordo com o dialeto ativo pelo helper `get_vector_search_sql(metric)`:

#### MariaDB (dev)
- **Cosseno (`COSINE`)**:
  ```sql
  SELECT id, titulo, conteudo, (1 - VEC_DISTANCE_COSINE(embedding, VEC_FromText(%s))) AS similarity
  FROM vector_documentos ORDER BY similarity DESC LIMIT 50;
  ```
- **Produto Escalar (`DOT`)**:
  ```sql
  SELECT id, titulo, conteudo, VEC_DISTANCE(embedding, VEC_FromText(%s)) AS similarity
  FROM vector_documentos ORDER BY similarity DESC LIMIT 50;
  ```
- **Euclidiana (`EUCLIDEAN`)**:
  ```sql
  SELECT id, titulo, conteudo, VEC_DISTANCE_EUCLIDEAN(embedding, VEC_FromText(%s)) AS similarity
  FROM vector_documentos ORDER BY similarity ASC LIMIT 50;
  ```

#### MySQL HeatWave (prod)
- **Cosseno (`COSINE`)**:
  ```sql
  SELECT id, titulo, conteudo, (1 - DISTANCE(embedding, STRING_TO_VECTOR(%s), 'COSINE')) AS similarity
  FROM vector_documentos ORDER BY similarity DESC LIMIT 50;
  ```

---

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto conforme a estrutura de [.env.example](file:///Users/alexandre/Documents/ProjetosAntigravity/VectorSearchWithRerankPython/.env.example):

```env
PORT=3000
DB_HOST=localhost
DB_USER=app_user
DB_PASS=app_password
DB_NAME=meu_vector_db
DB_PORT=3306
DB_DIALECT=mariadb
GEMINI_API_KEY=sua_chave_api_aqui
GEMINI_MODEL=gemini-embedding-2
APP_USERNAME=admin
APP_PASSWORD=local_app_password
JWT_SECRET=supersecretlocaljwtkey123!
ADMIN_EMAIL=admin@example.com
MAX_UPLOAD_SIZE_MB=10
RERANK_MODEL=unicamp-dl/monoptt5-base
RERANK_TOP_K=50
```

---

## Setup & Execução Local

### Opção 1: Docker Compose (Recomendado)

Sobe a aplicação unificada FastAPI + MariaDB 11.8 com suporte a busca vetorial nativa:

```bash
# 1. Clone o repositório
git clone https://github.com/AlexandreDeCarli/VectorSearchWithRerankPython.git
cd VectorSearchWithRerankPython

# 2. Copie e preencha as variáveis de ambiente no .env
cp .env.example .env

# 3. Inicie os containers com build automático
docker compose up --build
```

O sistema irá aguardar a inicialização completa do banco de dados, aplicar as migrations automáticas pendentes, fazer o download do modelo FlashRank no cache local e expor a API na porta `3000`.

### Opção 2: Execução Manual no Host

#### Backend
```bash
# Instale as dependências Python
pip install -r requirements.txt

# Inicie o servidor ASGI FastAPI
python -m uvicorn backend.main:app --reload --port 3000
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Migrations Automáticas

As migrations vivem na pasta `/migrations` e são gerenciadas pelo arquivo [migrate.py](file:///Users/alexandre/Documents/ProjetosAntigravity/VectorSearchWithRerankPython/backend/migrate.py) no startup. 

O sistema reconhece os seguintes formatos:
- `*.mariadb.sql` — Executa apenas sob dialeto `mariadb`
- `*.heatwave.sql` — Executa apenas sob dialeto `heatwave`
- `*.sql` — Executa em ambos de forma agnóstica

---

## API Endpoints

Todas as rotas requerem o cabeçalho `Authorization: Bearer <token>` (com exceção do login).

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/auth/login` | Login administrativo (retorna token JWT) |
| `GET` | `/api/documents` | Listar metadados dos documentos cadastrados |
| `GET` | `/api/documents/:id` | Detalhar conteúdo de um documento |
| `POST` | `/api/documents` | Criar um novo documento e gerar seu embedding |
| `POST` | `/api/documents/import` | Importação em lote (JSON c/ base64) |
| `PUT` | `/api/documents/:id` | Editar título/conteúdo de documento existente |
| `DELETE` | `/api/documents` | Excluir todos os registros da tabela |
| `DELETE` | `/api/documents/:id` | Excluir um documento por ID |
| `POST` | `/api/search` | Busca semântica em duas fases (Recall + Reranking) |

### Formato de Retorno de Busca (`POST /api/search`)

A resposta do endpoint de busca retorna a similaridade vetorial bruta calculada pelo banco (`similarity`) e a nota re-processada refinada pelo FlashRank (`rerank_score`):

```json
[
  {
    "id": 1,
    "titulo": "contrato_01.txt",
    "conteudo": "...",
    "similarity": 0.8924,
    "rerank_score": 0.9875
  }
]
```

---

## Referências

- [FastAPI Framework Documentation](https://fastapi.tiangolo.com)
- [FlashRank Python Library](https://github.com/PrithivirajDamodaran/FlashRank)
- [Google Gemini Embedding API](https://ai.google.dev/gemini-api/docs/embeddings)
- [MariaDB Vector Functions](https://mariadb.com/docs/server/reference/sql-functions/vector-functions/)

---

## Licença

[MIT](LICENSE) © Alexandre De Carli
