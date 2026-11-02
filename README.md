# Santo Cacau — Site e App

**Veja o site funcionando:** https://jwlmedia12-hub.github.io/santo-cacau/

> **Sobre o projeto:** a Santo Cacau nasceu como um trabalho acadêmico do curso
> de **Análise e Desenvolvimento de Sistemas (ADS)**. O professor pediu o
> esboço de uma marca concorrente no mercado de chocolates. Antes de virar
> este projeto funcional, era apenas um esboço: telas estáticas, com preços
> fixos no HTML, botões sem ação e sem recursos de acessibilidade.
>
> A partir dele, o projeto foi transformado em uma loja que funciona de ponta
> a ponta, com catálogo, sacola, checkout, conta, programa de fidelidade,
> políticas de privacidade e cookies (LGPD) e recursos de acessibilidade para
> pessoas com deficiência, além de um back-end próprio com banco de dados e
> pagamento pelo Mercado Pago. A marca, os dados da empresa e os produtos são
> fictícios.

Loja completa em HTML + Tailwind (`www/`), com servidor Node.js (`server/`)
e um app React Native (Expo) que exibe o site no Android/iOS. O mesmo código
serve o site, o app e a versão instalável (PWA).

## Dois modos de funcionamento

| Modo              | Onde                                  | Conta, pedidos e Grãos         | Pagamento                       |
| ----------------- | ------------------------------------- | ------------------------------ | ------------------------------- |
| **Demonstração**  | GitHub Pages ou `npm run site`        | No navegador (`localStorage`)  | Simulado                        |
| **Com servidor**  | `npm run server` ou hospedagem (Render) | Supabase (PostgreSQL) ou SQLite local | Mercado Pago (ou simulado sem credenciais) |

O modo é escolhido em `www/js/config.js` (`apiUrl`). O servidor entrega esse
arquivo já configurado, então quem abre o site pelo servidor usa a API
automaticamente.

## Comandos

| Comando                | O que faz                                                   |
| ---------------------- | ----------------------------------------------------------- |
| `npm install`          | Instala as dependências                                     |
| `npm run server`       | Servidor (API + site) em http://localhost:3000              |
| `npm start`            | Servidor + Expo (QR code para o Expo Go)                    |
| `npm run web`          | Servidor + app no navegador                                 |
| `npm run android`      | Servidor + app no emulador/celular Android                  |
| `npm run site`         | Só o site estático (modo demonstração) em http://localhost:8080 |
| `npm run format`       | Formata HTML/CSS/JS com Prettier                            |
| `npm run deploy:pages` | Atualiza o site no GitHub Pages (faça commit antes)         |

Requer **Node.js 22.13 ou mais novo** (o banco SQLite já vem embutido). No
celular, use o **Expo Go** na mesma rede Wi-Fi do computador; se não abrir,
libere a porta 3000 no Firewall do Windows.

## Back-end e pagamentos

1. Copie `.env.example` para `.env`.
2. Rode `npm run server`. Sem credenciais, o pagamento fica **simulado**: o
   Pix mostra um botão "Simular pagamento aprovado" e o cartão é aprovado na
   hora. Os e-mails (ex.: link de nova senha) aparecem no terminal.
3. **Mercado Pago (teste):** crie uma aplicação em
   https://www.mercadopago.com.br/developers/panel/app, copie o
   **Access Token de teste** (começa com `TEST-`) para `MP_ACCESS_TOKEN` no
   `.env` e reinicie. A partir daí:
   - **Pix:** o QR Code real aparece na página do pedido, que se atualiza
     sozinha quando o pagamento é confirmado.
   - **Cartão:** o cliente é levado ao ambiente seguro do Mercado Pago
     (Checkout Pro). Os dados do cartão nunca passam pelo nosso servidor.
   - Use os [cartões de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/your-integrations/test/cards)
     e um comprador de teste do painel.
4. **Confirmação automática (webhook):** em produção, cadastre no painel do
   Mercado Pago a URL `https://SEU-ENDERECO/api/webhooks/mercadopago` (evento
   *Pagamentos*) e copie a assinatura secreta para `MP_WEBHOOK_SECRET`.
   Localmente, sem endereço público, a página do pedido consulta o status a
   cada 5 segundos.

### O que o servidor garante

- **Preços calculados no servidor** (`www/js/pricing.js` é o mesmo código no
  site e no servidor): alterar valores pelo navegador não muda o que é cobrado.
- **Grãos Dourados** creditados só com o pagamento aprovado, uma única vez; os
  usados num pedido voltam se o pagamento for recusado ou expirar.
