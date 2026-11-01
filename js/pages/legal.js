// Páginas institucionais: sumário automático a partir dos títulos e ações comuns.
(function () {
  var SC = window.SantoCacau;
  var icon = SC.util.icon;
  var artigo = document.querySelector('.prose-legal');
  var sumario = document.getElementById('sumario');
  if (!artigo) return;

  var titulos = artigo.querySelectorAll('h2');
  if (sumario && titulos.length > 2) {
    var itens = Array.prototype.map
      .call(titulos, function (h, i) {
        if (!h.id) h.id = 'secao-' + (i + 1);
        h.setAttribute('tabindex', '-1');
        return '<li><a class="underline underline-offset-2 hover:text-secondary" href="#' + h.id + '">' + h.textContent + '</a></li>';
      })
      .join('');
    sumario.innerHTML =
      '<nav aria-labelledby="sumario-titulo" class="card rounded-xl bg-surface-container-low p-4">' +
      '<h2 id="sumario-titulo" class="text-title-md mb-2">Nesta página</h2>' +
      '<ol class="list-decimal pl-5 flex flex-col gap-1 text-body-md">' + itens + '</ol></nav>';
  }

  var acoes = document.getElementById('acoes-pagina');
  if (acoes) {
    acoes.innerHTML =
      '<button type="button" id="imprimir" class="btn tap px-4 rounded-full border border-outline text-label-lg flex items-center gap-2">' + icon('print') + 'Imprimir ou salvar PDF</button>' +
      '<button type="button" data-abrir-a11y class="btn tap px-4 rounded-full border border-outline text-label-lg flex items-center gap-2">' + icon('volume_up') + 'Ouvir ou ajustar leitura</button>';
    document.getElementById('imprimir').addEventListener('click', function () {
      window.print();
    });
  }
})();
