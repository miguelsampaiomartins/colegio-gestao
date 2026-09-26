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

Implementar backup e recuperação do banco, HTTPS caso o sistema fique disponível em outros computadores e limitação de tentativas compartilhada entre instâncias se for publicado em hospedagem distribuída. O acesso do funcionário cobre as telas operacionais, não a gestão dos membros.
