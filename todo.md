# Acompanhamento — contas locais do colégio

## Implementado e verificado

- [x] Tabela separada `staffAccounts` e migrações aditivas, sem alteração dos dados escolares.
- [x] Assistente `pnpm owner:init` para criar uma única conta de dono no banco local, com senha oculta.
- [x] Nome de usuário = primeiro nome sem acento + quatro primeiros dígitos informados do CPF; CPF completo não é solicitado nem armazenado.
- [x] Senhas com hash scrypt e salt aleatório, mínimo de 8 caracteres; bloqueio temporário após erros repetidos.
- [x] Sessões de senha separadas de Google/Manus, revogadas após remover acesso ou alterar senha.
- [x] Rotas da equipe protegidas no servidor pelo papel de dono, não apenas escondidas na interface.
- [x] Painel para cadastrar, desativar, reativar e trocar senha dos funcionários; Minha conta para trocar a própria senha.
- [x] Guia de migração do Windows/localhost, testes automatizados, build, teste em navegador e fluxo completo com banco descartável.
- [x] Versão hospedada confirmada no provedor Manus anterior; novo modo é opt-in.

## Próximo passo no computador do proprietário

Parar o servidor local, atualizar o clone, aplicar a migração com `pnpm.cmd db:push`, criar o dono com `pnpm.cmd owner:init` e só então definir `VITE_AUTH_PROVIDER=password` no `.env`. O guia `LOCALHOST.md` descreve cada passo. A conta real do dono e as senhas do colégio **não** foram criadas nem recebidas neste sandbox. Nenhuma pessoa real foi incluída ou removida.

## Antes de produção

Os backups locais criptografados e o teste de recuperação estão implementados; o agendamento no computador do proprietário precisa ser ativado por ele. Se o sistema ficar disponível em outros computadores, ainda será necessário HTTPS e limitação de tentativas compartilhada entre instâncias. Funcionários acessam telas operacionais, não a gestão de membros nem o histórico administrativo.

## Cadastro e saídas por venda — atualização de 26/09/2026

- [x] Ampliar alunos com CPF do aluno e responsável, endereço, e-mail e telefones múltiplos sem alterar registros existentes.
- [x] Exibir e validar os novos campos na tela de alunos e matrículas; permitir iniciar a matrícula após o cadastro.
- [x] Agrupar as saídas de estoque pelo número da venda com linhas de produto, variedade e quantidade, preservando entradas comuns.
- [x] Revisar migração e executar teste de integração de cadastro, legado, venda 2+2 e cancelamento em banco descartável.
- [x] Salvar checkpoint e atualizar o GitHub privado (versão `2784f7ab`).

## Auditoria e backup local — atualização de 26/09/2026

- [x] Criar tabelas aditivas de ações por funcionário e execuções de backup.
- [x] Registrar login, mudanças de equipe, alunos, estoque, vendas e anotações sem senhas nem CPFs nos eventos.
- [x] Preparar backup criptografado, verificação de integridade e instalação opcional de agendamento diário no Windows.
- [x] Mostrar histórico e últimas execuções somente ao dono.
- [x] Testar migração, backup/restauração verificável, falha de exportação e permissões com banco isolado.
- [x] Escrever e revisar os guias de ativação no Windows, verificação e recuperação em banco de teste.

## Redesign do painel — 26/09/2026

- [x] Refinar identidade visual, navegação, acessibilidade e tela de entrada.
- [x] Redesenhar a visão geral com indicadores, estados claros e ações móveis.
- [x] Melhorar leitura, contraste, estados vazios e modais nas telas operacionais.
- [x] Testar login, formulários, vendas, relatórios e layout em desktop/celular sem alterar regras de negócio.
- [x] Preparar arquivos revisados e guia do projeto para um checkpoint recuperável.

## Identificação de matrículas e devoluções por cancelamento — 26/09/2026

