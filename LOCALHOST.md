# Colégio Gestão no localhost — login próprio

O sistema roda no **seu computador** em `http://localhost:3000`. O repositório privado **não** leva banco nem senhas junto. A atualização cria uma tabela nova; não apaga alunos, estoque, vendas nem contas antigas. A versão hospedada permanece com o provedor anterior até que seja configurada separadamente.

## Se já está usando no Windows

### 1. Pare o servidor e atualize

No PowerShell que executa o site, pressione **Ctrl+C**. Na pasta `colegio-gestao`, execute:

```powershell
git pull origin main
pnpm.cmd install
```

Se o PowerShell bloquear `pnpm.ps1`, continue usando `pnpm.cmd`; não é necessário alterar a política de execução do Windows.

### 2. Confirme o banco local e aplique a migração

Seu arquivo `.env` deve manter `DATABASE_URL` apontando ao **MySQL do seu computador**, não ao banco hospedado. Confirme também `JWT_SECRET` com pelo menos 32 caracteres. **Não envie o `.env`, senha de banco nem senha de funcionário a ninguém.**

```powershell
pnpm.cmd db:push
```

Esse comando adiciona a tabela `staffAccounts` e o controle de dono único. Se falhar, **não** continue para o próximo passo; verifique se o MySQL está ligado e a URL contém a senha do usuário `colegio_app` codificada para URL (por exemplo, `@` na senha vira `%40`). Se você já aplicou a migração, executá-la novamente não deve apagar registros.

### 3. Crie a conta inicial do dono

```powershell
pnpm.cmd owner:init
```

O assistente pergunta seu nome completo, **somente** os quatro primeiros dígitos do CPF e uma senha de 15 a 128 caracteres. Digite a senha no próprio terminal (não nesta conversa). Seu usuário será primeiro nome sem acento + quatro dígitos, por exemplo `miguel1234`. O programa não pede nem guarda o CPF inteiro, não exibe a senha e **não cria um segundo dono**. Se já existir um dono, o comando avisa e não altera sua senha.

> Os quatro dígitos servem **apenas para compor o nome de usuário**; não são um fator de segurança. Escolha uma senha longa e exclusiva.

### 4. Ative o login próprio

Ainda na pasta do projeto, execute `notepad .env`. **Não apague** `DATABASE_URL` nem `JWT_SECRET`. Substitua (ou adicione) a linha do provedor:

```dotenv
VITE_AUTH_PROVIDER=password
```

Se tiver linhas antigas `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` e `GOOGLE_ALLOWED_EMAILS`, elas ficam **ignoradas** nesse modo. Pode deixá-las no `.env` local por enquanto, mas mantenha o arquivo privado e fora do Git. Salve com **Ctrl+S**.

### 5. Inicie e entre

```powershell
pnpm.cmd dev
```

Abra `http://localhost:3000` e entre com o nome de usuário mostrado pelo `owner:init` e com a senha criada. O dono verá **Equipe e acessos** no menu. Funcionários verão todas as páginas operacionais e **Minha conta**, mas **não** o painel de pessoas. Para fechar o servidor, volte ao PowerShell e pressione **Ctrl+C**.

### 6. Adicione a equipe

Em **Equipe e acessos**, informe o nome completo, função, somente os quatro primeiros dígitos do CPF e uma **senha inicial forte** para cada funcionário. O sistema mostra o nome de usuário antes de salvar (exemplo: `amanda1234`). Compartilhe o usuário e a senha inicial com a pessoa por um canal privado; **não** coloque senhas no GitHub. O dono pode remover ou reativar o acesso sem apagar o histórico e pode redefinir a senha mediante confirmação de sua própria senha. Funcionários podem trocar a própria senha em **Minha conta**. Cada alteração de acesso ou senha encerra sessões anteriores.

### Recuperar a senha esquecida do dono

A senha existente não pode ser visualizada: o sistema guarda somente um hash criptográfico. Se o dono esquecer a senha, pare o servidor com **Ctrl+C**, abra o PowerShell na pasta `colegio-gestao` e execute:

```powershell
pnpm.cmd owner:reset
```

O assistente exige que o banco esteja em `localhost`, pede o nome de usuário do dono, solicita a confirmação literal `REDEFINIR DONO`, recebe a nova senha sem exibi-la e pede confirmação novamente. O comando altera apenas a senha do dono, não apaga alunos, matrículas, estoque, vendas ou funcionários, e encerra as sessões antigas. Digite a senha diretamente no terminal; não a envie por mensagem nem a salve no GitHub.

## Primeira instalação em outro computador

