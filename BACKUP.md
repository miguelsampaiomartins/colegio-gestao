# Backup local do Colégio Gestão — Windows

O sistema não consegue fazer backup do seu computador a partir desta sessão. **Os comandos abaixo devem ser executados no Windows que guarda o MySQL local.** O agendador não depende de deixar a página aberta, mas depende de o computador estar ligado e da conta do Windows estar conectada. Nenhum backup é enviado a terceiros automaticamente.

| Opção | Troca principal | Custo adicional | Configuração |
| --- | --- | --- | --- |
| Cópia manual criptografada | Você decide quando executar | Nenhum | Apenas os passos 1–3 |
| Cópia diária criptografada | Executa em horário escolhido enquanto o computador e sua sessão estiverem ativos | Nenhum | Passos 1–4 |

## 1. Atualize o sistema e o banco

Na pasta `colegio-gestao`, interrompa o site (`Ctrl+C`) e execute:

```powershell
git pull origin main
pnpm.cmd install
pnpm.cmd db:push
```

O último comando aplica as migrações pendentes, inclusive as novas tabelas de auditoria e estado dos backups; esta atualização não elimina registros. Mantenha `DATABASE_URL` apontando ao **banco MySQL local** no seu `.env`. Se essa URL aponta a outro servidor, o script se recusa a fazer a cópia automática. Os dados reais do colégio permanecem no seu banco; `git pull` não os baixa nem substitui.

## 2. Gere e guarde uma chave de backup

Execute `pnpm.cmd backup:keygen` **uma única vez**. O programa mostra `BACKUP_KEY=...`. Abra `notepad .env`, adicione exatamente essa linha e salve. Não compartilhe a chave nem a coloque no GitHub. **Uma nova chave não abre backups gerados com a antiga**. Guarde uma cópia segura da chave separada do computador e dos arquivos de backup; não a cole em mensagens.

O arquivo `.env` continua com `DATABASE_URL`, `JWT_SECRET` e `VITE_AUTH_PROVIDER=password`. O `.env` não vai ao Git, mas quem tiver acesso irrestrito ao computador ainda poderá ler a chave; proteja o login do Windows e a pasta de backups.

Opcionalmente, defina em `.env` o caminho de destino, **fora** da pasta do projeto:

```dotenv
BACKUP_DIR=C:\ColegioGestaoBackups
```

Se não definir, usa `ColegioGestaoBackups` na pasta pessoal do Windows. A rotina cria arquivos `colegio-...sql.gcm` **criptografados com AES-256-GCM**, em streaming. Ela só marca sucesso depois de autenticar e verificar o arquivo. `mysqldump.exe` é procurado na instalação padrão de MySQL Server ou no `PATH`; se não for encontrado, informe `MYSQLDUMP_PATH` no `.env` com o caminho completo do programa.

## 3. Faça a primeira cópia e confira

```powershell
pnpm.cmd backup:run
```

Aguarde a mensagem `Backup pronto` com o caminho do arquivo. Entre com a conta do dono na página **Auditoria e backups**; a última execução deverá aparecer como **concluída**. Para verificar novamente o arquivo criptografado:

```powershell
pnpm.cmd backup:verify "C:\Users\SEU_USUARIO\ColegioGestaoBackups\colegio-ARQUIVO.sql.gcm"
```

Substitua o caminho pelo exibido no terminal. O arquivo SQL **não** fica aberto em texto simples; se faltar espaço ou o programa de exportação falhar, a cópia incompleta é removida e nenhum sucesso é exibido. `backupRuns` guarda somente o nome do arquivo e o resultado, nunca a chave ou a senha do banco. O painel também só mostra resultados **depois desta atualização**.

## 4. Opcional: instale o agendamento diário

Abra PowerShell **na pasta do projeto**, com sua conta habitual do Windows, e execute:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-backup-task.ps1
```

Informe um horário como `18:30`, quando o computador costuma estar ligado e sua sessão de Windows conectada. O instalador cria a tarefa `ColegioGestao-BackupDiario` no **Agendador de Tarefas**, não armazena sua senha nele nem altera a política de execução do Windows como um todo. Ele não substitui uma tarefa de mesmo nome nem executa cópias durante a instalação. Após o horário escolhido, confira o painel do dono ou `ColegioGestaoBackups\backup-task.log` na pasta pessoal. Se o computador estiver desligado ou sua sessão do Windows não estiver conectada, a execução pode ser perdida ou retomada ao voltar, conforme o Windows; **confirme a data do último sucesso**, não presuma que rodou.

Para modificar ou suspender o horário, use o Agendador de Tarefas do Windows e localize `ColegioGestao-BackupDiario`. Se preferir não agendar, use `pnpm.cmd backup:run` manualmente sempre que desejar.

## 5. Teste de recuperação sem substituir o banco real

Guarde o arquivo `.sql.gcm` e a `BACKUP_KEY` em locais separados do computador da escola. **Todo backup precisa de teste de restauração**. Em MySQL Workbench, crie um banco **novo e vazio** com nome terminado em `_restore_test`, por exemplo `colegio_restore_test`. Conceda ao seu usuário MySQL permissão para criar tabelas nesse banco. Adicione no `.env` somente para o teste:

```dotenv
BACKUP_RESTORE_TEST_URL=mysql://colegio_app:SENHA_CODIFICADA@127.0.0.1:3306/colegio_restore_test
```

Use a senha de MySQL codificada na URL (por exemplo `@` vira `%40`), sem enviá-la nesta conversa. Confira se `DATABASE_URL` ainda aponta ao banco **real diferente**; o programa verifica que o destino termina em `_restore_test`, está vazio e não é o mesmo banco do site. Então execute:

```powershell
pnpm.cmd backup:restore:test "C:\Users\SEU_USUARIO\ColegioGestaoBackups\colegio-ARQUIVO.sql.gcm"
```

A integridade de **todo o arquivo** é verificada antes de qualquer SQL ser enviado ao banco de teste. Confira alunos, vendas e histórico no Workbench usando apenas essa base de teste. Não use um banco com tabelas existentes: o programa se recusa a apagá-las. O teste **não restaura no banco da escola**. Para recuperar o banco real após um desastre, avalie o estado do banco atual e planeje o procedimento com uma pessoa responsável; restaurá-lo pode substituir dados novos e não é automatizado por segurança.

## Limites e cuidados

- O histórico registra ações concluídas **depois** de instalar esta versão, no modo de login local; não reconstruirá quem alterou dados anteriores.
- Se a gravação do evento de auditoria falhar depois de uma ação bem-sucedida, a ação permanece concluída e o servidor mostra um alerta no log. Portanto, é uma trilha operacional de ajuda, **não uma garantia contábil imutável**.
- Os arquivos criptografados continuam no computador até você movê-los. **Não há exclusão automática** nem cópia externa. Backup no mesmo disco não protege contra furto, falha física ou incêndio: copie periodicamente o arquivo criptografado para mídia ou destino confiável **separado** e mantenha a chave em outro local seguro.
- O script usa o MySQL local e a instalação do Windows. Esta configuração **não faz backup automático do banco hospedado**. A versão hospedada exige outra arquitetura e um destino de armazenamento autorizado.
- Não envie `.env`, `BACKUP_KEY`, SQL descriptografado nem dumps ao repositório ou nesta conversa.

Fontes técnicas e justificativas: [BACKUP_SECURITY.md](./BACKUP_SECURITY.md).
