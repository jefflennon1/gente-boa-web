# Deploy Docker na Hostinger

O frontend é compilado com Node.js e servido por Nginx. A imagem recebe a URL pública da API pela variável `API_URL` quando o container inicia.

## Pré-requisitos

- Um servidor/VPS com Docker e Docker Compose.
- Um domínio ou subdomínio apontando para o servidor.
- Backend publicado em HTTPS e acessível pelo navegador.
- CORS do backend liberando a origem pública do frontend.

## Testar localmente

Crie um arquivo `.env` na raiz:

```env
API_URL=http://host.docker.internal:8080/api
WEB_PORT=3000
```

Depois execute:

```bash
docker compose up -d --build
docker compose ps
```

A aplicação ficará disponível em `http://localhost:3000`. Para acompanhar a inicialização:

```bash
docker compose logs -f web
```

## Gerar a imagem

```bash
docker build -t gente-boa-web:latest .
```

A URL da API não fica presa à imagem. Informe-a ao criar o container:

```bash
docker run -d \
  --name gente-boa-web \
  --restart unless-stopped \
  -p 3000:80 \
  -e API_URL=https://api.seudominio.com/api \
  gente-boa-web:latest
```

O container não inicia se `API_URL` estiver ausente. Isso evita publicar uma aplicação apontando acidentalmente para `localhost`.

## Publicar a imagem em um registry

Exemplo usando Docker Hub:

```bash
docker login
docker tag gente-boa-web:latest SEU_USUARIO/gente-boa-web:latest
docker push SEU_USUARIO/gente-boa-web:latest
```

No servidor:

```bash
docker pull SEU_USUARIO/gente-boa-web:latest
docker run -d \
  --name gente-boa-web \
  --restart unless-stopped \
  -p 3000:80 \
  -e API_URL=https://api.seudominio.com/api \
  SEU_USUARIO/gente-boa-web:latest
```

## Domínio e HTTPS

Configure o domínio público para encaminhar as requisições ao host `3000` do servidor. O certificado HTTPS pode ser administrado pelo proxy reverso da Hostinger ou por uma solução como Nginx Proxy Manager/Traefik.

Se frontend e backend usarem domínios diferentes, o backend deve aceitar no CORS exatamente a origem do frontend, por exemplo:

```text
https://sistema.seudominio.com
```

Não misture frontend HTTPS com backend HTTP, pois o navegador bloqueará a chamada por conteúdo misto.

## Atualizações

Depois de publicar uma nova tag da imagem:

```bash
docker pull SEU_USUARIO/gente-boa-web:latest
docker stop gente-boa-web
docker rm gente-boa-web
docker run -d \
  --name gente-boa-web \
  --restart unless-stopped \
  -p 3000:80 \
  -e API_URL=https://api.seudominio.com/api \
  SEU_USUARIO/gente-boa-web:latest
```

Com Compose, basta executar:

```bash
docker compose up -d --build
```

## Verificações

```bash
curl http://localhost:3000/health
docker inspect --format='{{json .State.Health}}' gente-boa-web
```

O endpoint `/health` deve responder `ok`. Rotas como `/clientes` e `/contratos` são redirecionadas internamente para o `index.html`, permitindo atualizar a página sem receber 404.
