// Catálogo: busca, filtros (intensidade, dieta, coleção), ordenação e
// sincronização com o endereço da página (filtros compartilháveis).
(function () {
  var SC = window.SantoCacau;
  var DATA = window.SC_DATA;
  var esc = SC.util.esc;
  var icon = SC.util.icon;

  var form = document.getElementById('filtros');
  var busca = document.getElementById('filtro-busca');
  var colecao = document.getElementById('filtro-colecao');
  var ordem = document.getElementById('filtro-ordem');
  var lista = document.getElementById('lista-produtos');
  var status = document.getElementById('resultado-status');
  var vazio = document.getElementById('vazio');

  if (SC.auth.current()) document.getElementById('convite-passaporte').hidden = true;

  function pill(type, name, value, label, checked) {
    return (
      '<label class="relative shrink-0 cursor-pointer">' +
      '<input type="' + type + '" name="' + name + '" value="' + value + '" class="sr-only peer"' + (checked ? ' checked' : '') + ' />' +
      '<span class="btn tap inline-flex items-center gap-1 px-4 rounded-full border border-outline-variant bg-surface-container text-on-surface text-label-md whitespace-nowrap ' +
      'peer-checked:bg-primary peer-checked:text-on-primary peer-checked:border-primary ' +
      'peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-foco peer-focus-visible:outline-offset-2">' +
      icon('check', 'chk hidden text-[1.125rem]') + esc(label) + '</span></label>'
    );
  }

  // Estado inicial a partir da URL.
  var params = new URLSearchParams(location.search);
  var dietasIniciais = (params.get('dietas') || '').split(',').filter(Boolean);
  var intensidadeInicial = params.get('intensidade') || 'todas';

  document.getElementById('filtro-intensidade').innerHTML =
    pill('radio', 'intensidade', 'todas', 'Todos os teores', intensidadeInicial === 'todas') +
    DATA.intensidades
      .map(function (i) {
        return pill('radio', 'intensidade', i.id, i.nome, intensidadeInicial === i.id);
      })
      .join('');

  document.getElementById('filtro-dietas').innerHTML = DATA.dietas
    .map(function (d) {
      return pill('checkbox', 'dieta', d.id, d.nome, dietasIniciais.indexOf(d.id) !== -1);
    })
    .join('');

  colecao.innerHTML =
    '<option value="">Todas as coleções</option>' +
    DATA.colecoes
      .map(function (c) {
        return '<option value="' + c.id + '">' + esc(c.nome) + '</option>';
      })
      .join('');

  busca.value = params.get('q') || '';
  colecao.value = params.get('colecao') || '';
  ordem.value = params.get('ordem') || 'relevancia';
  if (dietasIniciais.length || colecao.value || ordem.value !== 'relevancia') form.querySelector('details').open = true;

  function normalize(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  }

  function estado() {
    return {
      q: busca.value.trim(),
      intensidade: (form.querySelector('input[name="intensidade"]:checked') || {}).value || 'todas',
      dietas: Array.prototype.map.call(form.querySelectorAll('input[name="dieta"]:checked'), function (i) {
        return i.value;
      }),
      colecao: colecao.value,
      ordem: ordem.value,
    };
  }

  function filtrar(f) {
    var termos = normalize(f.q).split(/\s+/).filter(Boolean);
    var result = DATA.produtos.filter(function (p) {
      if (f.intensidade !== 'todas' && p.intensidades.indexOf(f.intensidade) === -1) return false;
      if (f.colecao && p.colecoes.indexOf(f.colecao) === -1) return false;
      for (var i = 0; i < f.dietas.length; i++) if (p.dietas.indexOf(f.dietas[i]) === -1) return false;
      if (termos.length) {
        var texto = normalize(
          [p.nome, p.resumo, p.categoria, p.teor, p.selo].concat(p.dietas.map(SC.ui.dietaNome)).join(' ')
        );
        for (var t = 0; t < termos.length; t++) if (texto.indexOf(termos[t]) === -1) return false;
      }
      return true;
    });
    var favs = SC.favoritos.list();
    var sorters = {
      'menor-preco': function (a, b) {
        return a.preco - b.preco;
      },
      'maior-preco': function (a, b) {
        return b.preco - a.preco;
      },
      avaliacao: function (a, b) {
        return b.nota - a.nota || b.avaliacoes - a.avaliacoes;
      },
      favoritos: function (a, b) {
        return (favs.indexOf(b.id) !== -1) - (favs.indexOf(a.id) !== -1);
      },
    };
    if (sorters[f.ordem]) result.sort(sorters[f.ordem]);
    return result;
  }

  function syncUrl(f) {
    var url = new URL(location.href);
    url.search = '';
    if (f.q) url.searchParams.set('q', f.q);
    if (f.intensidade !== 'todas') url.searchParams.set('intensidade', f.intensidade);
    if (f.dietas.length) url.searchParams.set('dietas', f.dietas.join(','));
    if (f.colecao) url.searchParams.set('colecao', f.colecao);
    if (f.ordem !== 'relevancia') url.searchParams.set('ordem', f.ordem);
    history.replaceState(null, '', url);
  }

  var statusTimer = null;
  function render() {
    var f = estado();
    var produtos = filtrar(f);
    lista.innerHTML = produtos
      .map(function (p) {
        return '<li class="flex">' + SC.ui.productCard(p, 'w-full') + '</li>';
      })
      .join('');
    vazio.hidden = produtos.length > 0;
    syncUrl(f);
    // Atraso curto para não anunciar a cada tecla digitada.
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () {
      status.textContent =
        produtos.length === 0
          ? 'Nenhum chocolate encontrado'
          : produtos.length === 1
            ? '1 chocolate encontrado'
            : produtos.length + ' chocolates encontrados';
    }, 400);
  }

  function limpar() {
    busca.value = '';
    colecao.value = '';
    ordem.value = 'relevancia';
    form.querySelector('input[name="intensidade"][value="todas"]').checked = true;
    form.querySelectorAll('input[name="dieta"]').forEach(function (i) {
      i.checked = false;
    });
    render();
    busca.focus();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    render();
  });
  form.addEventListener('input', render);
  form.addEventListener('change', render);
  document.getElementById('limpar-filtros').addEventListener('click', limpar);
  vazio.querySelector('[data-limpar]').addEventListener('click', limpar);

  render();
})();