- **Senhas** com `scrypt`; sessões por token com validade de 30 dias; link de
  nova senha de uso único, válido por 1 hora, que encerra as outras sessões.
- **Proteções:** limite de tentativas (login, cadastro, contato), CORS só para
  os sites autorizados, validação de CPF, idade (18+), maioridade para
  produtos com álcool e aceite dos termos.
- **LGPD:** exportação dos dados (JSON) e exclusão da conta; pedidos ficam
  guardados sem dados pessoais (exigência fiscal).

### Banco no Supabase (gratuito)

Sem configurar nada, o servidor usa um arquivo SQLite local, bom para testar
no computador. Para usar o Supabase:

1. Crie uma conta e um projeto em https://supabase.com (região **South
   America (São Paulo)**) e anote a senha do banco.
2. No projeto, clique em **Connect** e copie a URI do **Session pooler**
   (funciona em qualquer rede e no Render).
3. Cole em `DATABASE_URL` no `.env`, trocando `[YOUR-PASSWORD]` pela senha.
4. Rode `npm run server`: as tabelas são criadas sozinhas no schema
   `santo_cacau`, com RLS ativado. O schema fica fora do `public`, que o
   Supabase expõe pela API REST, então só o servidor acessa os dados (nunca
   publique a senha do banco nem a chave `service_role`).

No painel do Supabase (**Table Editor**, schema `santo_cacau`) dá para ver
usuários, pedidos e mensagens de contato.

**Limites do plano gratuito:** o Supabase pausa projetos sem uso por 7 dias
(é só reativar no painel) e o Render gratuito "dorme" após 15 minutos sem
acesso — a primeira visita depois disso demora cerca de 1 minuto.

### Estrutura do servidor (`server/`)

| Arquivo        | Responsabilidade                                                  |
| -------------- | ----------------------------------------------------------------- |
| `index.js`     | Inicia o servidor                                                 |
| `app.js`       | Rotas da API, segurança e site estático                           |
| `servicos.js`  | Regras de negócio: contas, Grãos, pedidos, status e contato       |
| `pagamento.js` | Mercado Pago (Pix, Checkout Pro, webhook) e modo simulado         |
| `db.js`        | Banco: PostgreSQL/Supabase ou SQLite (tabelas criadas sozinhas)   |
| `catalogo.js`  | Lê catálogo e regras de `www/js` (mesma fonte do site)            |
| `email.js`     | E-mails por SMTP (ou no terminal, sem configuração)               |

### Publicar o servidor (Render)

O arquivo `render.yaml` publica tudo em um só endereço com HTTPS, no plano
gratuito: em https://render.com, clique em **New › Blueprint**, escolha este
repositório e preencha `DATABASE_URL` (Supabase), `PUBLIC_URL` (o endereço
que o Render der, ex.: `https://santo-cacau.onrender.com`) e
`MP_ACCESS_TOKEN`. Depois, coloque o endereço do servidor em
`PRODUCTION_SITE_URL` (`src/config.js`) para o app usar o servidor publicado.
Se quiser que o site do GitHub Pages também use o servidor, ponha o mesmo
endereço em `apiUrl` (`www/js/config.js`) e mantenha o GitHub Pages em
`ALLOWED_ORIGINS`.

## Páginas

| Rota             | Arquivo                    | Conteúdo                                                      |
| ---------------- | -------------------------- | ------------------------------------------------------------- |
| `inicio`         | `index.html`               | Destaques, coleções, Passaporte                               |
| `catalogo`       | `html/catalogo.html`       | Busca, filtros (intensidade, dieta, coleção), ordenação       |
| `produto`        | `html/produto.html?id=`    | Detalhes, quantidade, ingredientes, alérgicos e glúten        |
| `carrinho`       | `html/carrinho.html`       | Quantidades, presente, cupom, Grãos, CEP e frete              |
| `checkout`       | `html/checkout.html`       | Identificação, endereço (ViaCEP), Pix/cartão, aceite          |
| `pedido`         | `html/pedido.html?id=`     | Confirmação, código Pix, acompanhamento                       |
| `login`          | `html/login.html`          | Entrar, criar conta, recuperar senha                          |
| `dashboard`      | `html/dashboard.html`      | Pedidos, recompensas, agendamentos, dados, privacidade (LGPD) |
| `passaporte`     | `html/passaporte.html`     | Níveis, experiências com agendamento, boutiques               |
| `ajuda`          | `html/ajuda.html`          | Perguntas frequentes, canais e formulário de contato          |
| `privacidade`    | `html/privacidade.html`    | Política de Privacidade (LGPD)                                |
| `cookies`        | `html/cookies.html`        | Política de Cookies                                           |
| `termos`         | `html/termos.html`         | Termos de Uso, condições de venda e regulamento do Passaporte |
| `trocas`         | `html/trocas.html`         | Arrependimento (CDC art. 49), trocas e reembolsos             |
| `acessibilidade` | `html/acessibilidade.html` | Declaração de Acessibilidade                                  |

