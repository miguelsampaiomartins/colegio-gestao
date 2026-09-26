# Acompanhamento — contas locais do colégio

## Implementado e verificado

- [x] Tabela separada `staffAccounts` e migrações aditivas, sem alteração dos dados escolares.
- [x] Assistente `pnpm owner:init` para criar uma única conta de dono no banco local, com senha oculta.
- [x] Nome de usuário = primeiro nome sem acento + quatro primeiros dígitos informados do CPF; CPF completo não é solicitado nem armazenado.
- [x] Senhas com hash scrypt e salt aleatório, mínimo de 15 caracteres; bloqueio temporário após erros repetidos.
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
