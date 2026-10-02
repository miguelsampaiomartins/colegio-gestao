
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

O assistente pergunta seu nome completo, **somente** os quatro primeiros dígitos do CPF e uma senha de 8 a 128 caracteres. Digite a senha no próprio terminal (não nesta conversa). Seu usuário será primeiro nome sem acento + quatro dígitos, por exemplo `miguel1234`. O programa não pede nem guarda o CPF inteiro, não exibe a senha e **não cria um segundo dono**. Se já existir um dono, o comando avisa e não altera sua senha.

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

Em **Equipe e acessos**, o dono pode criar uma função, marcar os módulos permitidos e depois selecionar essa função ao cadastrar cada funcionário. As opções são **Visão geral**, **Alunos e matrículas**, **Estoque**, **Vendas**, **Anotações** e **Famílias e mensagens**. O bloqueio é aplicado no servidor e também na navegação; o dono continua com acesso total. Funcionários antigos sem função vinculada mantêm temporariamente os acessos operacionais anteriores para evitar perda de acesso durante a atualização.

Na aba **Estoque**, o cadastro aceita uma categoria criada pelo dono e um **estoque mínimo**. Quando a quantidade total de um produto fica igual ou abaixo do mínimo, aparece o alerta de reposição. O mínimo pode ser alterado no próprio cartão do produto e as categorias podem ser criadas na seção “Categorias de produtos”.

### Exclusão de produtos e funcionários

Na aba **Estoque**, o dono ou funcionário com permissão de estoque pode clicar em **Excluir** em um produto e confirmar a operação. O produto é arquivado: deixa de aparecer no catálogo e não pode ser vendido ou movimentado, mas suas variedades, vendas anteriores, movimentações e recibos continuam preservados para consulta.

Na aba **Equipe e acessos**, somente o dono pode clicar em **Excluir funcionário** e confirmar. A conta e o acesso são removidos definitivamente, as sessões deixam de funcionar e o histórico geral de auditoria é preservado. O dono não pode ser excluído por esse painel. Use a remoção de acesso quando quiser apenas bloquear temporariamente e manter a conta para reativação posterior.

### Pesquisa e histórico de compras por aluno

Na aba **Vendas**, use o campo “Buscar aluno, matrícula ou turma” para localizar rapidamente o aluno antes de finalizar a venda. Para consultar compras anteriores, use a seção **Histórico de compras por aluno**, pesquise pelo nome e selecione o aluno. O sistema reúne todas as vendas vinculadas às matrículas desse aluno, inclusive vendas canceladas, mostrando data, pagamento, valor e acesso aos detalhes/recibo.

### Agenda de infrações e histórico por aluno

A aba **Anotações** funciona como uma agenda escolar: ao registrar uma infração, informe aluno, data, tipo e descrição. Os registros aparecem agrupados por dia e podem ser filtrados por data, aluno, descrição, tipo ou situação em aberto/resolvida.

A seção **Histórico de infrações por aluno** permite pesquisar e selecionar um aluno para consultar todas as ocorrências dele, com data, tipo, descrição e situação.


### Login local exclusivo

O sistema agora utiliza somente **nome de usuário e senha**. O login Google e os fluxos OAuth não são usados pelo servidor ou pela tela de entrada. Mantenha `DATABASE_URL` e `JWT_SECRET` configurados no `.env`; a linha `VITE_AUTH_PROVIDER=password` pode permanecer para compatibilidade com instalações antigas.


### Cadastro integrado de aluno e matrícula

Na aba **Alunos e matrículas**, o botão **Novo aluno + matrícula** abre um único formulário. Além dos dados do aluno e do responsável, informe o ano letivo, a turma e o turno da primeira matrícula. Ao salvar, o sistema grava aluno, telefones e matrícula em uma única transação: se qualquer etapa falhar, nenhum cadastro parcial fica salvo. O número `MAT-00000000` é gerado automaticamente e aparece na confirmação. O botão **Nova matrícula** continua disponível para vincular uma matrícula adicional a um aluno já cadastrado.


### Turmas escolares e contagem de alunos

O fluxo visível agora possui apenas o botão **Nova matrícula**. Ele abre o cadastro integrado de aluno e primeira matrícula. A turma é escolhida em uma lista padronizada com **Creche I–III, Pré I–II, 1º ao 9º ano do Ensino Fundamental e 1º ao 3º ano do Ensino Médio**. A tela também exibe a quantidade de matrículas ativas em cada turma; a contagem é atualizada após uma nova matrícula ser salva.


### Edição de alunos matriculados

Na lista de alunos, clique em **Ver cadastro** e depois em **Editar**. É possível atualizar nome, turma/série, nascimento, CPFs, responsável, e-mail, endereço e telefones. A matrícula, o número MAT, as vendas, os recibos e o histórico de infrações continuam preservados; somente os dados cadastrais do aluno são atualizados.


### Turma na edição do aluno

No formulário **Editar aluno matriculado**, o campo **Turma matriculada** agora é um seletor. Ele lista somente as turmas padronizadas existentes no sistema. Ao salvar, a matrícula ativa do aluno é transferida para a turma escolhida; o número da matrícula e os históricos permanecem os mesmos.


### Sincronização após editar matrícula

Ao editar um aluno e escolher outra turma, o sistema atualiza simultaneamente a turma ativa da matrícula e a série exibida em **Estudantes cadastrados**. Após salvar, as consultas de alunos, matrículas, Vendas, Anotações, Dashboard e históricos individuais são atualizadas automaticamente, sem exigir sair e entrar novamente.


