# Colégio Gestão no localhost — Windows e macOS/Linux

> O sistema rodará **no seu computador**, normalmente em `http://localhost:3000`. Isso **não publica** o site. O repositório é privado; credenciais e banco de dados não acompanham o código.

## 1. Instalar os programas necessários

Instale **Git**, **Node.js 22.13 ou superior** e **MySQL**. Veja [Node.js](https://nodejs.org/en/download) e [pnpm](https://pnpm.io/10.x/installation).

### Windows — PowerShell

Se o PowerShell disser que `npm.ps1` não pode ser carregado, **não altere a política de execução**: use os executáveis `.cmd`:

```powershell
node --version
npm.cmd --version
git --version
npm.cmd install -g pnpm@10.4.1
pnpm.cmd --version
```

### macOS/Linux — Terminal

```bash
node --version
npm --version
git --version
npm install -g pnpm@10.4.1
pnpm --version
```

## 2. Baixar ou atualizar o código

O repositório é privado. Entre no GitHub com uma conta autorizada.

**Primeira vez — PowerShell:**

```powershell
git clone https://github.com/miguelsampaiomartins/colegio-gestao.git
cd colegio-gestao
pnpm.cmd install
```

**Se já clonou — PowerShell:** dentro da pasta `colegio-gestao`:

```powershell
git pull origin main
pnpm.cmd install
```

No macOS/Linux, substitua `pnpm.cmd` por `pnpm`. Se o servidor estiver rodando, encerre-o com `Ctrl+C` **antes** de atualizar o código; reinicie após modificar o `.env`.

## 3. Criar um banco de testes

**Não use o banco de produção da escola.** No MySQL Workbench, conecte-se ao servidor local como `root`, abra uma aba SQL e execute (substitua a senha sem enviá-la a ninguém):

```sql
CREATE DATABASE colegio_gestao_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'colegio_app'@'127.0.0.1' IDENTIFIED BY 'SUBSTITUA_POR_UMA_SENHA_FORTE';
GRANT ALL PRIVILEGES ON colegio_gestao_dev.* TO 'colegio_app'@'127.0.0.1';
```

Se banco e usuário já foram criados, **não repita estes comandos**. Se o banco estiver em outro servidor, ajuste host e permissões. O banco local começa vazio; os dados hospedados não são copiados automaticamente.

## 4. Configurar `.env` e o login Google

A cópia do GitHub **não inclui credenciais OAuth**. A versão nova aceita login com Google **quando `VITE_AUTH_PROVIDER=google`**. A versão hospedada continua com o login Manus enquanto essa opção não for ativada lá.

### 4.1 Criar um cliente OAuth no Google

1. Abra [Google Cloud Console](https://console.cloud.google.com/) e selecione/crie um projeto seu.
2. Em **Google Auth Platform → Branding**, configure o nome do aplicativo e o e-mail de contato. Em **Audience**, selecione **External** para contas Gmail comuns; enquanto o aplicativo estiver em *Testing*, adicione o seu e-mail em **Test users**. Contas de uma organização Google Workspace podem usar a audiência **Internal**, se aplicável.
3. Em **Google Auth Platform → Clients → Create client**, escolha **Web application**.
4. Em **Authorized redirect URIs**, adicione **exatamente**:

   ```text
   http://localhost:3000/api/auth/google/callback
   ```

   Se a tela pedir **Authorized JavaScript origins**, use `http://localhost:3000`. O código usa fluxo servidor; o segredo nunca vai para o navegador.
5. Crie o cliente. Guarde o **Client ID** e o **Client Secret** em lugar seguro. O Google pode mostrar o segredo completo somente no momento da criação. **Não envie o Client Secret em mensagens e não o publique no GitHub.**

Documentação oficial: [configuração do consentimento](https://developers.google.com/workspace/guides/configure-oauth-consent), [clientes OAuth](https://support.google.com/cloud/answer/15549257?hl=en) e [fluxo web](https://developers.google.com/identity/protocols/oauth2/web-server).

### 4.2 Editar `.env` local

Na raiz da pasta `colegio-gestao`, execute `notepad .env` (Windows) ou abra o arquivo num editor. **Preserve** os valores corretos de `DATABASE_URL` e `JWT_SECRET` que você já configurou; adicione estas linhas substituindo os exemplos:

```dotenv
VITE_AUTH_PROVIDER=google
GOOGLE_CLIENT_ID=SEU_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=SEU_CLIENT_SECRET_PRIVADO
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
GOOGLE_ALLOWED_EMAILS=seu.email@gmail.com
```

- Para autorizar mais de uma pessoa, separe os e-mails por vírgula (`pessoa1@gmail.com,pessoa2@gmail.com`). **Somente e-mails Gmail ou de um domínio Google Workspace verificado** podem entrar; a lista no `.env` controla o acesso do sistema independentemente dos *Test users* do Google. Não compartilhe senhas nem o `.env`.
- `JWT_SECRET` deve ter pelo menos 32 caracteres. Se precisar gerar um novo, rode `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` e copie o resultado apenas para o `.env`; trocar essa chave desconecta as sessões anteriores.
- A `DATABASE_URL` usa a senha do usuário `colegio_app`, **não** a senha de `root`. Se ela tiver `@`, `%`, `#`, `/` ou `:`, codifique a senha inteira para URL. Nunca envie o `.env` a outra pessoa. O arquivo é ignorado pelo Git.
- **Não use** `VITE_APP_ID`, `OAUTH_SERVER_URL` nem `VITE_OAUTH_PORTAL_URL` como substitutos das credenciais Google. Eles pertencem ao provedor antigo; com `VITE_AUTH_PROVIDER=google` não são necessários no seu localhost.

## 5. Criar as tabelas (somente na primeira instalação)

O Drizzle carrega `.env` automaticamente. Se você já executou este passo com sucesso, **não precisa repetir**: esta atualização não adiciona tabelas.

```powershell
pnpm.cmd db:push
```

No macOS/Linux: `pnpm db:push`. Confirme que `DATABASE_URL` aponta ao **banco de testes** antes de migrar.

## 6. Iniciar o servidor e entrar

No Windows, dentro da pasta do projeto:

```powershell
pnpm.cmd dev
```

No macOS/Linux: `pnpm dev`. Aguarde `Server running on http://localhost:3000/`, abra **http://localhost:3000** no navegador e clique em **Entrar com Google**. Escolha o mesmo e-mail listado em `GOOGLE_ALLOWED_EMAILS` e, se o aplicativo ainda estiver em *Testing*, em **Test users**.

O endereço de callback no Google Cloud **precisa coincidir exatamente** com `GOOGLE_REDIRECT_URI` e a porta exibida pelo servidor. Se o programa escolher uma porta diferente de 3000, encerre o processo que ocupa a 3000 ou altere as duas configurações para a nova porta e reinicie. Deixe o terminal aberto enquanto usar o sistema; encerre com `Ctrl+C`.

## 7. Validar

Em outro terminal, dentro da pasta do projeto: `pnpm.cmd check`, `pnpm.cmd test` e `pnpm.cmd build` no Windows; substitua por `pnpm` em macOS/Linux.

## Solução de problemas

| Sintoma | O que verificar |
| --- | --- |
| `npm.ps1` / `pnpm.ps1` bloqueado | Use `npm.cmd` e `pnpm.cmd`; não libere scripts do PowerShell. |
| `Repository not found` | Sua conta do GitHub precisa ter acesso ao repositório privado. |
| `DATABASE_URL is required` | O arquivo `.env` deve estar na raiz do projeto, sem a extensão `.txt`. |
| Tela avisa que faltam variáveis Google | Confira os nomes das cinco variáveis Google no `.env` e **reinicie** `pnpm.cmd dev`. |
| `redirect_uri_mismatch` | O URI cadastrado no Google deve corresponder **exatamente** a `GOOGLE_REDIRECT_URI` (incluindo porta e caminho). |
| `access blocked` ou teste não autorizado | Em **Audience → Test users**, inclua o e-mail escolhido; confira `GOOGLE_ALLOWED_EMAILS`. |
| Conta não autorizada | Verifique o e-mail escolhido, a lista permitida e se o Google marcou o e-mail como verificado. |
| Erro após voltar do Google | Verifique se iniciou a partir de `localhost`, se o navegador permite cookies e se `JWT_SECRET` está configurado. Não compartilhe a URL de retorno com código OAuth. |
| Não conecta ao MySQL | Confirme serviço ativo, host, porta, usuário e senha do banco. |

## Antes de usar dados reais

No modo Google, **só entram os e-mails permitidos** por `GOOGLE_ALLOWED_EMAILS`. No modo Manus antigo, continua valendo a autenticação da hospedagem. Ainda não há separação de funções (por exemplo, quem pode vender mas não cancelar); para uso real no colégio, implemente papéis e permissões no servidor e backups. O acesso a `localhost` é local ao seu computador, não disponibiliza o sistema para os outros computadores da escola.
