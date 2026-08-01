# Publicar o protótipo no Cloudflare Pages

## Opção recomendada: integração com GitHub

O repositório está preparado para o fluxo atual do Cloudflare Workers Builds.

1. Em **Workers & Pages**, selecione **Create application** → **Import a repository**.
2. Escolha o repositório `jefflennon1/gente-boa-web`.
3. Use `gente-boa-prototipo` como nome do projeto. Esse nome deve ser igual ao campo `name` de `wrangler.jsonc`.
4. Defina o **Build command** como `npm run build`.
5. Mantenha o **Deploy command** padrão como `npx wrangler deploy`, caso ele seja exibido.
6. Use a branch `main` e deixe o diretório raiz vazio, pois o front-end está na raiz do repositório.
7. Não é necessário cadastrar variáveis de ambiente neste protótipo.
8. Selecione **Deploy**.

Novos commits enviados para `main` serão compilados e publicados automaticamente.

## Alternativa: upload direto

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com/) e crie ou entre em uma conta gratuita.
2. Abra **Workers & Pages**.
3. Selecione **Create application** → **Get started** → **Drag and drop your files**.
4. Informe um nome, por exemplo `gente-boa-prototipo`.
5. Arraste o arquivo `gente-boa-prototipo-cloudflare.zip` preparado na raiz deste projeto.
6. Selecione **Deploy site**.

O endereço público terá o formato:

```text
https://gente-boa-prototipo.pages.dev
```

Se o nome já estiver sendo utilizado, a Cloudflare acrescentará caracteres ao endereço.

## Atualizações posteriores

Após alterar o código:

```bash
npm run build
```

Crie novamente o ZIP usando o conteúdo da pasta `dist` e, no projeto do Cloudflare Pages, selecione **Create a new deployment**.

## Configuração aplicada

- Rotas internas do React funcionam diretamente no Cloudflare Pages.
- O site envia `X-Robots-Tag: noindex, nofollow, noarchive`.
- O arquivo `robots.txt` solicita que buscadores não indexem nenhuma página.
- O sistema exibe um aviso de que é um protótipo com dados fictícios.

O bloqueio de indexação reduz a descoberta por mecanismos de busca, mas não torna o endereço privado. Qualquer pessoa com o link e as credenciais demonstrativas poderá acessar o protótipo.
