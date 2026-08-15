# Gente Boa Web

Frontend do ERP Gente Boa, construído com React, TypeScript e Vite e integrado à API REST em Java/Spring Boot.

## Tecnologias

- React 19 + TypeScript
- Vite
- Axios para o cliente HTTP
- TanStack Query para cache, estados assíncronos e invalidação após CRUD
- Recharts e Lucide React
- Cloudflare Workers para hospedagem do frontend

## Executar localmente

1. Inicie o backend `gente-boa-api` na porta `8080`.
2. Copie `.env.example` para `.env.local` se precisar alterar a URL.
3. Instale e execute o frontend:

```powershell
npm.cmd install
npm.cmd run dev
```

Por padrão, o frontend usa `http://localhost:8080/api`.

## Autenticação

O login chama `POST /api/auth/login` e armazena o JWT em `sessionStorage` ou `localStorage`, conforme a opção “Manter conectado”. Ao restaurar a sessão, o frontend valida o token em `GET /api/auth/me`.

O corpo enviado para autenticação segue o contrato `{ "login": "usuario", "password": "senha" }`. Use o nome de usuário configurado para a conta no backend.

## Endpoints utilizados

- `/api/auth/login` e `/api/auth/me`
- `/api/clients`
- `/api/service-orders`
- `/api/invoices`
- `/api/statements`
- `/api/users` — exclusivo para administradores

As listagens atuais aceitam no máximo 100 itens por chamada. Dashboard e relatórios consolidam os dados retornados por essas listagens; quando o volume crescer, o backend deverá oferecer endpoints agregados ou paginação completa para os indicadores.

Os campos transientes e limitações de persistência encontrados durante a integração estão detalhados em [`BACKEND-INTEGRATION-NOTES.md`](./BACKEND-INTEGRATION-NOTES.md).

## Configuração em produção

Defina `VITE_API_URL` no ambiente de build da Cloudflare com a URL HTTPS pública do backend, por exemplo:

```text
VITE_API_URL=https://api.seudominio.com/api
```

O backend precisa liberar no CORS o domínio do frontend publicado. Atualmente o `SecurityConfig` permite apenas `http://localhost:5173` e `http://127.0.0.1:5173`, portanto uma implantação web não conseguirá chamar a API até essa origem ser adicionada.

## Validação

```powershell
npm.cmd run typecheck
npm.cmd run build
```
