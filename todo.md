# Acompanhamento do projeto — autenticação Google

## Concluído nesta atualização

- [x] Preservar o login Manus na versão hospedada por padrão.
- [x] Adicionar modo opcional `VITE_AUTH_PROVIDER=google` para a instalação local.
- [x] Validar estado OAuth, ID token, e-mails permitidos e sessões assinadas.
- [x] Exibir instruções de configuração quando faltarem variáveis de ambiente.
- [x] Atualizar `LOCALHOST.md` com as etapas do Google Cloud e do Windows.
- [x] Testar checagem de tipos, suíte automatizada, build e rotas HTTP sem credenciais reais.

## Pendente do proprietário da instalação local

- [ ] Criar aplicativo OAuth Web no Google Cloud e autorizar `http://localhost:3000/api/auth/google/callback`.
- [ ] Guardar Client ID e Client Secret **somente** no arquivo `.env` local; configurar `GOOGLE_ALLOWED_EMAILS`.
- [ ] Atualizar o clone no computador com `git pull origin main` e `pnpm.cmd install`, depois reiniciar `pnpm.cmd dev`.
- [ ] Testar a entrada real com um e-mail permitido e usuário de teste do Google, sem compartilhar segredos.

## Melhorias futuras antes de uso real na escola

- [ ] Separar permissões por papel para matrícula, estoque, vendas e cancelamentos.
- [ ] Implantar backup do banco e plano de restauração.
