# Colégio Gestão no localhost — Windows e macOS/Linux

> O sistema rodará **no seu computador**, normalmente em `http://localhost:3000`. Isso **não publica** o site. O repositório é privado; credenciais, banco de dados e configurações de login não acompanham o código.

## 1. Instalar os programas necessários

Instale **Git**, **Node.js 22.13 ou superior** e **MySQL** (ou obtenha acesso a um MySQL/TiDB somente para desenvolvimento). Veja os sites oficiais: [Node.js](https://nodejs.org/en/download) e [pnpm](https://pnpm.io/10.x/installation).

### Windows — PowerShell

Se o PowerShell mostrar `npm.ps1 não pode ser carregado porque a execução de scripts foi desabilitada`, **não altere a política de execução**. Chame os executáveis `.cmd`:

```powershell
node --version
npm.cmd --version
git --version
npm.cmd install -g pnpm@10.4.1
pnpm.cmd --version
```

O último comando deve mostrar `10.4.1`. Se `pnpm` continuar bloqueado, use `pnpm.cmd` **sempre** neste tutorial. A versão atual do projeto já aceita `pnpm.cmd dev` no PowerShell, sem WSL.

### macOS/Linux — Terminal

```bash
node --version
npm --version
git --version
npm install -g pnpm@10.4.1
pnpm --version
```

## 2. Baixar ou atualizar o código

Você precisa estar autenticado no GitHub com uma conta autorizada a acessar o **repositório privado**.

**Primeira vez — PowerShell:**

```powershell
git clone https://github.com/miguelsampaiomartins/colegio-gestao.git
cd colegio-gestao
pnpm.cmd install
```

**Se você já clonou antes — PowerShell:** abra o terminal dentro da pasta do projeto e rode:

```powershell
git pull origin main
pnpm.cmd install
```

No **macOS/Linux**, use os mesmos comandos, trocando `pnpm.cmd` por `pnpm`.

Se aparecer `Repository not found`, confirme o acesso da sua conta e autentique o Git localmente. **Nunca coloque a senha ou um token na URL** do repositório.

## 3. Criar um banco de testes

**Não aponte o localhost ao banco de produção da escola.** Crie um banco vazio em seu MySQL. Você pode fazer isso no MySQL Workbench ou entrar no cliente MySQL como administrador (`mysql -u root -p`; dependendo da instalação no Ubuntu, `sudo mysql`):

```sql
CREATE DATABASE colegio_gestao_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'colegio_app'@'127.0.0.1' IDENTIFIED BY 'SUBSTITUA_POR_UMA_SENHA_FORTE';
GRANT ALL PRIVILEGES ON colegio_gestao_dev.* TO 'colegio_app'@'127.0.0.1';
```

Se o usuário já existir, use-o em vez de tentar criá-lo novamente. Se o banco estiver em outro servidor, ajuste o host e as permissões. **Um banco novo fica vazio**: dados da versão hospedada não são copiados automaticamente.

## 4. Configurar o arquivo `.env`

Na raiz da pasta `colegio-gestao`, crie um arquivo chamado `.env`. No Windows, pode usar `notepad .env` no PowerShell; confirme que o arquivo não ficou com a extensão `.txt`. Preencha com **seus valores reais**:

```dotenv
DATABASE_URL=mysql://colegio_app:SENHA_CODIFICADA_NA_URL@127.0.0.1:3306/colegio_gestao_dev
JWT_SECRET=UMA_CHAVE_ALEATORIA_LONGA_E_PRIVADA
VITE_APP_ID=ID_DO_APLICATIVO_OAUTH_AUTORIZADO
OAUTH_SERVER_URL=URL_DO_SERVIDOR_OAUTH
VITE_OAUTH_PORTAL_URL=URL_DO_PORTAL_OAUTH
```

Para gerar uma chave para `JWT_SECRET` sem instalar outras ferramentas:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copie o resultado apenas para o `.env` local. Se a senha do banco contiver `@`, `:`, `/`, `?` ou `#`, codifique-a para URL ao montar `DATABASE_URL`. O `.env` é ignorado pelo Git; **não envie credenciais, tokens ou senhas ao GitHub**.

**Importante sobre o login:** a aplicação atual usa o **OAuth do projeto Manus**, não um Client ID do Google conectado diretamente ao código. O clone não inclui valores OAuth válidos. Para conseguir entrar em `localhost`, é necessário ter uma configuração autorizada do provedor que aceite o callback `http://localhost:3000/api/oauth/callback`. Sem isso a página pode abrir, mas alunos, estoque e vendas continuarão exigindo login. Esta alteração de compatibilidade com Windows **não altera o sistema de autenticação**.

## 5. Criar as tabelas no banco vazio

A configuração do Drizzle agora carrega o `.env` automaticamente: não é preciso definir `NODE_OPTIONS` nem alterar variáveis no PowerShell.

**Windows — PowerShell:**

```powershell
pnpm.cmd db:push
```

**macOS/Linux — Terminal:**

```bash
pnpm db:push
```

O comando gera/verifica as migrações e as aplica **ao banco indicado em `DATABASE_URL`**. Confirme que é o banco de testes antes de executar.

## 6. Iniciar o servidor

**Windows — PowerShell:**

```powershell
pnpm.cmd dev
```

**macOS/Linux — Terminal:**

```bash
pnpm dev
```

Aguarde `Server running on http://localhost:3000/` e abra `http://localhost:3000` no mesmo computador. Se a porta 3000 estiver ocupada, abra a URL exata exibida no terminal **e lembre-se de que a URL de callback OAuth deverá coincidir com essa porta**. Deixe o terminal aberto enquanto usar o sistema; encerre com `Ctrl+C`.

## 7. Testar

Em outro terminal, dentro da pasta do projeto, execute `pnpm.cmd check`, `pnpm.cmd test` e `pnpm.cmd build` no Windows; em macOS/Linux, troque `pnpm.cmd` por `pnpm`.

## Solução de problemas

| Sintoma | O que fazer |
| --- | --- |
| `npm.ps1` ou `pnpm.ps1` bloqueado | Use `npm.cmd` e `pnpm.cmd`; não é necessário liberar scripts do PowerShell. |
| `Repository not found` | Confira se seu GitHub tem acesso ao repositório privado e autentique o Git. |
| `DATABASE_URL is required` | Confirme que o arquivo `.env` está na raiz do projeto, sem `.txt` no final, e que você está usando o código atualizado. |
| Não conecta ao MySQL | Confira serviço ativo, usuário, senha, host, porta e nome do banco. |
| `cross-env: command not found` | Dentro da pasta atualizada, execute `pnpm.cmd install` (Windows) ou `pnpm install` (macOS/Linux). |
| Erro `invalid oauth state` | Use `localhost` em navegador que permita cookies e confira o callback autorizado para a porta exibida. |
| Abre a página, mas não deixa usar o sistema | O login OAuth ainda precisa estar configurado; `.env` com valores de exemplo não libera acesso. |

## Antes de usar dados reais

A aplicação ainda **não possui uma lista de contas previamente aprovadas**: qualquer conta que conclua o login configurado recebe acesso às operações protegidas. Antes de usar com alunos e vendas reais, implemente permissão por usuário/função, restrinja o acesso e configure backups.
