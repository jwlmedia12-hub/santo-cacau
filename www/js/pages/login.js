// Entrar, criar conta e recuperar senha.
(function () {
  var SC = window.SantoCacau;
  var util = SC.util;
  var ui = SC.ui;
  var $ = function (id) {
    return document.getElementById(id);
  };

  // Só aceita voltar para páginas deste site (evita redirecionamento aberto).
  function destino() {
    var next = SC.param('next');
    if (next && next.charAt(0) === '/' && next.charAt(1) !== '/') return next;
    return SC.url('dashboard');
  }

  if (SC.auth.current()) {
    location.replace(destino());
    return;
  }

  /* ---------- Abas (padrão WAI-ARIA, setas trocam de aba) ---------- */

  var abas = [$('aba-entrar'), $('aba-cadastro')];
  function selecionar(aba, foco) {
    abas.forEach(function (a) {
      var on = a === aba;
      a.setAttribute('aria-selected', String(on));
      a.tabIndex = on ? 0 : -1;
      $(a.getAttribute('aria-controls')).hidden = !on;
    });
    if (foco) aba.focus();
    history.replaceState(null, '', aba.id === 'aba-cadastro' ? '#cadastro' : location.pathname + location.search);
  }
  abas.forEach(function (aba, i) {
    aba.addEventListener('click', function () {
      selecionar(aba);
    });
    aba.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        selecionar(abas[(i + 1) % abas.length], true);
      }
    });
  });
  if (location.hash === '#cadastro') selecionar(abas[1]);

  /* ---------- Mostrar/ocultar senha ---------- */

  document.querySelectorAll('[data-mostrar-senha]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = $(btn.getAttribute('data-mostrar-senha'));
      var mostrar = input.type === 'password';
      input.type = mostrar ? 'text' : 'password';
      btn.setAttribute('aria-pressed', String(mostrar));
      btn.querySelector('.material-symbols-outlined').textContent = mostrar ? 'visibility_off' : 'visibility';
      btn.querySelector('.sr-only').textContent = mostrar ? 'Ocultar senha' : 'Mostrar senha';
    });
  });

  /* ---------- Entrar ---------- */

  var formLogin = $('form-login');
  formLogin.addEventListener('submit', function (e) {
    e.preventDefault();
    $('login-erro').textContent = '';
    var ok = ui.form.validate(formLogin, [
      [$('login-id'), !$('login-id').value.trim() ? 'Informe seu e-mail ou CPF.' : null],
      [$('login-senha'), !$('login-senha').value ? 'Informe sua senha.' : null],
    ]);
    if (!ok) return;
    var btn = formLogin.querySelector('[type="submit"]');
    btn.disabled = true;
    SC.auth
      .login($('login-id').value, $('login-senha').value, $('lembrar').checked)
      .then(function (user) {
        ui.toast('Bem-vindo(a) de volta, ' + user.nome.split(' ')[0] + '!');
        location.href = destino();
      })
      .catch(function (err) {
        btn.disabled = false;
        $('login-erro').textContent = err.message;
        $('login-senha').value = '';
        $('login-senha').focus();
      });
  });

  /* ---------- Recuperar senha (simulado) ---------- */

  $('esqueci').addEventListener('click', function () {
    var dialog = document.createElement('dialog');
    dialog.setAttribute('aria-labelledby', 'rec-titulo');
    dialog.innerHTML =
      '<form id="form-rec" novalidate class="p-6 flex flex-col gap-4">' +
      '<h2 id="rec-titulo" class="font-titulo text-headline-md">Recuperar senha</h2>' +
      '<p class="text-body-md text-on-surface-variant">Informe o e-mail da sua conta. Enviaremos um link para criar uma nova senha.</p>' +
      '<div><label for="rec-email" class="block text-label-lg mb-1">E-mail</label><input id="rec-email" type="email" inputmode="email" autocomplete="email" class="campo" /></div>' +
      '<p id="rec-status" role="status" class="text-body-md"></p>' +
      '<div class="flex gap-2 justify-end"><button type="button" data-fechar class="btn tap px-5 rounded-full bg-surface-container-high">Fechar</button>' +
      '<button class="btn tap px-5 rounded-full bg-primary text-on-primary text-label-lg">Enviar link</button></div></form>';
    document.body.appendChild(dialog);
    var form = dialog.querySelector('form');
    dialog.querySelector('[data-fechar]').addEventListener('click', function () {
      dialog.close();
    });
    dialog.addEventListener('close', function () {
      dialog.remove();
      $('esqueci').focus();
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = $('rec-email');
      if (!ui.form.validate(form, [[email, !util.validEmail(email.value) ? 'Informe um e-mail válido.' : null]])) return;
      var enviar = form.querySelector('button:not([data-fechar])');
      enviar.disabled = true;
      SC.auth.recuperarSenha(email.value.trim()).then(
        function () {
          // Mensagem neutra: não revela se o e-mail está cadastrado.
          $('rec-status').textContent =
            SC.modo === 'api'
              ? 'Se houver uma conta com ' + email.value.trim() + ', você receberá o link em alguns minutos. Confira também a caixa de spam.'
              : 'Na versão de demonstração não enviamos e-mails. Crie uma conta nova ou fale com o atendimento.';
        },
        function (err) {
          enviar.disabled = false;
          $('rec-status').textContent = err.message;
        }
      );
    });
    dialog.showModal();
  });

  /* ---------- Nova senha (link recebido por e-mail) ---------- */

  var codigoRedefinir = SC.param('redefinir');
  if (codigoRedefinir) {
    var dlg = document.createElement('dialog');
    dlg.setAttribute('aria-labelledby', 'nova-titulo');
    dlg.innerHTML =
      '<form novalidate class="p-6 flex flex-col gap-4">' +
      '<h2 id="nova-titulo" class="font-titulo text-headline-md">Crie uma nova senha</h2>' +
      '<div><label for="nova-senha" class="block text-label-lg mb-1">Nova senha</label>' +
      '<input id="nova-senha" type="password" autocomplete="new-password" class="campo" aria-describedby="nova-dica" />' +
      '<p id="nova-dica" class="text-body-sm text-on-surface-variant mt-1">Mínimo de 8 caracteres, com letras e números.</p></div>' +
      '<p id="nova-status" role="status" class="text-body-md"></p>' +
      '<div class="flex gap-2 justify-end"><button type="button" data-fechar class="btn tap px-5 rounded-full bg-surface-container-high">Cancelar</button>' +
      '<button class="btn tap px-5 rounded-full bg-primary text-on-primary text-label-lg">Salvar senha</button></div></form>';
    document.body.appendChild(dlg);
    var formNova = dlg.querySelector('form');
    dlg.querySelector('[data-fechar]').addEventListener('click', function () {
      dlg.close();
    });
    dlg.addEventListener('close', function () {
      dlg.remove();
      history.replaceState(null, '', location.pathname);
    });
    formNova.addEventListener('submit', function (e) {
      e.preventDefault();
      var nova = $('nova-senha');
      var forte = regras.tamanho(nova.value) && regras.letra(nova.value) && regras.numero(nova.value);
      if (!ui.form.validate(formNova, [[nova, !forte ? 'A senha precisa de 8 caracteres, com letras e números.' : null]])) return;
      SC.auth.redefinirSenha(codigoRedefinir, nova.value).then(
        function () {
          dlg.close();
          ui.toast('Senha alterada! Entre com a nova senha.');
          $('login-id').focus();
        },
        function (err) {
          $('nova-status').textContent = err.message;
        }
      );
    });
    dlg.showModal();
  }

  /* ---------- Criar conta ---------- */

  ui.form.mask($('cad-cpf'), util.maskCPF);
  ui.form.mask($('cad-telefone'), util.maskPhone);

  var regras = {
    tamanho: function (s) { return s.length >= 8; },
    letra: function (s) { return /[A-Za-zÀ-ÿ]/.test(s); },
    numero: function (s) { return /\d/.test(s); },
  };
  $('cad-senha').addEventListener('input', function () {
    var senha = this.value;
    Object.keys(regras).forEach(function (k) {
      var ok = regras[k](senha);
      var li = document.querySelector('[data-regra="' + k + '"]');
      li.classList.toggle('text-sucesso', ok);
      li.querySelector('.material-symbols-outlined').textContent = ok ? 'check_circle' : 'radio_button_unchecked';
      li.querySelector('.regra-status').textContent = ok ? ': atendido' : ': pendente';
    });
  });

  var formCad = $('form-cadastro');
  formCad.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = function (id) { return $(id).value.trim(); };
    var senha = $('cad-senha').value;
    var nasc = v('cad-nascimento');
    var ok = ui.form.validate(formCad, [
      [$('cad-nome'), v('cad-nome').split(/\s+/).length < 2 ? 'Informe nome e sobrenome.' : null],
      [$('cad-email'), !util.validEmail(v('cad-email')) ? 'Informe um e-mail válido, como nome@exemplo.com.' : null],
      [$('cad-cpf'), !util.validCPF(v('cad-cpf')) ? 'CPF inválido. Confira os 11 números.' : null],
      [$('cad-telefone'), util.digits(v('cad-telefone')).length < 10 ? 'Informe o celular com DDD.' : null],
      [$('cad-nascimento'), !nasc ? 'Informe sua data de nascimento.' : util.age(nasc) < 18 ? 'O cadastro é permitido apenas para maiores de 18 anos.' : util.age(nasc) > 120 ? 'Confira o ano de nascimento.' : null],
      [$('cad-senha'), !(regras.tamanho(senha) && regras.letra(senha) && regras.numero(senha)) ? 'A senha precisa de 8 caracteres, com letras e números.' : null],
      [$('cad-senha2'), $('cad-senha2').value !== senha ? 'As senhas não são iguais.' : null],
      [$('cad-termos'), !$('cad-termos').checked ? 'É preciso aceitar os Termos de Uso para criar a conta.' : null],
    ]);
    if (!ok) return;
    var btn = formCad.querySelector('[type="submit"]');
    btn.disabled = true;
    SC.auth
      .register({
        nome: v('cad-nome'),
        email: v('cad-email'),
        cpf: v('cad-cpf'),
        telefone: v('cad-telefone'),
        nascimento: nasc,
        senha: senha,
        marketing: $('cad-marketing').checked,
      })
      .then(function () {
        location.href = destino();
      })
      .catch(function (err) {
        btn.disabled = false;
        ui.form.validate(formCad, [[$('cad-email'), err.message]]);
      });
  });
})();
