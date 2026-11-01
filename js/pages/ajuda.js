// Central de ajuda: links dos canais e formulário de contato.
// Sem servidor, a mensagem é aberta no aplicativo de e-mail do visitante já
// preenchida (mailto). Para receber direto, ligue o formulário a uma API.
(function () {
  var SC = window.SantoCacau;
  var E = window.SC_EMPRESA;
  var util = SC.util;
  var ui = SC.ui;
  var $ = function (id) {
    return document.getElementById(id);
  };

  $('link-whatsapp').href = 'https://wa.me/' + E.whatsappLink;
  $('link-telefone').href = 'tel:' + E.telefoneLink;
  $('link-email').href = 'mailto:' + E.email;

  // Preenche com os dados da conta, se houver.
  var user = SC.auth.current();
  if (user) {
    $('ct-nome').value = user.nome;
    $('ct-email').value = user.email;
  }
  var pedido = SC.param('pedido');
  if (pedido) $('ct-pedido').value = pedido;

  $('ct-mensagem').addEventListener('input', function () {
    var restante = 2000 - this.value.length;
    $('ct-contador').textContent = restante + ' caracteres restantes.';
  });

  var form = $('form-contato');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ok = ui.form.validate(form, [
      [$('ct-nome'), !$('ct-nome').value.trim() ? 'Informe seu nome.' : null],
      [$('ct-email'), !util.validEmail($('ct-email').value) ? 'Informe um e-mail válido.' : null],
      [$('ct-assunto'), !$('ct-assunto').value ? 'Escolha um assunto.' : null],
      [$('ct-mensagem'), $('ct-mensagem').value.trim().length < 10 ? 'Escreva sua mensagem (mínimo de 10 caracteres).' : null],
    ]);
    if (!ok) return;

    var protocolo = 'AT' + String(Date.now()).slice(-8);
    var canal = form.querySelector('input[name="ct-canal"]:checked').value;
    var corpo =
      'Protocolo: ' + protocolo + '\n' +
      'Nome: ' + $('ct-nome').value.trim() + '\n' +
      'E-mail: ' + $('ct-email').value.trim() + '\n' +
      'Pedido: ' + ($('ct-pedido').value.trim() || '-') + '\n' +
      'Resposta preferida: ' + canal + '\n\n' +
      $('ct-mensagem').value.trim();
    var mailto =
      'mailto:' + ($('ct-assunto').value.indexOf('LGPD') !== -1 ? E.encarregadoEmail : E.email) +
      '?subject=' + encodeURIComponent('[' + protocolo + '] ' + $('ct-assunto').value) +
      '&body=' + encodeURIComponent(corpo);

    var msgs = SC.storage.get('mensagens', []);
    msgs.unshift({ protocolo: protocolo, data: new Date().toISOString(), assunto: $('ct-assunto').value });
    SC.storage.set('mensagens', msgs.slice(0, 20));

    var ok2 = $('contato-ok');
    ok2.innerHTML =
      '<h3 class="text-title-lg">Quase lá! Protocolo ' + protocolo + '</h3>' +
      '<p class="text-body-md">Abrimos seu aplicativo de e-mail com a mensagem pronta — é só tocar em enviar. Se ele não abrir, ' +
      '<a class="underline font-semibold" href="' + mailto + '">toque aqui para abrir o e-mail</a> ou fale pelo WhatsApp ' + util.esc(E.whatsapp) + ' informando o protocolo.</p>';
    ok2.hidden = false;
    ok2.focus();
    window.location.href = mailto;
  });

  if (location.hash === '#contato') $('contato').focus();
})();