- [x] Gerar número único de matrícula a partir do ID existente sem renumerar, duplicar ou apagar cadastros.
- [x] Mostrar o número na lista, no cadastro do aluno, na visão geral e na confirmação de nova matrícula.
- [x] Agrupar entradas de cancelamento pelo número da venda, com motivo e cada produto/variante/quantidade; manter entradas avulsas separadas.
- [x] Verificar matrícula antiga e nova, venda 2+2, cancelamento concorrente e histórico desktop/mobile em banco fictício; executar testes e build.
- [x] Revisar arquivos e instruções de atualização para o checkpoint e o GitHub privado.

## Venda por matrícula e recibo completo — 26/09/2026

- [x] Criar vínculo opcional com matrícula, dados do responsável e identificação do colégio sem alterar vendas antigas.
- [x] Validar matrícula ativa antes de finalizar e salvar dados históricos de comprador e vendedor para recibos estáveis.
- [x] Adicionar busca de aluno/matrícula, identificação do colégio editável pelo dono e detalhes da venda.
- [x] Gerar recibo simples imprimível com dados do responsável, colégio, produtos, descontos e pagamento, sem inserção insegura de HTML.
- [x] Testar migração, vendas legadas, venda vinculada, mudança de dados e visual em desktop e celular.
- [x] Salvar checkpoint e sincronizar com o GitHub privado.

## Funções, permissões e estoque configurável — 26/09/2026

- [x] Criar funções personalizadas com permissões por módulo: visão geral, alunos/matrículas, estoque, vendas e anotações.
- [x] Proteger as rotas no backend conforme a função e filtrar a navegação; o dono mantém acesso total.
- [x] Permitir selecionar a função ao cadastrar funcionário e editar as permissões de funções existentes.
- [x] Reativar o estoque mínimo com edição por produto e alerta visual de necessidade de reposição.
- [x] Criar categorias de produtos pelo dono e usá-las no cadastro de estoque.
- [x] Aplicar migração aditiva `0012_sticky_vargas.sql`, executar 32 testes, TypeScript, build e verificação visual desktop/mobile.


## Política de senha — 26/09/2026

- [x] Reduzir o mínimo de novas senhas de 15 para 8 caracteres em cadastro, troca e recuperação do dono.
- [x] Atualizar validações de backend, scripts de terminal, formulários e documentação.
- [x] Confirmar que 8 caracteres são aceitos, 7 são recusados; TypeScript, 34 testes e build aprovados.


## Exclusão segura — 26/09/2026

- [x] Adicionar arquivamento de produtos no estoque, mantendo variedades, vendas, movimentações e recibos históricos.
- [x] Impedir vendas e movimentações futuras em produtos arquivados.
- [x] Adicionar exclusão definitiva de funcionários apenas pelo dono, sem permitir exclusão do dono e preservando auditoria.
- [x] Incluir confirmações visíveis, mensagens claras e registrar as ações no histórico de auditoria.
- [x] Aplicar migração aditiva `0013_rich_lyja.sql`, executar 35 testes, TypeScript, build e verificação visual desktop/mobile.


## Histórico de compras por aluno — 26/09/2026

- [x] Manter a pesquisa de aluno/matrícula/turma no checkout para selecionar o destinatário da venda.
- [x] Criar consulta protegida que reúne vendas de todas as matrículas do aluno, sem limitar aos 30 registros gerais.
- [x] Adicionar painel de pesquisa por nome, total comprado, status, data, pagamento, valor, detalhes e recibo.
- [x] Preservar vendas legadas e incluir vendas canceladas no histórico individual.
- [x] Validar TypeScript, 35 testes, build e visual desktop/mobile.


## Agenda de infrações — 26/09/2026

- [x] Transformar Anotações em agenda escolar agrupada por data.
- [x] Permitir informar a data da infração e filtrar por data, aluno, descrição, tipo e situação.
- [x] Renomear o fluxo para infrações e ocorrências, mantendo os tipos existentes.
- [x] Criar histórico completo de infrações por aluno com busca, situação e data.
- [x] Validar TypeScript, 35 testes, build e visual desktop/mobile.


## Login local exclusivo — 27/09/2026

- [x] Fixar o backend no modo de autenticação por usuário e senha.
- [x] Remover a interface de login Google e os redirecionamentos OAuth automáticos.
- [x] Remover o registro de rotas OAuth/Google da inicialização do servidor.
- [x] Usar cookie de sessão local com limpeza correta no logout.
- [x] Atualizar documentação e validar TypeScript, 34 testes, build e tela de login.


