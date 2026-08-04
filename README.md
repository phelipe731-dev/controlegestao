# CampanhaHub

Plataforma web SaaS para gestao interna de campanha politica com foco em apoiadores, lideres, supervisores e administradores, evitando termos como "voto garantido" e registrando consentimento LGPD.

## O que o MVP entrega

- Login com JWT, controle de sessao e fluxo de recuperacao de senha por token
- Perfis `ADMIN`, `SUPERVISOR` e `LEADER` com escopo de acesso no frontend e backend
- CRUD de lideres, supervisores e apoiadores
- Validacao de duplicidade por CPF, titulo de eleitor e telefone quando informado
- Aviso de conflito quando um apoiador ja esta vinculado a outro lider
- Dashboard com totais, ranking e graficos por dia, lider, bairro e cidade
- Relatorio filtravel por lider, supervisor, cidade, bairro, zona eleitoral, periodo e status
- Exportacao em CSV e Excel
- Auditoria de criacao, edicao, exclusao, transferencia, login e anonimização
- Registro de consentimento LGPD com origem e horario
- Comunicacao por WhatsApp preparada para Evolution API com conexao por QR Code e disparo rastreavel

## Stack

- Frontend: React + TypeScript + Tailwind CSS + Vite
- Backend: Node.js + Express + TypeScript
- Banco: PostgreSQL
- ORM: Prisma
- Autenticacao: JWT
- Deploy local: Docker Compose

## Estrutura

```text
.
├── backend
│   ├── prisma
│   │   ├── migrations
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src
├── frontend
│   └── src
├── docker-compose.yml
└── README.md
```

## Como rodar com Docker

1. Copie o arquivo de ambiente da raiz:

```bash
cp .env.example .env
```

2. Ajuste ao menos estes valores em `.env`:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `FRONTEND_URL`
- `VITE_API_URL`
- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` e `EVOLUTION_INSTANCE_NAME` se for usar WhatsApp via Evolution API

3. Suba tudo:

```bash
docker compose up -d --build
```

4. Acesse:

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend: [http://localhost:3333/health](http://localhost:3333/health)

O container do backend executa automaticamente:

- `prisma migrate deploy`

Se quiser carregar os dados de demonstracao uma unica vez:

```bash
docker compose exec backend npm run prisma:seed
```

Tambem e possivel ativar o seed automatico no primeiro boot definindo `RUN_SEED_ON_START=true` no `.env`.

## Deploy em VPS

1. Na VPS, instale `docker`, `docker compose`, `git` e `nginx`.
2. Clone o repositorio:

```bash
git clone <URL_DO_REPOSITORIO> campanhahub
cd campanhahub
```

3. Crie o arquivo de ambiente:

```bash
cp .env.example .env
```

4. Edite `.env` com:

- `POSTGRES_PASSWORD` forte
- `JWT_SECRET` forte
- `FRONTEND_URL` com seu dominio real, por exemplo `https://app.seudominio.com`
- `VITE_API_URL=/api`

5. Suba os containers:

```bash
docker compose up -d --build
```

6. Execute o seed inicial apenas se quiser os dados demo:

```bash
docker compose exec backend npm run prisma:seed
```

7. Configure o Nginx da VPS usando o exemplo em [deploy/nginx/campanhahub.conf.example](/C:/Users/W11/Documents/Projeto%20PH-KS/deploy/nginx/campanhahub.conf.example).
8. Depois emita o HTTPS com `certbot`.

### Deploy leve em VPS pequena

Em instancias pequenas da Lightsail, evite compilar imagens na propria VPS. O workflow em `.github/workflows/docker-images.yml` publica imagens prontas no GitHub Container Registry a cada push na branch `main`.

Depois que o workflow concluir no GitHub, rode na VPS:

```bash
cd campanhahub
git pull
docker compose -f docker-compose.vps.yml pull
docker compose -f docker-compose.vps.yml up -d
docker compose -f docker-compose.vps.yml ps
```

Para executar o seed inicial:

```bash
docker compose -f docker-compose.vps.yml exec backend npm run prisma:seed
```

Se as imagens estiverem privadas no GitHub Container Registry, faca login na VPS antes do `pull`:

```bash
echo SEU_TOKEN_GITHUB | docker login ghcr.io -u SEU_USUARIO_GITHUB --password-stdin
```

## WhatsApp com Evolution API

A integracao fica toda no backend. O frontend nunca recebe a chave da Evolution, apenas o QR Code/status da conexao.

Variaveis principais:

```bash
EVOLUTION_API_URL=http://evolution:8080
EVOLUTION_API_KEY=uma-chave-forte-da-evolution
EVOLUTION_INSTANCE_NAME=campanhahub
EVOLUTION_WEBHOOK_URL=https://gestaocontrole.duckdns.org/api/communications/webhook/evolution
EVOLUTION_WEBHOOK_SECRET=um-segredo-forte-para-webhook
```

Fluxo usado pelo sistema:

- `POST /instance/create` cria a instancia WhatsApp Baileys quando necessario.
- `GET /instance/connect/{instanceName}` busca o QR Code para leitura no WhatsApp.
- `GET /instance/connectionState/{instanceName}` sincroniza o status da conexao.
- `POST /message/sendText/{instanceName}` envia mensagens das campanhas imediatas.
- `POST /api/communications/webhook/evolution` recebe eventos de QR Code e conexao.

## Como rodar sem Docker

1. Inicie um PostgreSQL local e copie `backend/.env.example` para `backend/.env`.
2. Instale dependencias:

```bash
npm run install:all
```

3. Gere o client e aplique as migrations:

```bash
cd backend
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
```

4. Em terminais separados:

```bash
npm run dev:backend
npm run dev:frontend
```

## Credenciais seed

- Administrador: `admin@campanha.local` / `Admin@123`
- Supervisor: `supervisor@campanha.local` / `Supervisor@123`
- Lider: `lider@campanha.local` / `Lider@123`

## Principais regras de negocio

- Lider visualiza apenas apoiadores vinculados ao seu escopo
- Supervisor visualiza lideres e apoiadores sob sua responsabilidade
- Administrador possui acesso total e pode transferir apoiadores entre lideres
- Todo apoiador exige consentimento LGPD
- A anonimização fica disponivel para atendimento de solicitacoes do titular

## Scripts uteis

No diretorio raiz:

```bash
npm run install:all
npm run dev:backend
npm run dev:frontend
npm run build:backend
npm run build:frontend
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

No backend:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```
