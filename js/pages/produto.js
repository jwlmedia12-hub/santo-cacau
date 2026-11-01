// Página de produto: detalhes, quantidade, alérgicos (RDC 26/2015) e glúten (Lei 10.674/2003).
(function () {
  var SC = window.SantoCacau;
  var util = SC.util;
  var esc = util.esc;
  var icon = util.icon;
  var root = document.getElementById('produto');
  var p = SC.produtos.get(SC.param('id'));

  if (!p) {
    document.title = 'Produto não encontrado — Santo Cacau';
    root.innerHTML =
      '<div class="card rounded-xl bg-surface-container-low p-8 text-center flex flex-col items-center gap-3 mt-4">' +
      icon('search_off', 'text-[2.5rem] text-secondary') +
      '<h1 class="font-titulo text-headline-lg">Produto não encontrado</h1>' +
      '<p class="text-body-md text-on-surface-variant">O chocolate que você procura pode ter saído do catálogo.</p>' +
      '<a href="' + SC.url('catalogo') + '" class="btn tap px-5 rounded-full bg-primary text-on-primary text-label-lg flex items-center">Ver todos os chocolates</a></div>';
    return;
  }

  document.title = p.nome + ' — Santo Cacau';

  var dietas = p.dietas
    .map(function (d) {
      return '<li class="px-3 py-1 rounded-full bg-surface-container text-on-surface text-label-md flex items-center gap-1">' + icon('eco', 'text-[1rem] text-secondary') + esc(SC.ui.dietaNome(d)) + '</li>';
    })
    .join('');

  var relacionados = window.SC_DATA.produtos
    .filter(function (o) {
      return o.id !== p.id && (o.categoria === p.categoria || o.intensidades.some(function (i) { return p.intensidades.indexOf(i) !== -1; }));
    })
    .slice(0, 3);

  root.innerHTML =
    '<nav aria-label="Você está em" class="pt-2 text-body-sm text-on-surface-variant">' +
    '<ol class="flex flex-wrap items-center gap-1">' +
    '<li><a class="underline" href="' + SC.url('inicio') + '">Início</a></li><li aria-hidden="true">›</li>' +
    '<li><a class="underline" href="' + SC.url('catalogo') + '">Chocolates</a></li><li aria-hidden="true">›</li>' +
    '<li aria-current="page" class="text-on-surface">' + esc(p.nome) + '</li></ol></nav>' +

    '<div class="mt-4 grid gap-6 md:grid-cols-2 md:items-start">' +
    '<div class="card relative rounded-2xl overflow-hidden bg-surface-container-low shadow-md">' +
    '<img src="' + SC.asset(p.img) + '" alt="' + esc(p.alt) + '" class="w-full aspect-square object-cover" />' +
    '<span class="absolute top-3 left-3 bg-secondary-fixed text-on-secondary-fixed px-3 py-1 rounded-full text-label-sm">' + esc(p.selo) + '</span>' +
    '</div>' +

    '<div class="flex flex-col gap-3">' +
    '<p class="text-label-sm text-secondary uppercase tracking-widest">' + esc(p.categoria) + ' • ' + esc(p.teor) + '</p>' +
    '<h1 class="font-titulo text-headline-xl text-on-surface">' + esc(p.nome) + '</h1>' +
    SC.ui.rating(p) +
    '<p class="text-body-lg text-on-surface-variant">' + esc(p.descricao) + '</p>' +
    (dietas ? '<ul aria-label="Características" class="flex flex-wrap gap-2">' + dietas + '</ul>' : '') +
    (p.alcool
      ? '<p class="rounded-lg bg-error-container text-on-error-container p-3 text-body-sm font-semibold flex items-start gap-2">' + icon('no_drinks', 'shrink-0') +
        'Contém bebida alcoólica. Venda proibida para menores de 18 anos (Lei 13.106/2015).</p>'
      : '') +
    '<p class="mt-2"><span class="block text-body-sm text-on-surface-variant">' + esc(p.unidade) + '</span>' +
    '<span class="text-headline-lg font-bold text-on-surface">' + util.money(p.preco) + '</span>' +
    '<span class="block text-body-sm text-on-surface-variant">ou até 3x sem juros (parcela mínima de R$ 30)</span></p>' +

    '<div class="flex flex-wrap items-end gap-3 mt-2">' +
    '<div><label for="qtd" class="block text-label-lg mb-1">Quantidade</label>' +
    '<div class="flex items-center rounded-full border border-outline">' +
    '<button type="button" data-passo="-1" class="tap rounded-full flex items-center justify-center">' + icon('remove') + '<span class="sr-only">Diminuir quantidade</span></button>' +
    '<input id="qtd" type="number" inputmode="numeric" min="1" max="99" value="1" class="w-14 text-center bg-transparent text-title-md" />' +
    '<button type="button" data-passo="1" class="tap rounded-full flex items-center justify-center">' + icon('add') + '<span class="sr-only">Aumentar quantidade</span></button>' +
    '</div></div>' +
    '<button type="button" data-add-cart="' + p.id + '" data-qtd-input="qtd" class="btn tap flex-1 min-w-[12rem] h-12 px-6 rounded-full bg-primary text-on-primary text-label-lg flex items-center justify-center gap-2 shadow-md">' +
    icon('add_shopping_cart') + 'Adicionar à sacola</button>' +
    SC.ui.favButton(p, 'border border-outline h-12 w-12') +
    '</div>' +
    '<a href="' + SC.url('carrinho') + '" class="text-label-lg text-secondary underline underline-offset-2 self-start tap flex items-center">Ir para a sacola</a>' +

    '<section aria-labelledby="info-titulo" class="mt-4 flex flex-col gap-2">' +
    '<h2 id="info-titulo" class="sr-only">Informações do produto</h2>' +
    '<details class="rounded-xl border border-outline-variant bg-surface-container-lowest" open>' +
    '<summary class="tap cursor-pointer px-4 py-3 text-label-lg">Alérgicos e glúten</summary>' +
    '<div class="px-4 pb-4 flex flex-col gap-2 text-body-md">' +
    '<p class="font-bold text-on-surface">' + esc(p.alergicos) + '</p>' +
    '<p class="font-bold text-on-surface">' + esc(p.gluten) + '</p></div></details>' +
    '<details class="rounded-xl border border-outline-variant bg-surface-container-lowest">' +
    '<summary class="tap cursor-pointer px-4 py-3 text-label-lg">Ingredientes</summary>' +
    '<p class="px-4 pb-4 text-body-md text-on-surface-variant">' + esc(p.ingredientes) + '</p></details>' +
    '<details class="rounded-xl border border-outline-variant bg-surface-container-lowest">' +
    '<summary class="tap cursor-pointer px-4 py-3 text-label-lg">Conservação e entrega</summary>' +
    '<p class="px-4 pb-4 text-body-md text-on-surface-variant">Conserve em local seco e fresco, entre 15 °C e 20 °C, longe da luz e de odores. Não refrigerar. ' +
    'Enviamos em embalagem térmica para preservar a textura. Consumir em até 30 dias.</p></details>' +
    '</section>' +
    '</div></div>' +

    (relacionados.length
      ? '<section aria-labelledby="relacionados-titulo" class="mt-10"><h2 id="relacionados-titulo" class="font-titulo text-headline-lg mb-3">Você também pode gostar</h2>' +
        '<ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">' +
        relacionados.map(function (r) { return '<li class="flex">' + SC.ui.productCard(r, 'w-full') + '</li>'; }).join('') +
        '</ul></section>'
      : '');

  var qtd = document.getElementById('qtd');
  root.addEventListener('click', function (e) {
    var passo = e.target.closest('[data-passo]');
    if (!passo) return;
    var v = (parseInt(qtd.value, 10) || 1) + Number(passo.getAttribute('data-passo'));
    qtd.value = Math.max(1, Math.min(99, v));
    SC.ui.announce('Quantidade: ' + qtd.value);
  });
  qtd.addEventListener('change', function () {
    qtd.value = Math.max(1, Math.min(99, parseInt(qtd.value, 10) || 1));
  });
})();
