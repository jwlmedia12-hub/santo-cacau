// Santo Cacau — servidor (API + site). Inicie com: npm run server
const { app, PORTA, SITE_URL } = require('./app');
const { arquivo } = require('./db');
const pagamento = require('./pagamento');
const email = require('./email');

app.listen(PORTA, () => {
  console.log('Santo Cacau rodando em http://localhost:%d', PORTA);
  console.log('  Site público: %s', SITE_URL);
  console.log('  Banco de dados: %s', arquivo);
  console.log(
    '  Pagamento: %s',
    pagamento.provedor === 'mercadopago'
      ? 'Mercado Pago' + (process.env.MP_ACCESS_TOKEN.startsWith('TEST-') ? ' (credenciais de TESTE)' : ' (PRODUÇÃO)')
      : 'SIMULADO — defina MP_ACCESS_TOKEN no .env para usar o Mercado Pago'
  );
  console.log('  E-mail: %s', email.configurado ? 'SMTP configurado' : 'mostrado no console (defina SMTP_HOST para enviar)');
});
