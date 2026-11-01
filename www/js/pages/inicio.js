// Página inicial: coleções e destaques vêm do catálogo (data.js).
(function () {
  var SC = window.SantoCacau;
  var DATA = window.SC_DATA;
  var icon = SC.util.icon;

  var colecoes = document.getElementById('lista-colecoes');
  colecoes.innerHTML = DATA.colecoes
    .map(function (c) {
      return (
        '<li class="shrink-0"><a href="' + SC.url('catalogo', { colecao: c.id }) + '" ' +
        'class="btn tap flex items-center gap-1.5 px-4 rounded-full bg-surface-container text-on-surface text-label-md hover:bg-surface-container-high">' +
        icon(c.icone, 'text-[1.125rem] text-secondary') + c.nome + '</a></li>'
      );
    })
    .join('');

  var destaques = DATA.produtos
    .slice()
    .sort(function (a, b) {
      return (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0) || b.avaliacoes - a.avaliacoes;
    })
    .slice(0, 6);

  document.getElementById('lista-destaques').innerHTML = destaques
    .map(function (p) {
      return SC.ui.productCard(p, 'w-72 shrink-0 snap-start md:w-auto');
    })
    .join('');
})();
