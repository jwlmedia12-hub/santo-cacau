// Central de ajuda: links dos canais e formulário de contato.
// Com servidor, a mensagem é gravada e a equipe é avisada; na demonstração,
// abre o aplicativo de e-mail do visitante com a mensagem pronta (mailto).
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
    var canal = form.querySelector('input[name="ct-canal"]:checked').value;
    var dados = {
      nome: $('ct-nome').value.trim(),
      email: $('ct-email').value.trim(),
      assunto: $('ct-assunto').value,
      pedido: $('ct-pedido').value.trim(),
      mensagem: $('ct-mensagem').value.trim(),
      canal: canal,
    };
    var botao = form.querySelector('button');
    botao.disabled = true;

    SC.contato.enviar(dados).then(
      function (res) {
        botao.disabled = false;
        var ok2 = $('contato-ok');
        if (res.enviado) {
          // Com servidor: mensagem registrada e equipe avisada.
          ok2.innerHTML =
            '<h3 class="text-title-lg">Mensagem enviada! Protocolo ' + util.esc(res.protocolo) + '</h3>' +
            '<p class="text-body-md">Recebemos sua mensagem e vamos responder por ' + util.esc(canal.toLowerCase()) + ' em até 2 dias úteis.</p>';
          form.reset();
        } else {
          // Demonstração: abre o e-mail do visitante com a mensagem pronta.
          var corpo =
            'Protocolo: ' + res.protocolo + '\n' +
            'Nome: ' + dados.nome + '\n' +
            'E-mail: ' + dados.email + '\n' +
            'Pedido: ' + (dados.pedido || '-') + '\n' +
            'Resposta preferida: ' + canal + '\n\n' +
            dados.mensagem;
          var mailto =
            'mailto:' + (dados.assunto.indexOf('LGPD') !== -1 ? E.encarregadoEmail : E.email) +
            '?subject=' + encodeURIComponent('[' + res.protocolo + '] ' + dados.assunto) +
            '&body=' + encodeURIComponent(corpo);
          ok2.innerHTML =
            '<h3 class="text-title-lg">Quase lá! Protocolo ' + util.esc(res.protocolo) + '</h3>' +
            '<p class="text-body-md">Abrimos seu aplicativo de e-mail com a mensagem pronta — é só tocar em enviar. Se ele não abrir, ' +
            '<a class="underline font-semibold" href="' + mailto + '">toque aqui para abrir o e-mail</a> ou fale pelo WhatsApp ' + util.esc(E.whatsapp) + ' informando o protocolo.</p>';
          window.location.href = mailto;
        }
        ok2.hidden = false;
        ok2.focus();
      },
      function (err) {
        botao.disabled = false;
        ui.toast(err.message, 'erro');
      }
    );
  });

  if (location.hash === '#contato') $('contato').focus();
})();
