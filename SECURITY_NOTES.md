# Notas de segurança — autenticação local

Fontes consultadas em 26/09/2026:

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html): senhas não devem ser guardadas em claro; Argon2id recomendado, scrypt alternativo; configurações scrypt equivalentes incluem `N=2^15, r=8, p=3`. Cada senha exige salt aleatório.
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html): para autenticação sem MFA, senhas com menos de 15 caracteres são fracas; mensagens genéricas de login e limitação de tentativas ajudam contra enumeração e força bruta.
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html): cookies de sessão HttpOnly, Secure sob HTTPS e SameSite; invalidar sessões antigas após troca de senha ou permissão.

Decisões desta implementação: login `primeiroNome` + 4 dígitos informados do CPF é apenas um **nome de usuário**, não um segundo fator nem um segredo. O CPF completo não é armazenado. A senha deve ter 15 a 128 caracteres. Um número de versão persistido no banco invalida imediatamente as sessões de contas desativadas ou com senha trocada. Há bloqueio temporário por conta após repetidas falhas e limitação adicional por IP em memória; em hospedagem com várias instâncias, substitua a limitação por IP por uma solução compartilhada antes de expor publicamente o login. A ativação do novo provedor é opt-in, não automática.
