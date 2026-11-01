// Passaporte: níveis (abas acessíveis), experiências com agendamento e boutiques.
(function () {
  var SC = window.SantoCacau;
  var DATA = window.SC_DATA;
  var util = SC.util;
  var esc = util.esc;
  var icon = util.icon;
  var ui = SC.ui;

  /* ---------- Chamada conforme login ---------- */

  function renderCta() {
    var user = SC.auth.current();
    var cta = document.getElementById('cta-passaporte');
    if (user) {
      var n = SC.nivel(user.graosTotal);
      cta.innerHTML =
        '<p class="w-full text-body-md">Você é <strong class="text-ouro">' + esc(n.atual.nome) + '</strong> e tem <strong class="text-ouro">' + user.graos + ' Grãos</strong> disponíveis.</p>' +
        '<a href="' + SC.url('dashboard', null, 'recompensas') + '" class="btn tap px-5 rounded-full bg-ouro text-on-ouro text-label-lg flex items-center gap-2">' + icon('redeem') + 'Resgatar recompensas</a>';
    } else {
      cta.innerHTML =
        '<a href="' + SC.url('login', { next: location.pathname }, 'cadastro') + '" class="btn tap px-5 rounded-full bg-ouro text-on-ouro text-label-lg flex items-center gap-2">' + icon('person_add') + 'Quero participar</a>' +
        '<a href="' + SC.url('login', { next: location.pathname }) + '" class="btn tap px-5 rounded-full border-2 border-on-cacau text-on-cacau text-label-lg flex items-center gap-2">' + icon('login') + 'Já tenho conta</a>';
    }
  }

  /* ---------- Abas de níveis ---------- */

  var abas = document.getElementById('niveis-abas');
  var paineis = document.getElementById('niveis-paineis');
  var user = SC.auth.current();
  var atual = user ? SC.nivel(user.graosTotal).atual.id : 'bronze';
  var nivelFiltro = atual;

  abas.innerHTML = DATA.niveis
    .map(function (n) {
      var sel = n.id === atual;
      return (
        '<button type="button" role="tab" id="aba-' + n.id + '" aria-controls="painel-' + n.id + '" aria-selected="' + sel + '" tabindex="' + (sel ? 0 : -1) + '" ' +
        'class="tap shrink-0 px-4 rounded-full text-label-lg flex items-center gap-1.5 border border-outline-variant bg-surface-container aria-selected:bg-primary aria-selected:text-on-primary aria-selected:border-primary">' +
        icon(n.icone, 'text-[1.125rem]') + n.nome.replace('Cacau ', '') + '</button>'
      );
    })
    .join('');

  paineis.innerHTML = DATA.niveis
    .map(function (n) {
      return (
        '<div role="tabpanel" id="painel-' + n.id + '" aria-labelledby="aba-' + n.id + '" tabindex="0"' + (n.id === atual ? '' : ' hidden') +
        ' class="card rounded-xl p-5 bg-surface-container shadow-sm flex flex-col gap-2">' +
        '<div class="flex flex-wrap items-center justify-between gap-2"><h3 class="font-titulo text-headline-md flex items-center gap-2">' + icon(n.icone, 'text-secondary') + esc(n.nome) + '</h3>' +
        '<span class="text-label-sm px-3 py-1 rounded-full bg-surface-container-highest">' + esc(n.faixa) + '</span></div>' +
        '<p class="text-body-md text-on-surface-variant">' + esc(n.descricao) + '</p>' +
        '<p class="text-label-md text-secondary flex items-center gap-1">' + icon('verified', 'text-[1.125rem]') + esc(n.destaque) + '</p>' +
        (user && n.id === atual ? '<p class="text-label-md text-sucesso">Este é o seu nível atual.</p>' : '') +
        '</div>'
      );
    })
    .join('');

  var tabs = Array.prototype.slice.call(abas.querySelectorAll('[role="tab"]'));
  function selecionar(tab, foco) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    nivelFiltro = tab.id.replace('aba-', '');
    renderExperiencias();
    if (foco) {
      tab.focus();
      tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () {
      selecionar(tab);
    });
    tab.addEventListener('keydown', function (e) {
      var alvo = null;
      if (e.key === 'ArrowRight') alvo = tabs[(i + 1) % tabs.length];
      if (e.key === 'ArrowLeft') alvo = tabs[(i - 1 + tabs.length) % tabs.length];
      if (e.key === 'Home') alvo = tabs[0];
      if (e.key === 'End') alvo = tabs[tabs.length - 1];
      if (alvo) {
        e.preventDefault();
        selecionar(alvo, true);
      }
    });
  });

  /* ---------- Experiências ---------- */

  // As abas de nível também filtram as experiências: mostra as que o nível
  // escolhido já libera (nível mínimo igual ou abaixo dele).
  var filtroCheck = document.getElementById('exp-filtrar');
  filtroCheck.addEventListener('change', renderExperiencias);

  function renderExperiencias() {
    var u = SC.auth.current();
    var nivelUser = u ? SC.nivel(u.graosTotal).indice : -1;
    var nivel = DATA.niveis[SC.nivelIndice(nivelFiltro)];
    var filtrar = filtroCheck.checked;
    var lista = DATA.experiencias.filter(function (x) {
      return !filtrar || SC.nivelIndice(x.nivelMin) <= SC.nivelIndice(nivelFiltro);
    });
    var n = lista.length === 1 ? '1 experiência' : lista.length + ' experiências';
    document.getElementById('exp-status').textContent = filtrar
      ? n + ' para o nível ' + nivel.nome + '.'
      : 'Mostrando todas: ' + n + '.';
    document.getElementById('lista-experiencias').innerHTML = lista
      .map(function (x) {
        var nivelOk = u && nivelUser >= SC.nivelIndice(x.nivelMin);
        var saldoOk = u && u.graos >= x.graos;
        var motivo = !u ? 'Entre na sua conta para agendar.' : !nivelOk ? 'Disponível a partir do nível ' + DATA.niveis[SC.nivelIndice(x.nivelMin)].nome + '.' : !saldoOk ? 'Você precisa de ' + x.graos + ' Grãos.' : '';
        return (
          '<li class="card rounded-xl bg-surface-container overflow-hidden shadow-sm flex flex-col">' +
          '<div class="relative h-40"><img src="' + SC.asset(x.img) + '" alt="' + esc(x.alt) + '" loading="lazy" class="w-full h-full object-cover" />' +
          '<span class="absolute top-2 right-2 px-2.5 py-0.5 rounded-full bg-cacau text-on-cacau text-label-sm">' + esc(x.duracao) + '</span></div>' +
          '<div class="p-4 flex flex-col gap-2 flex-1">' +
          '<h3 class="text-title-lg">' + esc(x.nome) + '</h3>' +
          '<p class="text-body-sm text-on-surface-variant">' + esc(x.descricao) + '</p>' +
          '<p class="text-label-md text-secondary">' + esc(x.publico) + (x.graos ? ' • ' + x.graos + ' Grãos' : ' • Cortesia') + '</p>' +
          '<div class="mt-auto pt-2">' +
          (motivo
            ? (u ? '' : '<a href="' + SC.url('login', { next: location.pathname }) + '" class="btn tap w-full px-4 rounded-full border-2 border-primary text-label-lg flex items-center justify-center">Entrar para agendar</a>') +
              (u ? '<p class="text-body-sm text-on-surface-variant flex items-center gap-1">' + icon('lock', 'text-[1rem]') + esc(motivo) + '</p>' : '')
            : '<button type="button" data-agendar="' + x.id + '" class="btn tap w-full px-4 rounded-full bg-primary text-on-primary text-label-lg flex items-center justify-center gap-2">' + icon('event') + 'Agendar<span class="sr-only"> ' + esc(x.nome) + '</span></button>') +
          '</div></div></li>'
        );
      })
      .join('');
  }

  function agendar(x, opener) {
    var hoje = new Date();
    hoje.setDate(hoje.getDate() + 1);
    var min = hoje.toISOString().slice(0, 10);
    var dialog = document.createElement('dialog');
    dialog.setAttribute('aria-labelledby', 'ag-titulo');
    dialog.innerHTML =
      '<form novalidate class="p-6 flex flex-col gap-4">' +
      '<h2 id="ag-titulo" class="font-titulo text-headline-md">Agendar: ' + esc(x.nome) + '</h2>' +
      '<div><label for="ag-boutique" class="block text-label-lg mb-1">Boutique</label><select id="ag-boutique" class="campo">' +
      DATA.boutiques.map(function (b) { return '<option value="' + b.id + '">' + esc(b.nome) + '</option>'; }).join('') + '</select></div>' +
      '<div class="grid grid-cols-2 gap-3"><div><label for="ag-data" class="block text-label-lg mb-1">Data</label><input id="ag-data" type="date" min="' + min + '" class="campo" /></div>' +
      '<div><label for="ag-hora" class="block text-label-lg mb-1">Horário</label><select id="ag-hora" class="campo"><option>11:00</option><option>15:00</option><option>17:30</option></select></div></div>' +
      '<div><label for="ag-necessidades" class="block text-label-lg mb-1">Precisa de algum recurso de acessibilidade? (opcional)</label>' +
      '<textarea id="ag-necessidades" rows="2" maxlength="200" class="campo" placeholder="Ex.: intérprete de Libras, cadeira de rodas, cardápio em braille"></textarea></div>' +
      (x.graos ? '<p class="text-body-md">Serão usados <strong>' + x.graos + ' Grãos</strong> do seu saldo.</p>' : '<p class="text-body-md">Cortesia do seu nível.</p>') +
      '<div class="flex gap-2 justify-end"><button type="button" data-fechar class="btn tap px-5 rounded-full bg-surface-container-high">Cancelar</button>' +
      '<button class="btn tap px-5 rounded-full bg-primary text-on-primary text-label-lg">Confirmar</button></div></form>';
    document.body.appendChild(dialog);
    var form = dialog.querySelector('form');
    dialog.querySelector('[data-fechar]').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('close', function () {
      dialog.remove();
      if (opener && document.body.contains(opener)) opener.focus();
      else document.getElementById('experiencias').focus();
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = document.getElementById('ag-data');
      var dia = data.value ? new Date(data.value + 'T12:00').getDay() : -1;
      if (!ui.form.validate(form, [[data, !data.value ? 'Escolha uma data.' : data.value < min ? 'Escolha a partir de amanhã.' : null]])) return;
      var u = SC.auth.current();
      var boutique = DATA.boutiques.filter(function (b) { return b.id === document.getElementById('ag-boutique').value; })[0];
      var ag = {
        id: util.id('A'),
        experiencia: x.id,
        nome: x.nome,
        boutique: boutique.nome,
        data: data.value,
        hora: document.getElementById('ag-hora').value,
        necessidades: document.getElementById('ag-necessidades').value.trim(),
        graos: x.graos,
      };
      SC.auth.update({ agendamentos: [ag].concat(u.agendamentos || []) });
      if (x.graos) SC.auth.addGraos(-x.graos, 'Agendamento: ' + x.nome, 'event');
      dialog.close();
      renderExperiencias();
      renderCta();
      ui.toast('Agendado para ' + util.date(ag.data + 'T12:00') + ' às ' + ag.hora + (dia === 0 ? ' (domingo)' : '') + '. Veja em Minha conta.');
    });
    dialog.showModal();
  }

  document.getElementById('lista-experiencias').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-agendar]');
    if (!btn) return;
    var x = DATA.experiencias.filter(function (i) { return i.id === btn.getAttribute('data-agendar'); })[0];
    agendar(x, btn);
  });

  /* ---------- Boutiques ---------- */

  document.getElementById('lista-boutiques').innerHTML = DATA.boutiques
    .map(function (b) {
      return (
        '<li class="card rounded-xl bg-surface-container-low p-4 flex flex-col gap-2">' +
        '<h3 class="text-title-lg flex items-center gap-2">' + icon('pin_drop', 'text-secondary') + esc(b.nome) + '</h3>' +
        '<p class="text-body-md">' + esc(b.endereco) + '</p>' +
        '<p class="text-body-sm text-on-surface-variant flex items-start gap-1">' + icon('schedule', 'text-[1.125rem]') + esc(b.horario) + '</p>' +
        '<p class="text-body-sm text-on-surface-variant flex items-start gap-1">' + icon('accessible', 'text-[1.125rem] text-secondary') + '<span><strong class="text-on-surface">Acessibilidade:</strong> ' + esc(b.acessibilidade) + '</span></p>' +
        '<a href="' + b.mapa + '" target="_blank" rel="noopener" class="mt-auto self-start tap text-label-lg text-secondary underline underline-offset-2 flex items-center gap-1">' +
        icon('map') + 'Ver no mapa<span class="sr-only"> (' + esc(b.nome) + ', abre em nova janela)</span></a></li>'
      );
    })
    .join('');

  renderCta();
  renderExperiencias();
  SC.events.on('auth', function () {
    renderCta();
    renderExperiencias();
  });
})();
