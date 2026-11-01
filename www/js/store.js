/**
 * Santo Cacau — estado da loja: utilitários, sacola, conta, pedidos e preços.
 *
 * IMPORTANTE: este "back-end" roda no navegador e guarda tudo no
 * localStorage do aparelho. Serve para demonstração e protótipo. Para vender
 * de verdade, conta, pedidos e pagamento precisam ir para um servidor com
 * banco de dados e um gateway de pagamento (veja o README).
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
  function backend(session) {
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
      var s = backend(session);
      try {
        var raw = s ? s.getItem('sc:' + key) : memory[key];
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set: function (key, value, session) {
      var raw = JSON.stringify(value);
      var s = backend(session);
      try {
        if (s) s.setItem('sc:' + key, raw);
        else memory[key] = raw;
      } catch (e) {
        memory[key] = raw;
      }
    },
    remove: function (key, session) {
      var s = backend(session);
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
    if (e.key === 'sc:usuarios' || e.key === 'sc:sessao') events.emit('auth');
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

  /* ---------- Conta (demonstração local) ---------- */

  function bufToHex(buf) {
    return Array.prototype.map
      .call(new Uint8Array(buf), function (b) {
        return ('0' + b.toString(16)).slice(-2);
      })
      .join('');
  }

  // PBKDF2 quando há Web Crypto (HTTPS/localhost); senão, um hash simples só
  // para o protótipo funcionar em rede local. Em produção a senha vai ao servidor.
  function hashPassword(password, salt) {
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      var enc = new TextEncoder();
      return crypto.subtle
        .importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
        .then(function (key) {
          return crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt: enc.encode(salt), iterations: 120000, hash: 'SHA-256' },
            key,
            256
          );
        })
        .then(function (bits) {
          return 'pbkdf2:' + bufToHex(bits);
        });
    }
    var h = 2166136261;
    var input = salt + ':' + password;
    for (var r = 0; r < 1000; r++) {
      for (var i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      input = h.toString(16) + input.length;
    }
    return Promise.resolve('fnv:' + h.toString(16));
  }

  function users() {
    return storage.get('usuarios', {});
  }
  function saveUsers(map) {
    storage.set('usuarios', map);
  }
  function findUser(identifier) {
    var id = String(identifier || '').trim().toLowerCase();
    var cpf = util.digits(identifier);
    var map = users();
    for (var key in map) {
      var u = map[key];
      if (u.email === id || (cpf.length === 11 && u.cpf === cpf)) return u;
    }
    return null;
  }

  function sessionUserId() {
    var s = storage.get('sessao', null) || storage.get('sessao', null, true);
    return s && s.userId;
  }

  function publicUser(u) {
    if (!u) return null;
    var copy = {};
    for (var k in u) if (k !== 'senha') copy[k] = u[k];
    return copy;
  }

  var auth = {
    current: function () {
      var id = sessionUserId();
      if (!id) return null;
      return publicUser(users()[id]) || null;
    },
    register: function (data) {
      if (findUser(data.email) || findUser(data.cpf)) {
        return Promise.reject(new Error('Já existe uma conta com este e-mail ou CPF.'));
      }
      var salt = util.id('S');
      return hashPassword(data.senha, salt).then(function (hash) {
        var now = new Date().toISOString();
        var bonus = DATA.regras.bonusCadastro;
        var user = {
          id: util.id('U'),
          nome: data.nome.trim(),
          email: data.email.trim().toLowerCase(),
          cpf: util.digits(data.cpf),
          telefone: util.digits(data.telefone),
          nascimento: data.nascimento,
          senha: { salt: salt, hash: hash },
          criadoEm: now,
          graos: bonus,
          graosTotal: bonus,
          extrato: [{ data: now, descricao: 'Bônus de boas-vindas', graos: bonus, icone: 'celebration' }],
          resgates: [],
          agendamentos: [],
          enderecos: [],
          favoritos: [],
          preferencias: { dietas: [], avisos: !!data.marketing },
          consentimentos: {
            termos: { aceito: true, data: now, versao: SC_EMPRESA.atualizacaoPoliticas },
            privacidade: { aceito: true, data: now, versao: SC_EMPRESA.atualizacaoPoliticas },
            marketing: { aceito: !!data.marketing, data: now },
          },
        };
        var map = users();
        map[user.id] = user;
        saveUsers(map);
        auth._startSession(user.id, true);
        return publicUser(user);
      });
    },
    login: function (identifier, password, remember) {
      var user = findUser(identifier);
      if (!user) return Promise.reject(new Error('E-mail/CPF ou senha incorretos.'));
      return hashPassword(password, user.senha.salt).then(function (hash) {
        if (hash !== user.senha.hash) throw new Error('E-mail/CPF ou senha incorretos.');
        auth._startSession(user.id, remember);
        return publicUser(user);
      });
    },
    _startSession: function (userId, remember) {
      storage.remove('sessao');
      storage.remove('sessao', true);
      storage.set('sessao', { userId: userId, inicio: new Date().toISOString() }, !remember);
      events.emit('auth');
    },
    logout: function () {
      storage.remove('sessao');
      storage.remove('sessao', true);
      events.emit('auth');
    },
    // Atualiza campos do usuário logado (nunca a senha).
    update: function (patch) {
      var id = sessionUserId();
      var map = users();
      if (!id || !map[id]) return null;
      for (var k in patch) if (k !== 'senha' && k !== 'id') map[id][k] = patch[k];
      saveUsers(map);
      events.emit('auth');
      return publicUser(map[id]);
    },
    changePassword: function (current, next) {
      var id = sessionUserId();
      var map = users();
      var user = map[id];
      if (!user) return Promise.reject(new Error('Sessão expirada.'));
      return hashPassword(current, user.senha.salt).then(function (hash) {
        if (hash !== user.senha.hash) throw new Error('Senha atual incorreta.');
        var salt = util.id('S');
        return hashPassword(next, salt).then(function (newHash) {
          map[id].senha = { salt: salt, hash: newHash };
          saveUsers(map);
        });
      });
    },
    // Recuperação de senha (simulada: em produção, envio de link por e-mail).
    exists: function (identifier) {
      return !!findUser(identifier);
    },
    addGraos: function (graos, descricao, icone) {
      var user = auth.current();
      if (!user) return null;
      var entry = { data: new Date().toISOString(), descricao: descricao, graos: graos, icone: icone || 'savings' };
      return auth.update({
        graos: user.graos + graos,
        graosTotal: graos > 0 ? user.graosTotal + graos : user.graosTotal,
        extrato: [entry].concat(user.extrato || []),
      });
    },
    // LGPD art. 18: portabilidade e acesso aos dados.
    exportData: function () {
      var user = auth.current();
      if (!user) return null;
      return {
        geradoEm: new Date().toISOString(),
        controlador: SC_EMPRESA.razaoSocial + ' — CNPJ ' + SC_EMPRESA.cnpj,
        titular: user,
        pedidos: orders.list(user.id),
        preferenciasAcessibilidade: storage.get('a11y', null),
        consentimentoCookies: storage.get('consentimento', null),
      };
    },
    // LGPD art. 18, VI: eliminação dos dados. Pedidos são anonimizados (a
    // legislação fiscal exige guardar a nota, não a identidade completa).
    deleteAccount: function () {
      var id = sessionUserId();
      if (!id) return;
      var map = users();
      delete map[id];
      saveUsers(map);
      var all = storage.get('pedidos', []);
      all.forEach(function (o) {
        if (o.userId === id) {
          o.userId = null;
          o.cliente = { nome: 'Titular removido', email: null, cpf: null, telefone: null };
          if (o.entrega && o.entrega.endereco) o.entrega.endereco = { cidade: o.entrega.endereco.cidade, uf: o.entrega.endereco.uf };
        }
      });
      storage.set('pedidos', all);
      auth.logout();
    },
  };

  /* ---------- Passaporte ---------- */

  function nivel(graosTotal) {
    var niveis = DATA.niveis;
    var atual = niveis[0];
    var proximo = null;
    for (var i = 0; i < niveis.length; i++) {
      if (graosTotal >= niveis[i].min) {
        atual = niveis[i];
        proximo = niveis[i + 1] || null;
      }
    }
    var progresso = proximo ? (graosTotal - atual.min) / (proximo.min - atual.min) : 1;
    return {
      atual: atual,
      proximo: proximo,
      faltam: proximo ? proximo.min - graosTotal : 0,
      progresso: Math.max(0, Math.min(1, progresso)),
      indice: niveis.indexOf(atual),
    };
  }

  function nivelIndice(id) {
    for (var i = 0; i < DATA.niveis.length; i++) if (DATA.niveis[i].id === id) return i;
    return 0;
  }

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

  function isCapitalSP(cep) {
    var n = Number(util.digits(cep));
    return (n >= 1000000 && n <= 5999999) || (n >= 8000000 && n <= 8499999);
  }

  var pricing = {
    isCapitalSP: isCapitalSP,
    compute: function () {
      var regras = DATA.regras;
      var itens = cart.detailed();
      var opts = checkout.get();
      var user = auth.current();
      var tier = user ? nivel(user.graosTotal) : null;
      var vip = tier && tier.indice >= nivelIndice('ouro');
      var avisos = [];

      var quantidade = itens.reduce(function (n, i) {
        return n + i.qtd;
      }, 0);
      var subtotal = itens.reduce(function (n, i) {
        return n + i.total;
      }, 0);
      var embalagemItens = itens.reduce(function (n, i) {
        return n + (i.presente ? i.qtd : 0);
      }, 0);
      var embalagem = vip ? 0 : embalagemItens * regras.embalagemPresente;

      // Cupom
      var cupom = null;
      var descontoCupom = 0;
      var codigo = (opts.cupom || '').toUpperCase();
      if (codigo) {
        var c = DATA.cupons[codigo];
        if (!c) avisos.push({ campo: 'cupom', msg: 'Cupom "' + codigo + '" não encontrado.' });
        else if (subtotal < c.minimo)
          avisos.push({ campo: 'cupom', msg: 'O cupom ' + codigo + ' vale para compras acima de ' + util.money(c.minimo) + '.' });
        else if (c.primeiraCompra && user && orders.list(user.id).length)
          avisos.push({ campo: 'cupom', msg: 'O cupom ' + codigo + ' é válido apenas na primeira compra.' });
        else {
          cupom = { codigo: codigo, descricao: c.descricao };
          descontoCupom = c.tipo === 'valor' ? c.valor : (subtotal * c.valor) / 100;
        }
      }

      // Grãos Dourados
      var descontoGraos = 0;
      var podeUsarGraos = !!(user && user.graos >= regras.resgateGraos.graos);
      if (opts.usarGraos && podeUsarGraos) descontoGraos = regras.resgateGraos.desconto;

      var descontos = Math.min(subtotal, descontoCupom + descontoGraos);
      var baseFrete = subtotal - descontos;

      // Frete
      var modo = regras.frete[opts.entrega] ? opts.entrega : 'padrao';
      var freteRegra = regras.frete[modo];
      var frete = freteRegra.valor;
      var freteMotivo = '';
      if (modo === 'expressa' && opts.cep && !isCapitalSP(opts.cep)) {
        avisos.push({ campo: 'entrega', msg: 'A entrega expressa atende apenas a capital de São Paulo.' });
      }
      if (frete > 0 && vip) {
        frete = 0;
        freteMotivo = 'Benefício ' + tier.atual.nome;
      } else if (frete > 0 && freteRegra.gratisAcima && baseFrete >= freteRegra.gratisAcima) {
        frete = 0;
        freteMotivo = 'Compras acima de ' + util.money(freteRegra.gratisAcima);
      }
      if (!itens.length) frete = 0;

      var total = Math.max(0, subtotal - descontos) + embalagem + frete;
      var parcelas = 1;
      for (var n = regras.parcelasSemJuros; n > 1; n--) {
        if (total / n >= regras.parcelaMinima) {
          parcelas = n;
          break;
        }
      }

      return {
        itens: itens,
        quantidade: quantidade,
        subtotal: subtotal,
        embalagem: embalagem,
        embalagemItens: embalagemItens,
        embalagemCortesia: vip && embalagemItens > 0,
        cupom: cupom,
        descontoCupom: Math.min(descontoCupom, subtotal),
        podeUsarGraos: podeUsarGraos,
        usarGraos: descontoGraos > 0,
        descontoGraos: descontoGraos,
        entrega: modo,
        freteRegra: freteRegra,
        frete: frete,
        freteMotivo: freteMotivo,
        freteFaltam: freteRegra.gratisAcima && !vip ? Math.max(0, freteRegra.gratisAcima - baseFrete) : 0,
        total: total,
        parcelas: parcelas,
        valorParcela: total / parcelas,
        graosGanhos: Math.floor(Math.max(0, subtotal - descontos) * regras.graosPorReal),
        avisos: avisos,
        opts: opts,
        user: user,
      };
    },
  };

  /* ---------- Pedidos ---------- */

  var orders = {
    all: function () {
      return storage.get('pedidos', []);
    },
    list: function (userId) {
      return orders.all().filter(function (o) {
        return o.userId === userId;
      });
    },
    get: function (id) {
      return orders.all().filter(function (o) {
        return o.id === id;
      })[0];
    },
    // Cria o pedido a partir da sacola atual. Pagamento é simulado.
    create: function (info) {
      var resumo = pricing.compute();
      var user = auth.current();
      var now = new Date().toISOString();
      var order = {
        id: 'SC' + String(Date.now()).slice(-8),
        criadoEm: now,
        userId: user ? user.id : null,
        cliente: info.cliente,
        entrega: { modo: resumo.entrega, nome: resumo.freteRegra.nome, prazo: resumo.freteRegra.prazo, endereco: info.endereco },
        pagamento: info.pagamento,
        itens: resumo.itens.map(function (i) {
          return { id: i.id, nome: i.produto.nome, qtd: i.qtd, preco: i.produto.preco, presente: i.presente, img: i.produto.img };
        }),
        valores: {
          subtotal: resumo.subtotal,
          embalagem: resumo.embalagem,
          frete: resumo.frete,
          descontoCupom: resumo.descontoCupom,
          descontoGraos: resumo.descontoGraos,
          total: resumo.total,
          parcelas: info.pagamento.parcelas || 1,
        },
        cupom: resumo.cupom && resumo.cupom.codigo,
        graosGanhos: user ? resumo.graosGanhos : 0,
        status: info.pagamento.metodo === 'cartao' ? 'pago' : 'aguardando',
        observacoes: info.observacoes || '',
      };
      var all = orders.all();
      all.unshift(order);
      storage.set('pedidos', all);

      if (user) {
        if (resumo.usarGraos) auth.addGraos(-DATA.regras.resgateGraos.graos, 'Resgate no pedido #' + order.id, 'redeem');
        if (order.graosGanhos) auth.addGraos(order.graosGanhos, 'Pedido #' + order.id, 'shopping_bag');
      }
      cart.clear();
      events.emit('orders');
      return order;
    },
    update: function (id, patch) {
      var all = orders.all();
      all.forEach(function (o) {
        if (o.id === id) for (var k in patch) o[k] = patch[k];
      });
      storage.set('pedidos', all);
      events.emit('orders');
      return orders.get(id);
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
        }[status] || status
      );
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
  SC.auth = auth;
  SC.nivel = nivel;
  SC.nivelIndice = nivelIndice;
  SC.cart = cart;
  SC.checkout = checkout;
  SC.pricing = pricing;
  SC.orders = orders;
})();
