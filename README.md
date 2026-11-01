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
> pessoas com deficiência. A marca, os dados da empresa e os produtos são
> fictícios, e o pagamento é simulado.

Loja completa em HTML + Tailwind (`www/`), exibida também como aplicativo
Android/iOS por um app React Native (Expo) com WebView. O mesmo código serve o
site, o app e a versão instalável (PWA).

## Comandos

| Comando           | O que faz                                              |
| ----------------- | ------------------------------------------------------ |
| `npm install`     | Instala as dependências                                |
| `npm start`       | Site (porta 8080) + Expo (QR code para o Expo Go)      |
| `npm run web`     | Site + app no navegador                                |
| `npm run android` | Site + app no emulador/celular Android                 |
| `npm run site`    | Só o site em http://localhost:8080                     |
| `npm run format`  | Formata HTML/CSS/JS com Prettier                       |

No celular, use o **Expo Go** na mesma rede Wi-Fi do computador. Se o site não
abrir, libere a porta 8080 no Firewall do Windows.

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
| `router.js`          | Mapa de rotas e utilitários de URL                                    |
| `store.js`           | Sacola, conta, pedidos, preços, Grãos e CEP                           |
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
3. **Back-end real.** Hoje conta, pedidos e Grãos ficam no `localStorage`
   do aparelho (bom para demonstração). Para vender de verdade, troque as
   funções de `store.js` por chamadas a uma API com banco de dados, envio de
   e-mail e um gateway de pagamento (Mercado Pago, Pagar.me, Stripe…). Os
   campos de cartão do checkout devem virar o formulário seguro do gateway.
4. **Formulário de contato.** Abre o e-mail do visitante já preenchido; para
   receber direto, ligue-o a uma API.
5. **Tailwind em produção.** O CDN é ótimo para protótipo; para performance,
   gere o CSS com o Tailwind CLI.
6. Publique a pasta `www/` em hospedagem com HTTPS e coloque o endereço em
   `PRODUCTION_SITE_URL` (`src/config.js`). O service worker (`www/sw.js`) só
   é ativado em produção; ao atualizar o site, aumente `VERSAO` nele.
