# Publicar o protótipo no Cloudflare Pages

## Opção rápida: upload direto

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