## Cadastro integrado de aluno e matrícula — 29/09/2026

- [x] Criar operação transacional para salvar aluno, telefones e primeira matrícula juntos.
- [x] Adicionar ano letivo, turma e turno ao formulário de novo aluno.
- [x] Mostrar confirmação com o número automático da matrícula.
- [x] Manter Nova matrícula para alunos já cadastrados.
- [x] Validar TypeScript, 34 testes e build de produção.


## Turmas padronizadas e botão único — 29/09/2026

- [x] Remover os atalhos separados e deixar somente Nova matrícula na interface.
- [x] Fazer Nova matrícula abrir o cadastro integrado de novo aluno e matrícula.
- [x] Padronizar turmas de Creche I até o 3º ano do Ensino Médio.
- [x] Exibir contagem de matrículas ativas por turma.
- [x] Validar TypeScript, 34 testes, build e responsividade desktop/mobile.


## Expansão de turmas e edição cadastral — 29/09/2026

- [x] Adicionar seta para expandir e recolher cada turma.
- [x] Mostrar os alunos matriculados na turma selecionada e abrir seu cadastro ao clicar.
- [x] Criar edição protegida dos dados de alunos já matriculados.
- [x] Atualizar telefones de forma transacional sem apagar matrícula ou histórico.
- [x] Validar TypeScript, 34 testes e build de produção.


## Turma existente na edição — 29/09/2026

- [x] Trocar o campo livre da edição por seletor das turmas padronizadas.
- [x] Carregar a turma ativa atual ao abrir o formulário.
- [x] Atualizar a matrícula ativa ao salvar outra turma, preservando o número MAT e históricos.
- [x] Validar TypeScript, 34 testes, build e diff.


## Sincronização após edição de matrícula — 29/09/2026

- [x] Atualizar a série exibida em Estudantes cadastrados com a turma escolhida.
- [x] Atualizar a matrícula ativa no backend dentro da mesma transação dos dados do aluno.
- [x] Invalidar alunos, matrículas, dashboard, vendas, anotações e históricos individuais após salvar.
- [x] Validar TypeScript, 34 testes, build e diff.


## Busca e descrição opcional nas infrações — 29/09/2026

- [x] Permitir pesquisa da agenda por nome do aluno, turma/série ou descrição.
- [x] Remover a obrigatoriedade da descrição no formulário e na validação tRPC.
- [x] Exibir “Sem descrição” nos registros sem texto.
- [x] Validar TypeScript, 34 testes, build e diff.


## Pesquisa no registro de infração — 29/09/2026

- [x] Adicionar campo de pesquisa por nome do aluno ou turma no formulário.
- [x] Mostrar somente alunos compatíveis na seleção filtrada.
- [x] Trocar “Pode deixar em branco” por “Opcional” na descrição.
- [x] Validar TypeScript, 34 testes, build e diff.


## Mercado Pago Pix sandbox — 02/10/2026

- [x] Configurar credenciais de teste protegidas, sem versionar tokens.
- [x] Validar Access Token no endpoint leve de identidade do Mercado Pago.
- [x] Criar cliente server-side para gerar Pix sandbox e consultar status.
- [x] Adicionar rotas tRPC protegidas pela permissão de vendas.
- [x] Adicionar painel na aba Vendas com QR Code, copia e cola e atualização de status.
- [x] Manter a venda e o estoque inalterados ao gerar apenas a cobrança de teste.
- [x] Validar TypeScript, 38 testes, build e diff.


## Ícones de categorias de estoque — 02/10/2026

- [x] Adicionar coluna aditiva `icon` em `inventoryCategories` com fallback `package`.
- [x] Associar as categorias padrão aos ícones blusa, livro e outros sem alterar produtos existentes.
- [x] Permitir ao dono escolher Blusa, Outros ou Livro ao criar uma categoria.
- [x] Exibir o ícone escolhido ao lado de cada produto cadastrado no estoque.
- [x] Atualizar contratos tRPC, documentação e testes de fallback.
- [x] Validar TypeScript, 40 testes, build e diff.


