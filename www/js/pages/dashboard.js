// Minha conta: Passaporte, pedidos, recompensas, dados pessoais e privacidade (LGPD).
(function () {
  var SC = window.SantoCacau;
  var DATA = window.SC_DATA;
  var util = SC.util;
  var esc = util.esc;
  var icon = util.icon;
  var ui = SC.ui;
  var root = document.getElementById('conta');

  if (!ui.requireLogin()) return;

  function saudacao() {
    var h = new Date().getHours();
    return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  }

  function card(id, titulo, iconName, conteudo, extra) {
    return (
      '<section id="' + id + '" aria-labelledby="' + id + '-titulo" tabindex="-1" class="flex flex-col gap-3">' +
      '<div class="flex items-center justify-between gap-2"><h2 id="' + id + '-titulo" class="font-titulo text-headline-md flex items-center gap-2">' +
      icon(iconName, 'text-secondary') + titulo + '</h2>' + (extra || '') + '</div>' + conteudo + '</section>'
    );
  }

  // QR ilustrativo + código legível (alternativa em texto).
  function qrSvg(code) {
    var cells = '';
    var seed = 0;
    for (var c = 0; c < code.length; c++) seed = (seed * 31 + code.charCodeAt(c)) >>> 0;
    for (var y = 0; y < 21; y++) {
      for (var x = 0; x < 21; x++) {
        var finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
        if (finder) {
          var fx = x > 13 ? x - 14 : x;
          var fy = y > 13 ? y - 14 : y;
          var on = fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4);
          if (on) cells += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
        } else {
          seed = (seed * 1103515245 + 12345) >>> 0;
          if ((seed >> 16) & 1) cells += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
        }
      }
    }
    return '<svg viewBox="-1 -1 23 23" class="w-40 h-40 bg-white text-black" fill="currentColor" role="img" aria-label="QR Code do Passaporte. Código ' + code + '">' + cells + '</svg>';
  }

  function passaporte(u) {
    var n = SC.nivel(u.graosTotal);
    var code = 'SC-VIP-' + u.id.slice(-6);
    var pct = Math.round(n.progresso * 100);
    return (
      '<section aria-labelledby="passaporte-titulo" class="card relative overflow-hidden rounded-2xl bg-cacau text-on-cacau p-5 md:p-6 shadow-xl flex flex-col gap-4">' +
      '<div class="flex justify-between items-start gap-3">' +
      '<div><h2 id="passaporte-titulo" class="text-label-md uppercase tracking-wider text-ouro flex items-center gap-1">' + icon(n.atual.icone, 'icon-fill text-[1.125rem]') + 'Nível ' + esc(n.atual.nome) + '</h2>' +
      '<p class="font-titulo text-headline-xl">' + u.graos + ' <span class="text-label-lg font-normal text-ouro">Grãos disponíveis</span></p></div>' +
      '<button type="button" id="qr-btn" aria-expanded="false" aria-controls="qr-painel" class="btn tap bg-ouro text-on-ouro px-3 py-2 rounded-lg flex flex-col items-center text-label-sm">' + icon('qr_code_2') + 'Boutique</button>' +
      '</div>' +
      (n.proximo
        ? '<div><div class="flex justify-between text-label-sm text-on-cacau-muted mb-1"><span>Rumo ao ' + esc(n.proximo.nome) + '</span><span class="text-ouro">Faltam ' + n.faltam + ' Grãos</span></div>' +
          '<div role="progressbar" aria-label="Progresso para o ' + esc(n.proximo.nome) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-valuetext="' + pct + '%, faltam ' + n.faltam + ' Grãos" class="w-full h-3 rounded-full bg-on-cacau/20 overflow-hidden">' +
          '<div class="h-full rounded-full bg-ouro" style="width:' + pct + '%"></div></div></div>'
        : '<p class="text-label-lg text-ouro">Você está no nível máximo. Obrigado por fazer parte!</p>') +
      '<div id="qr-painel" hidden class="rounded-xl bg-surface-container-lowest text-on-surface p-4 flex flex-col items-center gap-2 text-center">' +
      '<p class="text-label-lg">Apresente no caixa da boutique</p>' + qrSvg(code) +
      '<p class="text-title-md font-mono">' + code + '</p><p class="text-body-sm text-on-surface-variant">Se a leitura falhar, informe este código ao atendente.</p></div>' +
      '<p class="text-label-sm text-on-cacau-muted flex items-center gap-1">' + icon('verified', 'text-[1rem]') + 'Passaporte ativo • ' + u.graosTotal + ' Grãos acumulados desde ' + util.date(u.criadoEm, { month: 'long', year: 'numeric' }) + '</p>' +
      '</section>'
    );
  }

  function pedidosHtml(u) {
    var lista = SC.orders.list(u.id);
    if (!lista.length) {
      return '<p class="card rounded-xl bg-surface-container-low p-4 text-body-md">Você ainda não fez pedidos. <a class="underline text-secondary font-semibold" href="' + SC.url('catalogo') + '">Conheça nossos chocolates</a>.</p>';
    }
    return (
      '<ul class="flex flex-col gap-2">' +
      lista
        .map(function (o) {
          var qtd = o.itens.reduce(function (n, i) { return n + i.qtd; }, 0);
          return (
            '<li><a href="' + SC.url('pedido', { id: o.id }) + '" class="card rounded-xl bg-surface-container-lowest shadow-sm p-4 flex items-center gap-3 hover:bg-surface-container-low">' +
            '<span class="w-10 h-10 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shrink-0">' + icon('receipt_long') + '</span>' +
            '<span class="flex-1 min-w-0"><span class="block text-title-md">Pedido #' + esc(o.id) + '</span>' +
            '<span class="block text-body-sm text-on-surface-variant">' + util.dateTime(o.criadoEm) + ' • ' + qtd + (qtd === 1 ? ' item' : ' itens') + ' • ' + esc(SC.orders.statusLabel(o.status)) + '</span></span>' +
            '<span class="text-label-lg">' + util.money(o.valores.total) + '</span>' + icon('chevron_right', 'text-on-surface-variant') + '</a></li>'
          );
        })
        .join('') +
      '</ul>'
    );
  }

  function recompensasHtml(u) {
    return (
      '<ul class="grid gap-3 md:grid-cols-3">' +
      DATA.recompensas
        .map(function (r) {
          var pode = u.graos >= r.graos;
          return (
            '<li class="card rounded-xl bg-surface-container-lowest shadow-sm p-4 flex flex-col gap-3">' +
            '<div class="flex gap-3 items-center"><img src="' + SC.asset(r.img) + '" alt="" class="w-16 h-16 rounded-lg object-cover shrink-0" />' +
            '<div class="min-w-0"><p class="text-label-sm text-secondary">' + r.graos + ' Grãos</p><h3 class="text-title-md">' + esc(r.nome) + '</h3>' +
            '<p class="text-body-sm text-on-surface-variant">' + esc(r.descricao) + '</p></div></div>' +
            '<div class="flex items-center justify-between gap-2 mt-auto">' +
            '<p class="text-label-sm flex items-center gap-1 ' + (pode ? 'text-sucesso' : 'text-on-surface-variant') + '">' + icon(pode ? 'check_circle' : 'hourglass_empty', 'text-[1rem]') +
            (pode ? 'Saldo suficiente' : 'Faltam ' + (r.graos - u.graos) + ' Grãos') + '</p>' +
            '<button type="button" data-resgatar="' + r.id + '" class="btn tap px-4 rounded-full bg-primary text-on-primary text-label-lg disabled:opacity-40 disabled:cursor-not-allowed"' + (pode ? '' : ' disabled') + '>Resgatar<span class="sr-only"> ' + esc(r.nome) + '</span></button>' +
            '</div></li>'
          );
        })
        .join('') +
      '</ul>' +
      (u.resgates && u.resgates.length
        ? '<h3 class="text-title-md mt-2">Seus resgates</h3><ul class="flex flex-col gap-2">' +
          u.resgates.map(function (r) {
            return '<li class="rounded-lg bg-surface-container-low p-3 text-body-md flex flex-wrap justify-between gap-2"><span>' + esc(r.nome) + ' • ' + util.date(r.data) + '</span><span class="font-mono font-semibold">Código ' + esc(r.codigo) + '</span></li>';
          }).join('') + '</ul>'
        : '')
    );
  }

  function agendamentosHtml(u) {
    if (!u.agendamentos || !u.agendamentos.length) {
      return '<p class="card rounded-xl bg-surface-container-low p-4 text-body-md">Nenhuma experiência agendada. <a class="underline text-secondary font-semibold" href="' + SC.url('passaporte', null, 'experiencias') + '">Ver experiências nas boutiques</a>.</p>';
    }
    return (
      '<ul class="flex flex-col gap-2">' +
      u.agendamentos
        .map(function (a) {
          var d = new Date(a.data + 'T' + a.hora);
          return (
            '<li class="card rounded-xl bg-surface-container-lowest shadow-sm p-4 flex items-start gap-3">' +
            '<span class="bg-primary text-on-primary rounded-lg p-2 text-center min-w-[3.5rem]"><span class="block text-label-sm uppercase">' + d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') + '</span><span class="block text-title-lg">' + d.getDate() + '</span></span>' +
            '<span class="flex-1"><span class="block text-title-md">' + esc(a.nome) + '</span>' +
            '<span class="block text-body-sm text-on-surface-variant">' + util.date(a.data + 'T12:00') + ', ' + esc(a.hora) + ' • ' + esc(a.boutique) + '</span>' +
            (a.necessidades ? '<span class="block text-body-sm text-on-surface-variant">Acessibilidade solicitada: ' + esc(a.necessidades) + '</span>' : '') + '</span>' +
            '<button type="button" data-cancelar-agendamento="' + esc(a.id) + '" class="tap text-label-md text-error underline">Cancelar<span class="sr-only"> ' + esc(a.nome) + '</span></button></li>'
          );
        })
        .join('') +
      '</ul>'
    );
  }

  function extratoHtml(u) {
    var itens = (u.extrato || []).slice(0, 8);
    return (
      '<ul class="card rounded-xl bg-surface-container-lowest shadow-sm divide-y divide-outline-variant/60">' +
      itens
        .map(function (e) {
          var pos = e.graos > 0;
          return (
            '<li class="p-4 flex items-center gap-3"><span class="w-10 h-10 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shrink-0">' + icon(e.icone || 'savings') + '</span>' +
            '<span class="flex-1"><span class="block text-title-md">' + esc(e.descricao) + '</span><span class="block text-body-sm text-on-surface-variant">' + util.dateTime(e.data) + '</span></span>' +
            '<span class="text-title-md font-bold ' + (pos ? 'text-sucesso' : 'text-error') + '">' + (pos ? '+' : '−') + Math.abs(e.graos) + ' <span class="sr-only">Grãos ' + (pos ? 'recebidos' : 'usados') + '</span><span aria-hidden="true">grãos</span></span></li>'
          );
        })
        .join('') +
      '</ul>'
    );
  }

  function dadosHtml(u) {
    var dietas = DATA.dietas
      .map(function (d) {
        var on = u.preferencias && u.preferencias.dietas.indexOf(d.id) !== -1;
        return '<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="dieta" value="' + d.id + '"' + (on ? ' checked' : '') + ' /><span class="text-body-md">' + esc(d.nome) + '</span></label>';
      })
      .join('');
    return (
      '<form id="form-dados" novalidate class="card rounded-xl bg-surface-container-lowest shadow-sm p-4 md:p-6 grid gap-4 md:grid-cols-2">' +
      '<div><label for="d-nome" class="block text-label-lg mb-1">Nome completo</label><input id="d-nome" class="campo" autocomplete="name" value="' + esc(u.nome) + '" /></div>' +
      '<div><label for="d-telefone" class="block text-label-lg mb-1">Celular</label><input id="d-telefone" type="tel" class="campo" autocomplete="tel-national" value="' + esc(util.maskPhone(u.telefone)) + '" /></div>' +
      '<div><label for="d-email" class="block text-label-lg mb-1">E-mail</label><input id="d-email" class="campo" value="' + esc(u.email) + '" readonly aria-describedby="d-email-dica" /><p id="d-email-dica" class="text-body-sm text-on-surface-variant mt-1">Para alterar o e-mail ou o CPF, fale com o atendimento.</p></div>' +
      '<div><label for="d-cpf" class="block text-label-lg mb-1">CPF</label><input id="d-cpf" class="campo" value="' + esc(util.maskCPF(u.cpf)) + '" readonly /></div>' +
      '<fieldset class="md:col-span-2"><legend class="text-label-lg mb-2">Perfil de paladar e restrições</legend><div class="flex flex-wrap gap-x-6 gap-y-2">' + dietas + '</div></fieldset>' +
      '<div class="md:col-span-2 flex flex-wrap gap-2"><button class="btn tap px-5 rounded-full bg-primary text-on-primary text-label-lg">Salvar alterações</button>' +
      '<button type="button" id="trocar-senha" class="btn tap px-5 rounded-full border-2 border-primary text-on-surface text-label-lg">Trocar senha</button></div>' +
      '</form>'
    );
  }

  function privacidadeHtml(u) {
    var mkt = u.consentimentos && u.consentimentos.marketing && u.consentimentos.marketing.aceito;
    return (
      '<div class="card rounded-xl bg-surface-container-lowest shadow-sm p-4 md:p-6 flex flex-col gap-4">' +
      '<p class="text-body-md text-on-surface-variant">Pela Lei Geral de Proteção de Dados (LGPD), você pode acessar, corrigir, levar seus dados para outro serviço, revogar consentimentos e pedir a exclusão a qualquer momento. ' +
      'Dúvidas: <a class="underline text-secondary font-semibold" data-empresa="encarregadoEmail" data-empresa-link="mailto" href="#"></a>.</p>' +
      '<div class="flex items-start justify-between gap-4 py-2 border-y border-outline-variant/60">' +
      '<span class="flex flex-col"><span id="mkt-nome" class="text-label-lg">Receber novidades e ofertas</span><span id="mkt-desc" class="text-body-sm text-on-surface-variant">E-mail e WhatsApp sobre lançamentos e eventos. ' +
      (u.consentimentos && u.consentimentos.marketing ? 'Última alteração: ' + util.dateTime(u.consentimentos.marketing.data) + '.' : '') + '</span></span>' +
      '<button type="button" role="switch" id="mkt-switch" class="switch mt-1" aria-checked="' + !!mkt + '" aria-labelledby="mkt-nome" aria-describedby="mkt-desc"></button></div>' +
      '<div class="grid gap-2 sm:grid-cols-2">' +
      '<button type="button" id="exportar" class="btn tap px-4 rounded-full border-2 border-primary text-on-surface text-label-lg flex items-center justify-center gap-2">' + icon('download') + 'Baixar meus dados</button>' +
      '<button type="button" data-abrir-cookies class="btn tap px-4 rounded-full border-2 border-primary text-on-surface text-label-lg flex items-center justify-center gap-2">' + icon('cookie') + 'Preferências de cookies</button>' +
      '<button type="button" data-abrir-a11y class="btn tap px-4 rounded-full border-2 border-primary text-on-surface text-label-lg flex items-center justify-center gap-2">' + icon('accessibility_new') + 'Preferências de acessibilidade</button>' +
      '<a href="' + SC.url('privacidade') + '" class="btn tap px-4 rounded-full border-2 border-primary text-on-surface text-label-lg flex items-center justify-center gap-2">' + icon('policy') + 'Política de privacidade</a>' +
      '</div>' +
      '<div class="grid gap-2 sm:grid-cols-2 pt-2 border-t border-outline-variant/60">' +
      '<button type="button" id="sair" class="btn tap px-4 rounded-full bg-surface-container-high text-on-surface text-label-lg flex items-center justify-center gap-2">' + icon('logout') + 'Sair da conta</button>' +
      '<button type="button" id="excluir" class="btn tap px-4 rounded-full bg-error text-on-error text-label-lg flex items-center justify-center gap-2">' + icon('delete_forever') + 'Excluir minha conta</button>' +
      '</div></div>'
    );
  }

  function render() {
    var u = SC.auth.current();
    if (!u) return ui.requireLogin();
    var primeiro = u.nome.split(' ')[0];
    var nav = [
      ['pedidos', 'Pedidos', 'receipt_long'],
      ['recompensas', 'Recompensas', 'redeem'],
      ['agenda', 'Experiências', 'calendar_month'],
      ['dados', 'Meus dados', 'badge'],
      ['privacidade', 'Privacidade', 'shield_person'],
    ];
    root.innerHTML =
      '<header class="pt-2 flex items-center justify-between gap-3">' +
      '<div><p class="text-label-md text-on-surface-variant">' + saudacao() + '</p><h1 class="font-titulo text-headline-xl">Olá, ' + esc(primeiro) + '</h1></div>' +
      '</header>' +
      '<div class="mt-4 grid gap-6 lg:grid-cols-[22rem_1fr] lg:items-start">' +
      '<div class="flex flex-col gap-4 lg:sticky lg:top-28">' + passaporte(u) +
      '<nav aria-label="Seções da conta"><ul class="grid grid-cols-3 lg:grid-cols-1 gap-2">' +
      nav.map(function (n) {
        return '<li><a href="#' + n[0] + '" class="card tap h-full rounded-xl bg-surface-container-low p-3 flex flex-col lg:flex-row items-center gap-1 lg:gap-3 text-center lg:text-left text-label-md hover:bg-surface-container">' + icon(n[2], 'text-secondary') + n[1] + '</a></li>';
      }).join('') +
      '</ul></nav></div>' +
      '<div class="flex flex-col gap-8">' +
      card('pedidos', 'Meus pedidos', 'receipt_long', pedidosHtml(u)) +
      card('recompensas', 'Resgate de recompensas', 'award_star', recompensasHtml(u)) +
      card('agenda', 'Experiências agendadas', 'calendar_month', agendamentosHtml(u)) +
      card('extrato', 'Extrato de Grãos', 'history', extratoHtml(u)) +
      card('dados', 'Meus dados', 'badge', dadosHtml(u)) +
      card('privacidade', 'Privacidade e dados (LGPD)', 'shield_person', privacidadeHtml(u)) +
      '</div></div>';
    ui.fillEmpresa(root);
    ui.form.mask(document.getElementById('d-telefone'), util.maskPhone);
  }

  /* ---------- Ações ---------- */

  function baixarDados() {
    var dados = SC.auth.exportData();
    var json = JSON.stringify(dados, null, 2);
    var dialog = document.createElement('dialog');
    dialog.setAttribute('aria-labelledby', 'exp-titulo');
    dialog.innerHTML =
      '<div class="p-6 flex flex-col gap-3"><h2 id="exp-titulo" class="font-titulo text-headline-md">Seus dados</h2>' +
      '<p class="text-body-sm text-on-surface-variant">Cópia de todos os dados que guardamos sobre você, em formato JSON (legível por outros sistemas).</p>' +
      '<label for="exp-json" class="text-label-lg">Conteúdo</label><textarea id="exp-json" readonly rows="10" class="campo font-mono text-body-sm"></textarea>' +
      '<div class="flex flex-wrap gap-2 justify-end"><button type="button" data-fechar class="btn tap px-5 rounded-full bg-surface-container-high">Fechar</button>' +
      '<button type="button" data-copiar class="btn tap px-5 rounded-full border-2 border-primary">Copiar</button>' +
      '<button type="button" data-baixar class="btn tap px-5 rounded-full bg-primary text-on-primary">Baixar arquivo</button></div></div>';
    document.body.appendChild(dialog);
    dialog.querySelector('#exp-json').value = json;
    var opener = document.activeElement;
    dialog.addEventListener('click', function (e) {
      if (e.target.closest('[data-fechar]')) dialog.close();
      if (e.target.closest('[data-copiar]')) {
        var ta = dialog.querySelector('#exp-json');
        ta.select();
        document.execCommand('copy');
        ui.toast('Dados copiados.');
      }
      if (e.target.closest('[data-baixar]')) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        a.download = 'meus-dados-santo-cacau.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        ui.toast('Arquivo meus-dados-santo-cacau.json gerado.');
      }
    });
    dialog.addEventListener('close', function () {
      dialog.remove();
      if (opener) opener.focus();
    });
    dialog.showModal();
  }

  function trocarSenha() {
    var dialog = document.createElement('dialog');
    dialog.setAttribute('aria-labelledby', 'ts-titulo');
    dialog.innerHTML =
      '<form novalidate class="p-6 flex flex-col gap-4"><h2 id="ts-titulo" class="font-titulo text-headline-md">Trocar senha</h2>' +
      '<div><label for="ts-atual" class="block text-label-lg mb-1">Senha atual</label><input id="ts-atual" type="password" class="campo" autocomplete="current-password" /></div>' +
      '<div><label for="ts-nova" class="block text-label-lg mb-1">Nova senha</label><input id="ts-nova" type="password" class="campo" autocomplete="new-password" aria-describedby="ts-dica" />' +
      '<p id="ts-dica" class="text-body-sm text-on-surface-variant mt-1">Mínimo de 8 caracteres, com letras e números.</p></div>' +
      '<div class="flex gap-2 justify-end"><button type="button" data-fechar class="btn tap px-5 rounded-full bg-surface-container-high">Cancelar</button>' +
      '<button class="btn tap px-5 rounded-full bg-primary text-on-primary">Salvar</button></div></form>';
    document.body.appendChild(dialog);
    var form = dialog.querySelector('form');
    dialog.querySelector('[data-fechar]').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('close', function () {
      dialog.remove();
      var b = document.getElementById('trocar-senha');
      if (b) b.focus();
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var atual = document.getElementById('ts-atual');
      var nova = document.getElementById('ts-nova');
      var forte = nova.value.length >= 8 && /\d/.test(nova.value) && /[A-Za-zÀ-ÿ]/.test(nova.value);
      if (!ui.form.validate(form, [[atual, !atual.value ? 'Informe a senha atual.' : null], [nova, !forte ? 'A nova senha precisa de 8 caracteres, com letras e números.' : null]])) return;
      SC.auth.changePassword(atual.value, nova.value).then(
        function () {
          dialog.close();
          ui.toast('Senha alterada com sucesso.');
        },
        function (err) {
          ui.form.validate(form, [[atual, err.message]]);
        }
      );
    });
    dialog.showModal();
  }

  function agendarFoco(id) {
    var el = document.getElementById(id);
    if (el) el.focus();
  }

  root.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('#qr-btn')) {
      var btn = t.closest('#qr-btn');
      var painel = document.getElementById('qr-painel');
      painel.hidden = !painel.hidden;
      btn.setAttribute('aria-expanded', String(!painel.hidden));
      return;
    }
    var resgatar = t.closest('[data-resgatar]');
    if (resgatar) {
      var rec = DATA.recompensas.filter(function (r) { return r.id === resgatar.getAttribute('data-resgatar'); })[0];
      ui.confirm({ titulo: 'Confirmar resgate', mensagem: 'Trocar ' + rec.graos + ' Grãos por ' + rec.nome + '?', confirmar: 'Resgatar' }).then(function (ok) {
        if (!ok) return;
        var u = SC.auth.current();
        if (u.graos < rec.graos) return ui.toast('Saldo insuficiente.', 'erro');
        var codigo = 'R' + util.id().slice(-6);
        SC.auth.update({ resgates: [{ id: rec.id, nome: rec.nome, data: new Date().toISOString(), codigo: codigo }].concat(u.resgates || []) });
        SC.auth.addGraos(-rec.graos, 'Resgate: ' + rec.nome, 'redeem');
        render();
        ui.toast('Resgate confirmado! Código ' + codigo + '. Apresente na boutique.');
        agendarFoco('recompensas');
      });
      return;
    }
    var cancelar = t.closest('[data-cancelar-agendamento]');
    if (cancelar) {
      ui.confirm({ titulo: 'Cancelar agendamento?', mensagem: 'Os Grãos usados serão devolvidos ao seu saldo.', confirmar: 'Cancelar agendamento', cancelar: 'Manter', perigo: true }).then(function (ok) {
        if (!ok) return;
        var u = SC.auth.current();
        var id = cancelar.getAttribute('data-cancelar-agendamento');
        var ag = u.agendamentos.filter(function (a) { return a.id === id; })[0];
        SC.auth.update({ agendamentos: u.agendamentos.filter(function (a) { return a.id !== id; }) });
        if (ag && ag.graos) SC.auth.addGraos(ag.graos, 'Estorno: ' + ag.nome, 'undo');
        render();
        ui.toast('Agendamento cancelado.');
        agendarFoco('agenda');
      });
      return;
    }
    if (t.closest('#mkt-switch')) {
      var sw = t.closest('#mkt-switch');
      var on = sw.getAttribute('aria-checked') !== 'true';
      var u2 = SC.auth.current();
      var consent = u2.consentimentos || {};
      consent.marketing = { aceito: on, data: new Date().toISOString() };
      var prefs = u2.preferencias || { dietas: [] };
      prefs.avisos = on;
      SC.auth.update({ consentimentos: consent, preferencias: prefs });
      render();
      document.getElementById('mkt-switch').focus();
      ui.toast(on ? 'Você vai receber nossas novidades.' : 'Consentimento revogado. Você não receberá mais ofertas.');
      return;
    }
    if (t.closest('#exportar')) return baixarDados();
    if (t.closest('#trocar-senha')) return trocarSenha();
    if (t.closest('#sair')) {
      SC.auth.logout();
      location.href = SC.url('inicio');
      return;
    }
    if (t.closest('#excluir')) {
      ui.confirm({
        titulo: 'Excluir sua conta?',
        mensagem: 'Seus dados pessoais, Grãos e resgates serão apagados de forma definitiva. Pedidos já feitos ficam guardados sem seus dados pessoais, apenas para fins fiscais. Esta ação não pode ser desfeita.',
        confirmar: 'Excluir definitivamente',
        perigo: true,
      }).then(function (ok) {
        if (!ok) return;
        SC.auth.deleteAccount();
        location.href = SC.url('inicio');
      });
    }
  });

  root.addEventListener('submit', function (e) {
    if (e.target.id !== 'form-dados') return;
    e.preventDefault();
    var form = e.target;
    var nome = document.getElementById('d-nome');
    var tel = document.getElementById('d-telefone');
    var ok = ui.form.validate(form, [
      [nome, nome.value.trim().split(/\s+/).length < 2 ? 'Informe nome e sobrenome.' : null],
      [tel, util.digits(tel.value).length < 10 ? 'Informe o celular com DDD.' : null],
    ]);
    if (!ok) return;
    var u = SC.auth.current();
    var prefs = u.preferencias || {};
    prefs.dietas = Array.prototype.map.call(form.querySelectorAll('input[name="dieta"]:checked'), function (i) { return i.value; });
    SC.auth.update({ nome: nome.value.trim(), telefone: util.digits(tel.value), preferencias: prefs });
    ui.toast('Dados atualizados.');
  });

  render();
  if (location.hash) agendarFoco(location.hash.slice(1));
})();
