# Colégio Gestão no localhost

## Requisitos

- Node.js 22 ou superior
- pnpm 10 ou superior
- MySQL ou TiDB acessível pela máquina local
- Credenciais do OAuth Manus ou do provedor de autenticação configurado

## Instalação

```bash
git clone https://github.com/miguelsampaiomartins/colegio-gestao.git
cd colegio-gestao
pnpm install
```

## Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto. Não publique esse arquivo no GitHub.

```dotenv
DATABASE_URL=mysql://USUARIO:SENHA@HOST:3306/NOME_DO_BANCO
JWT_SECRET=gere-uma-chave-secreta-grande-e-aleatoria
VITE_APP_ID=seu-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://auth.manus.im
OWNER_OPEN_ID=seu-open-id
OWNER_NAME=Nome do administrador
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=sua-chave-da-api
VITE_FRONTEND_FORGE_API_URL=https://forge.manus.im
VITE_FRONTEND_FORGE_API_KEY=sua-chave-frontend
```

Os valores reais devem vir do ambiente do projeto ou da configuração do provedor. Nunca use os valores acima como credenciais reais.

## Banco de dados

Depois de configurar `DATABASE_URL`, execute:

```bash
pnpm db:push
```

Esse comando gera e aplica as tabelas do sistema.

## Iniciar

```bash
pnpm dev
```

Abra no navegador:

```text
http://localhost:3000
```

## Verificação

```bash
pnpm check
pnpm test
pnpm build
```

## Login local

O callback OAuth local é:

```text
http://localhost:3000/api/oauth/callback
```

Se o provedor de autenticação exigir URLs autorizadas, cadastre esse endereço no painel do provedor.

## Segurança

Não envie para o GitHub:

- `.env`
- senhas do banco
- Client Secrets
- chaves de API
- tokens de sessão
