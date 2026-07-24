# Deploy na Netlify + Render

Este projeto pode rodar com:

- Frontend React/Vite na Netlify.
- Backend Node/Express no Render.
- PostgreSQL gerenciado no Render.

## 1. Subir o backend no Render

1. Entre no Render e clique em **New +**.
2. Selecione **Blueprint**.
3. Conecte o repositório `controlegestao`.
4. Confirme o arquivo `render.yaml` na raiz do projeto.
5. Preencha as variáveis marcadas como manuais:
   - `FRONTEND_URL`: use temporariamente `https://exemplo.netlify.app`.
   - `SEED_ADMIN_PASSWORD`: defina uma senha forte para o admin inicial.
6. Crie o Blueprint e aguarde o deploy finalizar.
7. Teste a API:

```powershell
curl.exe https://campanhahub-api.onrender.com/health
```

O retorno esperado é:

```json
{"status":"ok"}
```

## 2. Subir o frontend na Netlify

1. Entre na Netlify e clique em **Add new site**.
2. Escolha **Import an existing project**.
3. Conecte o mesmo repositório `controlegestao`.
4. Confirme as configs detectadas pelo `netlify.toml`:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Em **Environment variables**, adicione:

```env
VITE_API_URL=https://campanhahub-api.onrender.com/api
```

Troque a URL acima pela URL real do backend criada no Render, se ela for diferente.

## 3. Ajustar CORS no Render

Depois que a Netlify gerar a URL final do site:

1. Volte no serviço `campanhahub-api` no Render.
2. Abra **Environment**.
3. Atualize:

```env
FRONTEND_URL=https://seu-site.netlify.app
```

4. Salve e aguarde o redeploy.

Sem esse ajuste, o login pode falhar no navegador por bloqueio de CORS.

## 4. Importar lideranças no ambiente hospedado

Depois do backend e frontend estarem funcionando, rode no PowerShell local:

```powershell
$env:ADMIN_EMAIL="admin@campanha.local"
$env:ADMIN_PASSWORD="SENHA_ADMIN_DO_RENDER"

python .\scripts\import_leaders_from_pdf.py `
  "C:\Users\W11\Downloads\LIDERANÇAS.pdf" `
  --api-url "https://campanhahub-api.onrender.com/api" `
  --city "São Vicente" `
  --execute
```

Se o comando `python` não funcionar no Windows, use o Python do ambiente do Codex:

```powershell
& "C:\Users\W11\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" `
  ".\scripts\import_leaders_from_pdf.py" `
  "C:\Users\W11\Downloads\LIDERANÇAS.pdf" `
  --api-url "https://campanhahub-api.onrender.com/api" `
  --city "São Vicente" `
  --execute
```

## 5. Observações do plano gratuito

- A Netlify é ótima para o frontend estático.
- O Render é prático para API + PostgreSQL, mas no plano gratuito o serviço pode dormir quando fica sem acesso.
- O PostgreSQL gratuito do Render expira depois de 30 dias. Para demonstração funciona bem; para produção real, use banco pago ou outro PostgreSQL permanente.
