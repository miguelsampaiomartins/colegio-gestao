# Acompanhamento do projeto — autenticação Google

## Trabalho de implementação concluído

- [x] Preservar o login Manus por padrão na versão hospedada.
- [x] Adicionar modo opcional `VITE_AUTH_PROVIDER=google` à instalação local.
- [x] Proteger o fluxo com estado OAuth, nonce, validação do ID token, e-mails permitidos e sessões assinadas.
- [x] Mostrar diagnóstico de configuração na tela de entrada quando faltarem variáveis de ambiente.
- [x] Atualizar `LOCALHOST.md` com os passos do Google Cloud e do Windows.
- [x] Validar instalação, checagem de tipos, suíte automatizada, build e rotas HTTP sem credenciais reais.
- [x] Confirmar que a versão hospedada mantém o login anterior.

## Configuração externa sob controle do proprietário

Para usar no próprio computador, o proprietário precisa criar um cliente OAuth Web no Google Cloud, autorizar o callback exato de localhost, colocar o Client ID e o Client Secret **somente** no `.env` local e informar `GOOGLE_ALLOWED_EMAILS`. Depois deve atualizar o clone com `git pull origin main`, instalar dependências, reiniciar o servidor e fazer um login real com um e-mail permitido. Essas etapas não podem ser executadas neste sandbox porque as credenciais e o Windows do proprietário não estão disponíveis aqui. O guia `LOCALHOST.md` traz o passo a passo sem exigir compartilhamento de segredos.

## Fora do escopo desta correção

Antes do uso real com alunos e vendas, convém separar permissões por papel e implementar backups do banco. A lista de e-mails permitidos já bloqueia contas não autorizadas no modo Google, mas não diferencia funções internas.