### Busca de infrações e descrição opcional

Na **Agenda de infrações**, o campo de busca aceita nome do aluno, turma/série ou descrição. Ao registrar uma ocorrência, a descrição agora é opcional; basta selecionar o aluno, a data e o tipo. Registros sem texto aparecem como **Sem descrição**.


### Pesquisa de aluno ao registrar infração

No formulário **Nova infração**, o campo de aluno possui uma pesquisa por nome ou turma. Digite parte do nome ou da série/turma, confira a lista filtrada e selecione o aluno correto antes de registrar. A descrição permanece opcional e aparece com o texto **Opcional**.


### Pix Mercado Pago em modo de teste

A aba **Vendas** possui um painel **Pix Mercado Pago · teste**. Com produtos no carrinho, clique em **Gerar QR Code Pix de teste** para criar uma cobrança sandbox. O painel mostra o QR Code, o código copia e cola, o identificador e o status; **essa ação não cria a venda, não baixa o estoque e não cobra dinheiro real**. O botão **Atualizar status** consulta o Mercado Pago novamente.

As credenciais ficam nas variáveis protegidas `MERCADOPAGO_ACCESS_TOKEN` e `VITE_MERCADOPAGO_PUBLIC_KEY`. Use somente credenciais da seção **Testes** do Mercado Pago. O Access Token é utilizado apenas no servidor e não deve ser colocado em código, capturas de tela ou GitHub. Sem credenciais configuradas, a suíte local ignora o teste de conectividade e o painel informa que o sandbox não está configurado.


### Ícones de categorias de produtos

Na aba **Estoque**, em **Categorias de produtos**, escolha um ícone antes de criar a categoria; no seletor aparecem somente as imagens: **Blusa**, **Outros** ou **Livro**. O ícone aparece ao lado do nome de cada produto no estoque. Categorias antigas recebem automaticamente o ícone de outros como padrão, enquanto as categorias padrão ficam associadas a blusa, livro e outros. Após atualizar o código, pare o servidor e execute `pnpm.cmd db:push` no banco local para aplicar a coluna nova; nenhum produto, categoria ou histórico é apagado.


### Exclusão de categorias

Na seção **Categorias de produtos**, o dono pode clicar na lixeira ao lado de uma categoria e confirmar a exclusão. A categoria é arquivada e deixa de aparecer nas novas opções; produtos já cadastrados, vendas, movimentações e históricos permanecem preservados.


### Portal da família e comunicação escolar

O sistema agora possui um portal separado para responsáveis, acessível em **`/familia`**.

1. Entre no painel interno com o dono ou com um funcionário cuja função tenha a permissão **Famílias e mensagens**.
2. Abra **Famílias e mensagens** e, em **Criar acesso familiar**, selecione um aluno ativo.
3. O e-mail informado precisa ser o mesmo e-mail do responsável cadastrado no aluno. Crie uma senha com pelo menos 8 caracteres e entregue essas credenciais ao responsável por um canal seguro.
4. O responsável acessa `http://localhost:3000/familia` e entra com e-mail e senha. O portal não dá acesso ao painel administrativo.
5. Na área interna, a escola pode abrir conversas relacionadas a um aluno ou a todos os alunos vinculados à conta e responder pelo chat.
6. No portal, o responsável vê ocorrências registradas, comunicados, histórico de mensagens e conversa com a secretaria em chats separados por aluno e assunto.

As ocorrências novas geram automaticamente uma notificação para todas as contas familiares vinculadas ao aluno. As senhas são armazenadas com **scrypt**, nunca em texto puro; o cookie familiar é separado do cookie da equipe e as rotas verificam o vínculo entre responsável e aluno.

Para liberar o módulo a uma função: entre em **Equipe e acessos**, abra a função desejada, marque **Famílias e mensagens** e salve. O dono sempre possui acesso total.

Se o servidor estiver usando outra porta porque a 3000 já está ocupada, utilize a porta exibida no terminal, por exemplo `http://localhost:3001/familia`.


### Chat ao vivo entre secretaria e responsáveis

O formulário antigo de mensagens foi substituído por um **chat de conversa**. O responsável inicia o contato pelo portal; depois, a secretaria responde no mesmo histórico.

As telas consultam novas mensagens automaticamente a cada poucos segundos, sem exigir atualização manual da página. A conversa mantém as mensagens antigas, identifica quem enviou cada resposta e preserva a separação de acesso entre secretaria e responsável.

### Chat somente por conversas iniciadas pelo responsável

O formulário **Nova conversa** foi removido da área interna e do portal. O responsável inicia o contato pelo portal da família; a secretaria acompanha os chats existentes e responde no mesmo histórico. Cada conversa mostra o nome e o e-mail do responsável, o aluno relacionado e o assunto. Cada mensagem identifica se foi enviada pelo responsável ou pela secretaria; mensagens novas da escola salvam o nome da secretaria que estava autenticada no momento do envio.

### Recuperação de senha do responsável

Em **Famílias e mensagens**, na seção **Acessos cadastrados**, clique em **Redefinir senha** ao lado da conta desejada. Informe uma nova senha com pelo menos 8 caracteres e clique em **Salvar**. A senha anterior não é exibida; uma nova senha é criada com hash scrypt e as sessões antigas dessa conta são invalidadas. Entregue a nova senha ao responsável por um canal seguro.