Instale [Node.js 22.13+](https://nodejs.org/en/download), Git, pnpm 10 e MySQL. No PowerShell, se `npm.ps1` estiver bloqueado, use `npm.cmd install -g pnpm@10.4.1`. Clone o [repositório privado](https://github.com/miguelsampaiomartins/colegio-gestao), entre na pasta e rode `pnpm.cmd install`. Crie um banco **separado para testes** no MySQL; ajuste `DATABASE_URL` e `JWT_SECRET` no `.env` local. Depois siga os passos **2–6** acima. No macOS/Linux, use `pnpm` no lugar de `pnpm.cmd`.

## Se algo não funcionar

| Sintoma | O que verificar |
| --- | --- |
| Aparece ainda “Entrar com Google” | Pare o site, confirme `VITE_AUTH_PROVIDER=password` no `.env` da pasta correta e reinicie `pnpm.cmd dev`. |
| Erro de tabela `staffAccounts` | Pare o servidor, confirme o MySQL e rode `pnpm.cmd db:push` **no mesmo banco local**. |
| `owner:init` diz que já há um dono | Use a conta criada anteriormente; o assistente não a substitui. |
| Dono esqueceu a senha | Pare o servidor e execute `pnpm.cmd owner:reset`; o comando redefine a senha no banco local e encerra sessões antigas. |
| Usuário ou senha inválidos | Confira o nome de usuário completo sem `+` (exemplo: `miguel1234`). Após cinco falhas, aguarde 15 minutos e tente a senha correta. |
| `URI malformed` em `DATABASE_URL` | Codifique os caracteres reservados da senha para URL, como `@` → `%40`; não envie sua senha em mensagens. |
| Login realizado, mas sem “Equipe e acessos” | Confirme que entrou na **conta do dono** inicializada por `owner:init`, não numa conta de funcionário. |
| Dados do colégio recusam o salvamento | Atualize o projeto, pare o servidor e rode `pnpm.cmd db:push` no mesmo banco local; depois entre com a conta local do dono. CNPJ pode ser digitado com pontuação e será normalizado automaticamente. |
| Tela informa que é exclusiva do dono | A conta atual não tem `localRole=owner`; saia e entre com o usuário criado por `owner:init`. O login Google não recebe acesso a esta área. |
| Servidor escolhe porta diferente de 3000 | Feche o processo antigo que ocupa a 3000 antes de iniciar; escolha apenas `localhost`. |

Para verificar o código: `pnpm.cmd check`, `pnpm.cmd test` e `pnpm.cmd build` dentro da pasta do projeto. **Antes de usar dados reais**, configure backup regular do MySQL. Para abrir o sistema em outros computadores, é necessário hospedar o servidor com HTTPS e planejar uma política de recuperação da conta do dono; `localhost` sozinho só funciona no computador onde está rodando.

### Novos dados de matrícula

Depois de atualizar com `git pull origin main`, pare o servidor e rode `pnpm.cmd db:push` no mesmo banco local antes de iniciar o site. A migração acrescenta CPF do aluno, CPF do responsável, endereço e e-mail, além de uma tabela para vários telefones; os cadastros antigos permanecem e exibem campos faltantes como **não informados**. O CPF completo é dado pessoal: antes de cadastrar CPFs reais, ative o modo `VITE_AUTH_PROVIDER=password`, crie os acessos autorizados e mantenha o banco protegido e com backup. Na cópia hospedada que ainda usa o login antigo, **não cadastre dados reais antes de revisar e restringir os acessos**.

### Auditoria e cópia de segurança

Após atualizar o código e repetir `pnpm.cmd db:push`, entre como dono e abra **Auditoria e backups**. A nova página mostra ações concluídas por funcionário (a partir da instalação) e execuções de backup **feitas no seu Windows**. Para gerar a chave, criar a primeira cópia criptografada e, se quiser, agendar uma cópia diária no Windows, siga [BACKUP.md](./BACKUP.md). Nenhuma tarefa é instalada no seu computador a partir desta conversa.

### Atualização visual do painel

O redesign melhora a tela de entrada, a navegação, a visão geral e a legibilidade de alunos, estoque, vendas, anotações e equipe. **Esta alteração visual não modifica o banco nem exige novas dependências.** Se você já aplicou as migrações acima, basta parar o site com **Ctrl+C**, executar `git pull origin main` na pasta do projeto e iniciar `pnpm.cmd dev` novamente. Confira o menu no celular, os botões de cadastro e o carrinho. Se os estilos antigos permanecerem, atualize a aba do navegador com **Ctrl+F5**. Não publique os dados reais ou o banco de testes usados em capturas de tela.

### Número de matrícula e devolução após cancelamento

Cada matrícula existente ou nova recebe automaticamente um identificador único e permanente, como `MAT-00000001`, baseado no ID já registrado. Ele aparece nas listas, no cadastro do aluno e na confirmação ao salvar. Ao cancelar uma venda, a aba **Estoque** mostra **uma devolução da venda** com o motivo “cancelamento da venda”, os produtos, as variedades e suas quantidades; a saída original continua registrada separadamente. Esta atualização **não altera o schema**: se você já aplicou as migrações anteriores, basta parar o site, executar `git pull origin main` e reiniciar `pnpm.cmd dev`. Não é necessário rodar `pnpm.cmd db:push` apenas por estas duas mudanças.

### Funções, permissões e estoque configurável

Depois de atualizar o clone, pare o servidor e execute `pnpm.cmd db:push` no mesmo banco local. Essa migração cria as funções personalizadas e as categorias iniciais **Uniforme**, **Livro bimestral** e **Outro**; não apaga produtos, vendas ou funcionários existentes.

Em **Equipe e acessos**, o dono pode criar uma função, marcar os módulos permitidos e depois selecionar essa função ao cadastrar cada funcionário. As opções são **Visão geral**, **Alunos e matrículas**, **Estoque**, **Vendas** e **Anotações**. O bloqueio é aplicado no servidor e também na navegação; o dono continua com acesso total. Funcionários antigos sem função vinculada mantêm temporariamente os acessos operacionais anteriores para evitar perda de acesso durante a atualização.

Na aba **Estoque**, o cadastro aceita uma categoria criada pelo dono e um **estoque mínimo**. Quando a quantidade total de um produto fica igual ou abaixo do mínimo, aparece o alerta de reposição. O mínimo pode ser alterado no próprio cartão do produto e as categorias podem ser criadas na seção “Categorias de produtos”.
