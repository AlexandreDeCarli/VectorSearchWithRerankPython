# VectorSearch with Rerank (Python)

Sistema de busca vetorial com **reranking via FlashRank**, construído com **FastAPI** (Python) e frontend **React + TypeScript**.

## ✨ Funcionalidades

- 📄 **CRUD de Documentos** — Criar, editar, excluir e listar documentos com embeddings vetoriais
- 📥 **Importação em Lote** — Upload de JSON com documentos em base64 com detecção de duplicatas
- 🔍 **Busca Vetorial** — Pesquisa por similaridade usando embeddings do Google Gemini (768 dimensões)
- 🏆 **Reranking com FlashRank** — Re-ordenação dos resultados usando cross-encoder para maior precisão
- 🔐 **Autenticação JWT** — Login seguro com tokens Bearer
- 🗄️ **Multi-Dialect SQL** — Suporte a MariaDB 11.7+ e MySQL HeatWave (OCI)
- 🔄 **Migrations Automáticas** — Sistema de migrations SQL executado no startup

## 🏗️ Arquitetura

```
┌─────────────────┐     ┌──────────────────────────────────────────┐
│   React (Vite)  │────▶│  FastAPI (Python 3.11+)                  │
│   Frontend      │     │                                          │
│                 │     │  ┌─────────┐  ┌──────────┐  ┌─────────┐ │
│  • Dashboard    │     │  │ Gemini  │  │ MariaDB/ │  │FlashRank│ │
│  • Busca        │     │  │Embedding│  │ HeatWave │  │Reranker │ │
│  • Import       │     │  └─────────┘  └──────────┘  └─────────┘ │
└─────────────────┘     └──────────────────────────────────────────┘
```

### Pipeline de Busca (Duas Fases)

1. **Vector Recall** — Busca top-K candidatos (K=50) via similaridade vetorial no banco
2. **FlashRank Reranking** — Re-ordena com cross-encoder, retorna top-N (N=10)

## 🚀 Quick Start

### Pré-requisitos

- Python 3.11+
- Node.js 18+ (para build do frontend)
- MariaDB 11.7+ ou MySQL HeatWave
- Chave de API do Google Gemini

### Setup Local

```bash
# 1. Clone o repositório
git clone https://github.com/AlexandreDeCarli/VectorSearchWithRerankPython.git
cd VectorSearchWithRerankPython

# 2. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais

# 3. Instale as dependências Python
pip install -r requirements.txt

# 4. Instale e build o frontend
cd frontend && npm install && npm run build && cd ..

# 5. Inicie o servidor
python -m uvicorn backend.main:app --reload --port 3000
```

### Docker Compose

```bash
# Desenvolvimento (com MariaDB local)
docker compose up --build

# Produção (com HeatWave externo)
docker compose -f docker-compose.prod.yml up --build
```

## ⚙️ Variáveis de Ambiente

| Variável | Descrição | Default |
|----------|-----------|---------|
| `PORT` | Porta do servidor | `3000` |
| `DB_HOST` | Host do banco de dados | `localhost` |
| `DB_USER` | Usuário do banco | `root` |
| `DB_PASS` | Senha do banco | `root` |
| `DB_NAME` | Nome do banco | `meu_vector_db` |
| `DB_PORT` | Porta do banco | `3306` |
| `DB_DIALECT` | Dialeto SQL (`mariadb` ou `heatwave`) | `mariadb` |
| `GEMINI_API_KEY` | Chave da API Google Gemini | — |
| `GEMINI_MODEL` | Modelo de embedding | `gemini-embedding-2` |
| `APP_USERNAME` | Usuário para login | `admin` |
| `APP_PASSWORD` | Senha para login | — |
| `JWT_SECRET` | Segredo para tokens JWT | `local_jwt_secret` |
| `RERANK_MODEL` | Modelo FlashRank | `ms-marco-MiniLM-L-12-v2` |
| `RERANK_TOP_K` | Candidatos para recall vetorial | `50` |

## 📡 API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/auth/login` | Autenticação (retorna JWT) |
| `GET` | `/api/documents` | Listar documentos |
| `GET` | `/api/documents/:id` | Obter documento por ID |
| `POST` | `/api/documents` | Criar documento |
| `POST` | `/api/documents/import` | Importar documento (base64) |
| `PUT` | `/api/documents/:id` | Atualizar documento |
| `DELETE` | `/api/documents` | Excluir todos |
| `DELETE` | `/api/documents/:id` | Excluir por ID |
| `POST` | `/api/search` | Busca vetorial com reranking |

### Exemplo de Busca

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"query": "contrato de aluguel", "metric": "COSINE"}'
```

Resposta:
```json
[
  {
    "id": 1,
    "titulo": "contrato_001.txt",
    "conteudo": "Contrato de aluguel residencial...",
    "similarity": 0.89,
    "rerank_score": 0.95
  }
]
```

## 📁 Estrutura do Projeto

```
├── backend/
│   ├── __init__.py
│   ├── main.py              # Entry point FastAPI
│   ├── config.py             # Configuração via env vars
│   ├── database.py           # Pool de conexões MySQL
│   ├── sql_dialect.py        # Abstração MariaDB/HeatWave
│   ├── gemini_client.py      # Geração de embeddings
│   ├── auth.py               # Autenticação JWT
│   ├── reranker.py           # Integração FlashRank
│   ├── migrate.py            # Sistema de migrations
│   └── routers/
│       ├── documents.py      # CRUD de documentos
│       └── search.py         # Busca vetorial + reranking
├── frontend/                  # React + TypeScript (Vite)
├── migrations/                # Arquivos SQL de migração
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── docker-compose.prod.yml
```

## 🔧 Desenvolvimento

```bash
# Backend (com hot reload)
python -m uvicorn backend.main:app --reload --port 3000

# Frontend (dev server com proxy)
cd frontend && npm run dev
```

## 📜 Licença

MIT License