## Ajuste visual dos ícones — 02/10/2026

- [x] Renomear a descrição acessível do ícone package para Outros.
- [x] Remover os nomes visíveis do seletor e deixar somente as três imagens.
- [x] Manter `aria-label` e `title` para acessibilidade sem poluir a interface.
- [x] Validar TypeScript, 40 testes, build e diff.


## Exclusão segura de categorias — 02/10/2026

- [x] Adicionar mutação protegida pelo dono para arquivar categorias.
- [x] Adicionar lixeira e confirmação visual na lista de categorias.
- [x] Preservar produtos, vendas, movimentações e históricos que usam a categoria.
- [x] Atualizar documentação e validar TypeScript, 40 testes, build e diff.

## Portal da família e comunicação escolar — 02/10/2026

- [x] Criar tabelas aditivas de contas familiares, vínculos aluno-responsável, notificações e mensagens (`0015_amused_hitman.sql`).
- [x] Criar login separado por e-mail e senha com scrypt, cookie e audiência JWT próprios, sem acesso ao painel interno.
- [x] Adicionar portal `/familia` para ver alunos vinculados, infrações, comunicados e histórico de mensagens.
- [x] Adicionar formulário para o responsável enviar mensagens à secretaria.
- [x] Adicionar área interna **Famílias e mensagens** para criar acessos, enviar comunicados e acompanhar mensagens recebidas.
- [x] Disparar notificação automática ao responsável quando uma infração é registrada.
- [x] Adicionar permissão configurável `communications` e proteger rotas no servidor.
- [x] Validar migração aplicada, TypeScript, 41 testes, build e capturas desktop/mobile.

## Chat ao vivo escola-família — 02/10/2026

- [x] Reutilizar o histórico existente e agrupar mensagens por responsável, aluno e assunto em conversas.
- [x] Substituir a área interna de comunicados por caixa de entrada, lista de chats, abertura de conversa e respostas.
- [x] Substituir o formulário do responsável por lista de conversas, respostas e nova conversa.
- [x] Atualizar automaticamente novas mensagens a cada 3 segundos nos dois lados.
- [x] Manter as permissões, vínculos de aluno e sessões separadas entre equipe e responsáveis.
- [x] Validar TypeScript, 41 testes, build e revisão visual das telas.

## Chat sem nova conversa e identificação da secretaria — 02/10/2026

- [x] Remover a opção Nova conversa da área interna.
- [x] Remover a opção Nova conversa do portal do responsável.
- [x] Adicionar identificação do responsável, e-mail, aluno e assunto no cabeçalho do chat.
- [x] Salvar o nome da secretaria autenticada em mensagens escolares e exibi-lo no histórico.
- [x] Preservar mensagens antigas com fallback visual para “Secretaria”.

## Restauração da criação de contas familiares — 02/10/2026

- [x] Recolocar o formulário **Criar acesso familiar** na área interna.
- [x] Permitir selecionar aluno ativo, nome, e-mail e senha inicial do responsável.
- [x] Mostrar os acessos familiares já cadastrados.
- [x] Manter a remoção de **Nova conversa** e o chat iniciado pelo responsável.
- [x] Validar TypeScript, 42 testes, build e diff.

## Recuperação de senha de responsáveis — 02/10/2026

- [x] Adicionar a ação Redefinir senha em cada acesso familiar cadastrado.
- [x] Criar mutação protegida pela permissão Famílias e mensagens.
- [x] Armazenar a nova senha com scrypt e invalidar sessões antigas.
- [x] Validar TypeScript, 42 testes, build e diff.

## Pesquisa e edição de contas familiares — 02/10/2026

- [x] Adicionar pesquisa por nome, e-mail, telefone ou aluno vinculado.
- [x] Permitir editar nome, e-mail e telefone da conta familiar.
- [x] Permitir informar uma nova senha opcional no formulário de edição.
- [x] Adicionar telefone ao cadastro e à migração sem alterar contas existentes.
- [x] Validar TypeScript, 42 testes, build, diff e revisão visual.
