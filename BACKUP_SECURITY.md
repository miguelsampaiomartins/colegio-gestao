# Referências e decisões de backup e auditoria

Consultado em 26/09/2026:

- [MySQL 8.4: mysqldump](https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html): `--single-transaction` para consistência com InnoDB; `--result-file` evita a codificação UTF-16 do redirecionamento PowerShell; `--no-tablespaces` reduz privilégios exigidos. Não inserir a senha de banco nos argumentos visíveis do processo. `mysqldump` é um backup lógico, não ideal para bases grandes.
- [Microsoft: schtasks /create](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/schtasks-create): `/sc daily /st HH:MM` agenda diariamente; `/it` executa somente com o usuário conectado. Tarefa não roda se o computador estiver desligado.
- [OWASP: Secrets Management — Backup and Restore](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html): automatizar backup, criptografar, reduzir acesso ao arquivo e testar restauração periodicamente.

Decisão para a instalação local: script Node de backup criptografado AES-256-GCM com `mysqldump` em streaming e verificação da tag, fora da pasta do código. Inclui opção manual e instalador opcional de tarefa diária no Windows; a instalação não é feita daqui, pois o computador do proprietário não está conectado à sessão. Nenhuma cópia para nuvem sem destino autorizado. Não excluir automaticamente backups antigos.
