# Gente Boa Gestão — protótipo ERP

Protótipo front-end de um ERP web para a Gente Boa Manutenção e Serviços. A interface foi construída a partir do POP do sistema atual, do comparativo visual fornecido e da identidade institucional da empresa.

## O que está implementado

- Dashboard operacional e financeira com indicadores, agenda e fechamento mensal.
- Clientes com busca, filtros, cadastro, edição, contrato, horas e painel de detalhes.
- Ordens de serviço com cadastro, edição, visão Kanban/lista e avanço entre etapas.
- Notas fiscais com revisão, seleção e emissão simulada em lote.
- Extratos com documentos consolidados, prévia e envio simulado por e-mail.
- Relatórios operacionais, comerciais e financeiros com filtros e prévia de exportação.
- Usuários, perfis de acesso e permissões por módulo.
- Login demonstrativo com proteção das páginas e opção de manter a sessão.
- Layout responsivo para desktop, tablet e celular.

Todas as ações são demonstrativas e usam dados locais em memória. Integrações reais com prefeitura/provedor fiscal, banco, e-mail e backend ainda não fazem parte deste front-end.

### Acesso ao protótipo

- Usuário: `naty`
- Senha: `naty12345`

As credenciais são verificadas somente no navegador e não representam uma autenticação segura para produção.

## Publicação do protótipo

O projeto está preparado para publicação gratuita por upload direto no Cloudflare Pages. Consulte [DEPLOY-CLOUDFLARE.md](./DEPLOY-CLOUDFLARE.md) para o passo a passo.

## Tecnologias

- React 19
- TypeScript 7
- Vite 8
- Recharts
- Lucide React
- CSS responsivo com design tokens próprios
- Roteamento local leve, sem dependência externa

## Rodando localmente

```bash
npm install
npm run dev
```

Abra o endereço exibido pelo Vite. Para gerar a versão de produção:

```bash
npm run build
npm run preview
```

## Estrutura principal

```text
src/
  components/    layout e componentes reutilizáveis
  data/          dados demonstrativos centralizados
  pages/         módulos do ERP
  App.tsx        carregamento e rotas da aplicação
  router.tsx     navegação client-side
  styles.css     sistema visual e responsividade
  types.ts       contratos TypeScript do domínio
```

## Próximas decisões de produto

Antes do desenvolvimento do backend, é recomendável validar com a cliente:

1. Regras de reajuste anual e renovação dos contratos.
2. Campos fiscais obrigatórios e exceções de retenção de ISS.
3. Fluxo de baixa de contas, boletos e conciliação do caixa diário.
4. Perfis de acesso realmente necessários para cada pessoa.
5. Provedores de nota fiscal, cobrança bancária e envio de e-mail.
