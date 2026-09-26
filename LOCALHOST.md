# Colégio Gestão no localhost — passo a passo

> **Objetivo:** executar uma cópia do sistema **no seu computador**, acessível em `http://localhost:3000`. Isso não publica o site na internet. O código está em um repositório privado, mas as credenciais e o banco hospedado **não acompanham** o clone.

## 1. Preparar o computador

- Instale **Git** e **Node.js 22.x** (pelo menos a versão 22.13). Confira no terminal:

  ```bash
  git --version
  node --version
  npm --version
  ```

- Instale a versão de `pnpm` usada por este projeto:

  ```bash
  npm install --global pnpm@10.4.1
  pnpm --version
  ```

- Instale **MySQL** ou tenha uma instância MySQL/TiDB sua à disposição.
- **Windows:** use preferencialmente o terminal **Ubuntu no WSL2** para executar os comandos abaixo. O script de desenvolvimento usa a sintaxe Unix `NODE_ENV=development`, que não funciona diretamente no PowerShell sem adaptação. Instale o Node.js, Git e MySQL dentro do ambiente em que você decidir executar o projeto (ou use um MySQL ao qual o WSL consiga se conectar).

Fontes oficiais: [Node.js](https://nodejs.org/en/download) e [pnpm 10](https://pnpm.io/10.x/installation).

## 2. Baixar o código

Você precisa estar autenticado no GitHub **com uma conta que tenha acesso ao repositório privado**. Em uma pasta de sua escolha:

```bash
git clone https://github.com/miguelsampaiomartins/colegio-gestao.git
cd colegio-gestao
pnpm install
```

Se o clone disser `Repository not found`, primeiro confirme que sua conta tem acesso e que o Git no seu computador está autenticado. Não coloque uma senha ou token na URL do repositório.

## 3. Criar um banco de desenvolvimento separado

**Não conecte o localhost ao banco usado pela escola em produção.** Em seu MySQL de testes, entre como administrador com `mysql -u root -p` (no Ubuntu, dependendo da instalação, pode ser `sudo mysql`) e crie um banco vazio e um usuário para o aplicativo:

```sql
CREATE DATABASE colegio_gestao_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'colegio_app'@'127.0.0.1' IDENTIFIED BY 'SUBSTITUA_POR_UMA_SENHA_FORTE';
GRANT ALL PRIVILEGES ON colegio_gestao_dev.* TO 'colegio_app'@'127.0.0.1';
```

Se já existir um usuário apropriado, use-o em vez de criá-lo novamente. Se o banco estiver em outro servidor, ajuste o host e as permissões. **Um banco novo começa vazio:** os alunos, produtos e vendas do ambiente hospedado não serão copiados automaticamente.

## 4. Criar o arquivo `.env`

Na **raiz da pasta `colegio-gestao`**, crie um arquivo chamado `.env` com os valores do **seu ambiente**:

```dotenv
DATABASE_URL=mysql://colegio_app:SENHA_CODIFICADA_NA_URL@127.0.0.1:3306/colegio_gestao_dev
JWT_SECRET=UMA_CHAVE_ALEATORIA_LONGA_E_PRIVADA
VITE_APP_ID=ID_DO_APLICATIVO_OAUTH_AUTORIZADO
OAUTH_SERVER_URL=URL_DO_SERVIDOR_OAUTH
VITE_OAUTH_PORTAL_URL=URL_DO_PORTAL_OAUTH
```

- Gere uma chave para `JWT_SECRET` com `openssl rand -hex 32` e cole o resultado **apenas** no `.env` local.
- Se sua senha do MySQL tiver caracteres como `@`, `:`, `/`, `?` ou `#`, codifique-a para uma URL antes de incluí-la em `DATABASE_URL`.
- O `.env` é ignorado pelo Git; **nunca o envie ao GitHub** nem divulgue chaves ou senhas.
- Se você recebeu variáveis opcionais para outras integrações, configure-as somente se for usar essas funções. As cinco variáveis acima são o ponto de partida para o banco e o login existentes.

**Atenção ao login:** este projeto usa o **OAuth do projeto Manus**, não um Client ID do Google ligado diretamente ao código. O clone do GitHub não contém `VITE_APP_ID` nem credenciais válidas. A autenticação local só funcionará se você tiver as configurações autorizadas do provedor e ele aceitar o callback `http://localhost:3000/api/oauth/callback`. Não trate os valores de exemplo como credenciais reais. Se o provedor não aceitar localhost, a interface poderá abrir, mas as funções protegidas pedirão login; nesse caso, é preciso configurar um provedor compatível para desenvolvimento ou adaptar a autenticação do projeto.

## 5. Criar as tabelas no banco vazio

Ainda na raiz do projeto, execute:

```bash
NODE_OPTIONS='--require=dotenv/config' pnpm db:push
```

O prefixo `NODE_OPTIONS` é **importante**: `pnpm db:push` chama o Drizzle, cujo arquivo de configuração lê `DATABASE_URL` diretamente do ambiente e **não** carrega `.env` por conta própria. O comando gera/verifica migrações e as aplica ao banco indicado. Use-o apenas no banco vazio de desenvolvimento; nunca aponte essa etapa ao banco da escola sem backup e revisão das migrações.

> Se você estiver em um shell que não aceita a atribuição `NOME=valor comando`, rode tudo pelo Ubuntu/WSL2 ou por um terminal Unix compatível.

## 6. Iniciar o sistema

```bash
pnpm dev
```

Aguarde a mensagem `Server running on http://localhost:3000/` e abra [http://localhost:3000](http://localhost:3000) **no mesmo computador**. Se a porta 3000 estiver ocupada, o servidor pode escolher a próxima porta livre: use o endereço exato que aparecer no terminal. Deixe o terminal aberto enquanto usar o sistema; para encerrá-lo, pressione `Ctrl+C`.

## 7. Conferir se está tudo certo

Em outro terminal, dentro da pasta do projeto:

```bash
pnpm check
pnpm test
pnpm build
```

Se a tela abrir, mas não listar dados ou não permitir ações, confira se o MySQL está ativo, se `DATABASE_URL` está correta, se as tabelas foram criadas e se o login local realmente concluiu.

## Soluções rápidas para problemas comuns

| Sintoma | O que verificar |
| --- | --- |
| `pnpm: command not found` | Instale `pnpm@10.4.1` e reabra o terminal. |
| `Repository not found` | O repositório é privado; verifique a conta e a autenticação do GitHub. |
| `DATABASE_URL is required` ao migrar | Execute o comando completo com `NODE_OPTIONS='--require=dotenv/config'` na pasta do projeto; confira o nome `.env`. |
| Erro de conexão com MySQL | Confirme se o serviço está ativo, o banco existe e usuário, senha, porta e host estão corretos. |
| `NODE_ENV` não reconhecido | Use Ubuntu/WSL2 no Windows; o script atual assume terminal Unix. |
| Erro `invalid oauth state` ou login não retorna | Use `http://localhost` (não outro IP), um navegador que aceite cookies e confira o callback OAuth autorizado. |
| Página abre, mas pede login | O código foi iniciado, porém as operações escolares exigem sessão OAuth. O `.env` de exemplo não habilita login sozinho. |

## Antes de usar dados reais

Esta versão **não tem lista de contas previamente aprovadas**: qualquer pessoa que consiga concluir o login do provedor configurado tem acesso às operações protegidas. Para uso real no colégio, implemente autorização por usuário/função no servidor, restrinja quem pode entrar e defina backup do banco antes de cadastrar alunos ou fazer vendas.