## Estrutura do código do site (`www/js/`)

| Arquivo              | Responsabilidade                                                      |
| -------------------- | --------------------------------------------------------------------- |
| `theme.js`           | Paletas (padrão e alto contraste) e preferências aplicadas sem piscar |
| `tailwind.config.js` | Tema do Tailwind usando as variáveis de cor                           |
| `empresa.js`         | **Dados da empresa: CNPJ, contatos, encarregado (DPO)**               |
| `data.js`            | Produtos, filtros, níveis, recompensas, experiências, boutiques, regras de frete e cupons |
| `config.js`          | Modo de funcionamento (demonstração ou servidor)                      |
| `router.js`          | Mapa de rotas e utilitários de URL                                    |
| `pricing.js`         | Regras de preço, frete, cupons e níveis (também usado pelo servidor)  |
| `backend-local.js`   | Back-end de demonstração (`localStorage`)                             |
| `backend-api.js`     | Back-end real: chamadas à API do servidor                             |
| `store.js`           | Sacola, conta, pedidos e CEP; escolhe o back-end conforme `config.js` |
| `layout.js`          | Cabeçalho, menus, rodapé, avisos e componentes compartilhados        |
| `a11y.js`            | Painel de acessibilidade                                              |
| `consent.js`         | Consentimento de cookies (LGPD)                                       |
| `pages/*.js`         | Script de cada tela                                                   |

Toda página tem só `<main id="conteudo">` e `data-route`; o resto é injetado
por `layout.js`.

## Acessibilidade (PCD)

- Painel em todas as páginas: tradutor de **Libras (VLibras)**, **leitura em
  voz alta**, 5 tamanhos de texto (até 175%), **alto contraste claro e escuro**,
  fonte Atkinson Hyperlegible, espaçamento WCAG 1.4.12, destaque de links,
  pausa de animações, guia de leitura e cursor ampliado.
- Zoom liberado (o site antigo bloqueava com `user-scalable=no`).
- Atalhos eMAG: Alt+1 conteúdo, Alt+2 menu, Alt+3 busca, Alt+4 rodapé.
- Leitores de tela: ícones ocultos, avisos `aria-live` (sacola, filtros,
  erros), abas e interruptores com ARIA, diálogos nativos com foco preso.
- Formulários com rótulo visível, erro em texto ligado ao campo e foco no
  primeiro erro. Alvos de toque de 44 px. Seleção não depende só de cor.
- No app: respeita o tamanho de fonte do sistema (Android e iOS), a leitura em
  voz alta usa a voz nativa (`expo-speech`), e telefone, e-mail, WhatsApp e
  mapas abrem nos apps do aparelho.

## Privacidade (LGPD)

- Banner de cookies com “Rejeitar” e “Aceitar” igualmente visíveis e
  preferências por categoria (`Gerenciar cookies` no rodapé).
- Ferramentas de estatística/marketing só carregam com consentimento: use
  `<script type="text/plain" data-consent="estatisticas" data-src="...">`.
- Cadastro com aceite de termos obrigatório e marketing opcional desmarcado.
- Em Minha conta › Privacidade: baixar os dados (JSON), revogar ofertas,
  gerenciar cookies e excluir a conta.

## Antes de publicar

1. **Preencha `www/js/empresa.js`** (razão social, CNPJ, encarregado de dados,
   contatos). Os campos `[PREENCHER]` aparecem no rodapé e nas políticas.
2. **Revise as políticas com um advogado.** Os textos seguem LGPD, CDC e
   Marco Civil, mas regras comerciais (validade dos Grãos, prazos, cupons)
   precisam refletir a operação real.
3. **Pagamento em produção.** Teste tudo com as credenciais `TEST-`. Só troque
   pelo Access Token de produção depois de homologar a conta no Mercado Pago,
   configurar o webhook com `MP_WEBHOOK_SECRET` e o SMTP para os e-mails.
4. **Tailwind em produção.** O CDN é ótimo para protótipo; para performance,
   gere o CSS com o Tailwind CLI.
5. **Backup do banco.** O plano gratuito do Supabase não guarda backups
   diários para restaurar; exporte os dados pelo painel de tempos em tempos.
