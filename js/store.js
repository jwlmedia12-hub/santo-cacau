/**
 * Santo Cacau — estado da loja: utilitários, sacola, conta, pedidos e preços.
 *
 * Conta, pedidos e Grãos passam por um back-end: o servidor real (API) quando
 * SC_CONFIG.apiUrl está definido, ou a demonstração no localStorage.
 */
(function () {
  'use strict';

  var SC = (window.SantoCacau = window.SantoCacau || {});
  var DATA = window.SC_DATA;

  /* ---------- Utilitários ---------- */

  var moneyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  var util = {
    esc: function (value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
        return ESC[c];
      });
    },
    money: function (n) {
      return moneyFmt.format(n || 0);
    },
    // Ícone decorativo (o texto do ícone nunca é lido pelo leitor de tela).
    icon: function (name, cls) {
      return (
        '<span class="material-symbols-outlined ' + (cls || '') + '" aria-hidden="true">' + name + '</span>'
      );
    },
    digits: function (value) {
      return String(value || '').replace(/\D/g, '');
    },
    validEmail: function (email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || '').trim());
    },
    validCPF: function (value) {
      var cpf = util.digits(value);
      if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
      for (var t = 9; t < 11; t++) {
        var sum = 0;
        for (var i = 0; i < t; i++) sum += Number(cpf[i]) * (t + 1 - i);
        var digit = ((sum * 10) % 11) % 10;
        if (digit !== Number(cpf[t])) return false;
      }
      return true;
    },
    maskCPF: function (value) {
      return util
        .digits(value)
        .slice(0, 11)
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    },
    maskCEP: function (value) {
      return util.digits(value).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
    },
    maskPhone: function (value) {
      var d = util.digits(value).slice(0, 11);
      if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
      return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
    },
    date: function (iso, opts) {
      return new Date(iso).toLocaleDateString(
        'pt-BR',
        opts || { day: '2-digit', month: 'long', year: 'numeric' }
      );
    },
    dateTime: function (iso) {
      return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    },
    id: function (prefix) {
      return (prefix || '') + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
    },
    age: function (isoDate) {
      var birth = new Date(isoDate);
      if (isNaN(birth)) return 0;
      var now = new Date();
      var age = now.getFullYear() - birth.getFullYear();
      var m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
      return age;
    },
  };

  /* ---------- Armazenamento seguro ---------- */

  var memory = {};
  function armazenamento(session) {
    try {
      var s = session ? window.sessionStorage : window.localStorage;
      var probe = '__sc__';
      s.setItem(probe, '1');
      s.removeItem(probe);
      return s;
    } catch (e) {
      return null;
    }
  }

  var storage = {
    get: function (key, fallback, session) {
      var s = armazenamento(session);
      try {
        var raw = s ? s.getItem('sc:' + key) : memory[key];
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set: function (key, value, session) {
      var raw = JSON.stringify(value);
      var s = armazenamento(session);
      try {
        if (s) s.setItem('sc:' + key, raw);
        else memory[key] = raw;
      } catch (e) {
        memory[key] = raw;
      }
    },
    remove: function (key, session) {
      var s = armazenamento(session);
      try {
        if (s) s.removeItem('sc:' + key);
      } catch (e) {
        /* ignora */
      }
      delete memory[key];
    },
  };

  /* ---------- Eventos ---------- */

  var events = {
    on: function (name, fn) {
      window.addEventListener('sc:' + name, function (e) {
        fn(e.detail);
      });
    },
    emit: function (name, detail) {
      window.dispatchEvent(new CustomEvent('sc:' + name, { detail: detail }));
    },
  };

  // Mudanças feitas em outra aba também atualizam esta.
  window.addEventListener('storage', function (e) {
    if (!e.key) return;
    if (e.key === 'sc:sacola') events.emit('cart');
    if (/^sc:(usuarios|sessao|usuario|token)$/.test(e.key)) events.emit('auth');
  });

  /* ---------- Produtos ---------- */

  var produtos = {
    all: function () {
      return DATA.produtos.slice();
    },
    get: function (id) {
      return DATA.produtos.filter(function (p) {
        return p.id === id;
      })[0];
    },
  };

  /* ---------- Sacola ---------- */

  var cart = {
    items: function () {
      return storage.get('sacola', []).filter(function (item) {
        return produtos.get(item.id);
      });
    },
    _save: function (items) {
      storage.set('sacola', items);
      events.emit('cart');
    },
    count: function () {
      return cart.items().reduce(function (n, i) {
        return n + i.qtd;
      }, 0);
    },
    add: function (id, qtd) {
      var items = cart.items();
      var found = items.filter(function (i) {
        return i.id === id;
      })[0];
      if (found) found.qtd = Math.min(99, found.qtd + (qtd || 1));
      else items.push({ id: id, qtd: Math.min(99, qtd || 1), presente: false });
      cart._save(items);
    },
    setQty: function (id, qtd) {
      var items = cart.items();
      items.forEach(function (i) {
        if (i.id === id) i.qtd = Math.max(1, Math.min(99, qtd));
      });
      cart._save(items);
    },
    setGift: function (id, presente) {
      var items = cart.items();
      items.forEach(function (i) {
        if (i.id === id) i.presente = !!presente;
      });
      cart._save(items);
    },
    remove: function (id) {
      cart._save(
        cart.items().filter(function (i) {
          return i.id !== id;
        })
      );
    },
    clear: function () {
      cart._save([]);
      storage.remove('checkout');
    },
    detailed: function () {
      return cart.items().map(function (i) {
        var p = produtos.get(i.id);
        return { id: i.id, qtd: i.qtd, presente: i.presente, produto: p, total: p.preco * i.qtd };
      });
    },
    hasAlcohol: function () {
      return cart.detailed().some(function (i) {
        return i.produto.alcool;
      });
    },
  };

  /* ---------- Opções de compra (cupom, frete, grãos) ---------- */

  var checkout = {
    get: function () {
      return storage.get('checkout', { cupom: '', usarGraos: false, entrega: 'padrao', cep: '' });
    },
    set: function (patch) {
      var current = checkout.get();
      for (var k in patch) current[k] = patch[k];
      storage.set('checkout', current);
      events.emit('cart');
      return current;
    },
  };


  /* ---------- Preços (regras em pricing.js, as mesmas do servidor) ---------- */

  var PR = window.SC_PRICING;
  function nivel(graosTotal) {
    return PR.nivel(DATA, graosTotal);
  }
  function nivelIndice(id) {
    return PR.nivelIndice(DATA, id);
  }
  function calcular(itens, opts, user, pedidosAnteriores) {
    return PR.calcular(DATA, itens, opts, user, pedidosAnteriores);
  }

  var pricing = {
    isCapitalSP: PR.isCapitalSP,
    compute: function () {
      var user = auth.current();
      return calcular(cart.detailed(), checkout.get(), user, user ? user.pedidosCount || 0 : 0);
    },
  };

  /* ---------- Back-end: servidor real (API) ou demonstração local ---------- */

  var cfg = window.SC_CONFIG || {};
  var usaApi = typeof cfg.apiUrl === 'string';
  var backend = window.SC_BACKENDS[usaApi ? 'api' : 'local']({
    util: util,
    storage: storage,
    events: events,
    DATA: DATA,
    produtos: produtos,
    calcular: calcular,
    nivel: nivel,
    nivelIndice: nivelIndice,
  });

  // Toda alteração da conta avisa as telas (cabeçalho, saldo, etc.).
  function avisaConta(valor) {
    events.emit('auth');
    return valor;
  }

  var auth = {
    current: function () {
      return backend.usuarioAtual();
    },
    refresh: function () {
      return backend.refresh().then(avisaConta);
    },
    register: function (dados) {
      return backend.register(dados).then(avisaConta);
    },
    login: function (identificador, senha, lembrar) {
      return backend.login(identificador, senha, lembrar).then(avisaConta);
    },
    logout: function () {
      return backend.logout().then(avisaConta);
    },
    changePassword: function (atual, nova) {
      return backend.changePassword(atual, nova);
    },
    recuperarSenha: function (email) {
      return backend.recuperarSenha(email);
    },
    redefinirSenha: function (codigo, senha) {
      if (!backend.redefinirSenha) return Promise.reject(new Error('Disponível apenas com o servidor.'));
      return backend.redefinirSenha(codigo, senha);
    },
    // LGPD art. 18: acesso e portabilidade.
    exportData: function () {
      return backend.exportData();
    },
    // LGPD art. 18, VI: eliminação dos dados.
    deleteAccount: function () {
      return backend.deleteAccount().then(avisaConta);
    },
  };

  var conta = {
    atualizarPerfil: function (dados) {
      return backend.atualizarPerfil(dados).then(avisaConta);
    },
    marketing: function (aceito) {
      return backend.marketing(aceito).then(avisaConta);
    },
    resgatar: function (recompensaId) {
      return backend.resgatar(recompensaId).then(avisaConta);
    },
    agendar: function (experienciaId, dados) {
      return backend.agendar(experienciaId, dados).then(avisaConta);
    },
    cancelarAgendamento: function (id) {
      return backend.cancelarAgendamento(id).then(avisaConta);
    },
  };

  /* ---------- Pedidos ---------- */

  var orders = {
    list: function () {
      return backend.pedidos();
    },
    get: function (id) {
      return backend.pedido(id);
    },
    // Envia a sacola; o back-end recalcula preços e cria o pagamento.
    create: function (info) {
      var dados = {
        itens: cart.items(),
        opts: checkout.get(),
        cliente: info.cliente,
        endereco: info.endereco,
        pagamento: info.pagamento,
        observacoes: info.observacoes || '',
        aceiteTermos: !!info.aceiteTermos,
        confirmaMaioridade: !!info.confirmaMaioridade,
      };
      return backend.criarPedido(dados).then(function (res) {
        cart.clear();
        events.emit('orders');
        return res;
      });
    },
    simularPagamento: function (id) {
      return backend.simularPagamento(id).then(function (pedido) {
        events.emit('auth');
        return pedido;
      });
    },
    statusLabel: function (status) {
      return (
        {
          aguardando: 'Aguardando pagamento',
          pago: 'Pagamento aprovado',
          preparo: 'Em preparo',
          enviado: 'A caminho',
          entregue: 'Entregue',
          cancelado: 'Cancelado',
          recusado: 'Pagamento recusado',
          expirado: 'Pagamento expirado',
        }[status] || status
      );
    },
  };

  var contato = {
    enviar: function (dados) {
      return backend.contato(dados);
    },
  };

  // Consulta de CEP no serviço público ViaCEP.
  function buscarCep(cep) {
    var d = util.digits(cep);
    if (d.length !== 8) return Promise.reject(new Error('Digite um CEP com 8 números.'));
    return fetch('https://viacep.com.br/ws/' + d + '/json/')
      .then(function (r) {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .catch(function () {
        throw new Error('Não foi possível consultar o CEP agora. Preencha o endereço manualmente.');
      })
      .then(function (json) {
        if (json.erro) throw new Error('CEP não encontrado. Confira os números.');
        return { cep: util.maskCEP(d), logradouro: json.logradouro, bairro: json.bairro, cidade: json.localidade, uf: json.uf };
      });
  }


  SC.buscarCep = buscarCep;
  SC.util = util;
  SC.storage = storage;
  SC.events = events;
  SC.produtos = produtos;
  SC.modo = backend.modo;
  SC.auth = auth;
  SC.conta = conta;
  SC.contato = contato;
  SC.nivel = nivel;
  SC.nivelIndice = nivelIndice;
  SC.cart = cart;
  SC.checkout = checkout;
  SC.pricing = pricing;
  SC.orders = orders;

  // Confirma a sessão no servidor (saldo de Grãos, nome) a cada página.
  if (usaApi) auth.refresh();
})();
