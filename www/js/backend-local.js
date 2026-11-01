/**
 * Santo Cacau — back-end de DEMONSTRAÇÃO (tudo no localStorage do aparelho).
 *
 * Usado quando não há servidor configurado (SC_CONFIG.apiUrl === null), por
 * exemplo no GitHub Pages. Tem a mesma interface de backend-api.js; todas as
 * operações devolvem Promise. O pagamento é simulado.
 */
(function () {
  'use strict';

  window.SC_BACKENDS = window.SC_BACKENDS || {};

  window.SC_BACKENDS.local = function (ctx) {
    var util = ctx.util;
    var storage = ctx.storage;
    var DATA = ctx.DATA;
    var EMPRESA = window.SC_EMPRESA;

    function bufToHex(buf) {
      return Array.prototype.map
        .call(new Uint8Array(buf), function (b) {
          return ('0' + b.toString(16)).slice(-2);
        })
        .join('');
    }

    // PBKDF2 quando há Web Crypto (HTTPS/localhost); senão, um hash simples só
    // para a demonstração funcionar em rede local.
    function hashPassword(password, salt) {
      if (window.crypto && crypto.subtle && window.TextEncoder) {
        var enc = new TextEncoder();
        return crypto.subtle
          .importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
          .then(function (key) {
            return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 120000, hash: 'SHA-256' }, key, 256);
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
    function allOrders() {
      return storage.get('pedidos', []);
    }
    function ordersOf(userId) {
      return allOrders().filter(function (o) {
        return o.userId === userId;
      });
    }
    function publicUser(u) {
      if (!u) return null;
      var copy = {};
      for (var k in u) if (k !== 'senha') copy[k] = u[k];
      copy.pedidosCount = ordersOf(u.id).length;
      return copy;
    }
    function current() {
      var id = sessionUserId();
      return id ? publicUser(users()[id]) : null;
    }
    function startSession(userId, remember) {
      storage.remove('sessao');
      storage.remove('sessao', true);
      storage.set('sessao', { userId: userId, inicio: new Date().toISOString() }, !remember);
    }
    function patchUser(fn) {
      var id = sessionUserId();
      var map = users();
      if (!id || !map[id]) return Promise.reject(new Error('Sua sessão expirou. Entre novamente.'));
      try {
        fn(map[id]);
      } catch (e) {
        return Promise.reject(e);
      }
      saveUsers(map);
      return Promise.resolve(publicUser(map[id]));
    }
    function lancarGraos(u, graos, descricao, icone) {
      u.graos += graos;
      if (graos > 0) u.graosTotal += graos;
      u.extrato = [{ data: new Date().toISOString(), descricao: descricao, graos: graos, icone: icone || 'savings' }].concat(u.extrato || []);
    }
    function falha(msg) {
      return Promise.reject(new Error(msg));
    }

    return {
      modo: 'local',
      usuarioAtual: current,
      refresh: function () {
        return Promise.resolve(current());
      },

      register: function (data) {
        if (findUser(data.email) || findUser(data.cpf)) return falha('Já existe uma conta com este e-mail ou CPF.');
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
            preferencias: { dietas: [], avisos: !!data.marketing },
            consentimentos: {
              termos: { aceito: true, data: now, versao: EMPRESA.atualizacaoPoliticas },
              privacidade: { aceito: true, data: now, versao: EMPRESA.atualizacaoPoliticas },
              marketing: { aceito: !!data.marketing, data: now },
            },
          };
          var map = users();
          map[user.id] = user;
          saveUsers(map);
          startSession(user.id, true);
          return publicUser(user);
        });
      },

      login: function (identifier, password, remember) {
        var user = findUser(identifier);
        if (!user) return falha('E-mail/CPF ou senha incorretos.');
        return hashPassword(password, user.senha.salt).then(function (hash) {
          if (hash !== user.senha.hash) throw new Error('E-mail/CPF ou senha incorretos.');
          startSession(user.id, remember);
          return publicUser(user);
        });
      },

      logout: function () {
        storage.remove('sessao');
        storage.remove('sessao', true);
        return Promise.resolve();
      },

      changePassword: function (atual, nova) {
        var id = sessionUserId();
        var map = users();
        var user = map[id];
        if (!user) return falha('Sua sessão expirou. Entre novamente.');
        return hashPassword(atual, user.senha.salt).then(function (hash) {
          if (hash !== user.senha.hash) throw new Error('Senha atual incorreta.');
          var salt = util.id('S');
          return hashPassword(nova, salt).then(function (novoHash) {
            map[id].senha = { salt: salt, hash: novoHash };
            saveUsers(map);
          });
        });
      },

      // Sem servidor não há envio de e-mail: a resposta é sempre neutra.
      recuperarSenha: function () {
        return Promise.resolve();
      },

      exportData: function () {
        var user = current();
        if (!user) return falha('Sua sessão expirou. Entre novamente.');
        return Promise.resolve({
          geradoEm: new Date().toISOString(),
          controlador: EMPRESA.razaoSocial + ' — CNPJ ' + EMPRESA.cnpj,
          titular: user,
          pedidos: ordersOf(user.id),
          preferenciasAcessibilidade: storage.get('a11y', null),
          consentimentoCookies: storage.get('consentimento', null),
        });
      },

      // Pedidos ficam guardados sem dados pessoais (exigência fiscal).
      deleteAccount: function () {
        var id = sessionUserId();
        if (!id) return Promise.resolve();
        var map = users();
        delete map[id];
        saveUsers(map);
        var all = allOrders();
        all.forEach(function (o) {
          if (o.userId === id) {
            o.userId = null;
            o.cliente = { nome: 'Titular removido', email: null, cpf: null, telefone: null };
            if (o.entrega && o.entrega.endereco) o.entrega.endereco = { cidade: o.entrega.endereco.cidade, uf: o.entrega.endereco.uf };
          }
        });
        storage.set('pedidos', all);
        storage.remove('sessao');
        storage.remove('sessao', true);
        return Promise.resolve();
      },

      atualizarPerfil: function (dados) {
        return patchUser(function (u) {
          if (dados.nome) u.nome = dados.nome;
          if (dados.telefone) u.telefone = util.digits(dados.telefone);
          if (dados.dietas) u.preferencias = Object.assign({}, u.preferencias, { dietas: dados.dietas });
          if (dados.endereco) u.enderecos = [dados.endereco];
        });
      },

      marketing: function (aceito) {
        return patchUser(function (u) {
          u.consentimentos = u.consentimentos || {};
          u.consentimentos.marketing = { aceito: !!aceito, data: new Date().toISOString() };
          u.preferencias = Object.assign({}, u.preferencias, { avisos: !!aceito });
        });
      },

      resgatar: function (recompensaId) {
        var rec = DATA.recompensas.filter(function (r) {
          return r.id === recompensaId;
        })[0];
        if (!rec) return falha('Recompensa não encontrada.');
        var codigo = 'R' + util.id().slice(-6);
        return patchUser(function (u) {
          if (u.graos < rec.graos) throw new Error('Saldo de Grãos insuficiente.');
          lancarGraos(u, -rec.graos, 'Resgate: ' + rec.nome, 'redeem');
          u.resgates = [{ id: rec.id, nome: rec.nome, data: new Date().toISOString(), codigo: codigo }].concat(u.resgates || []);
        }).then(function (user) {
          return { user: user, codigo: codigo };
        });
      },

      agendar: function (experienciaId, dados) {
        var x = DATA.experiencias.filter(function (e) {
          return e.id === experienciaId;
        })[0];
        if (!x) return falha('Experiência não encontrada.');
        return patchUser(function (u) {
          if (ctx.nivel(u.graosTotal).indice < ctx.nivelIndice(x.nivelMin)) throw new Error('Seu nível ainda não libera esta experiência.');
          if (u.graos < x.graos) throw new Error('Saldo de Grãos insuficiente.');
          if (x.graos) lancarGraos(u, -x.graos, 'Agendamento: ' + x.nome, 'event');
          u.agendamentos = [
            { id: util.id('A'), experiencia: x.id, nome: x.nome, boutique: dados.boutique, data: dados.data, hora: dados.hora, necessidades: dados.necessidades || '', graos: x.graos },
          ].concat(u.agendamentos || []);
        });
      },

      cancelarAgendamento: function (id) {
        return patchUser(function (u) {
          var ag = (u.agendamentos || []).filter(function (a) {
            return a.id === id;
          })[0];
          if (!ag) throw new Error('Agendamento não encontrado.');
          u.agendamentos = u.agendamentos.filter(function (a) {
            return a.id !== id;
          });
          if (ag.graos) lancarGraos(u, ag.graos, 'Estorno: ' + ag.nome, 'undo');
        });
      },

      pedidos: function () {
        var user = current();
        return Promise.resolve(user ? ordersOf(user.id) : []);
      },

      pedido: function (id) {
        return Promise.resolve(
          allOrders().filter(function (o) {
            return o.id === id;
          })[0] || null
        );
      },

      // Cria o pedido com os valores recalculados a partir do catálogo.
      criarPedido: function (info) {
        var user = current();
        var itens = info.itens
          .map(function (i) {
            return { id: i.id, qtd: i.qtd, presente: i.presente, produto: ctx.produtos.get(i.id) };
          })
          .filter(function (i) {
            return i.produto;
          });
        if (!itens.length) return falha('Sua sacola está vazia.');
        var r = ctx.calcular(itens, info.opts, user, user ? user.pedidosCount : 0);
        var now = new Date().toISOString();
        var id = 'SC' + String(Date.now()).slice(-8);
        var cartao = info.pagamento.metodo === 'cartao';
        var order = {
          id: id,
          criadoEm: now,
          userId: user ? user.id : null,
          cliente: info.cliente,
          entrega: { modo: r.entrega, nome: r.freteRegra.nome, prazo: r.freteRegra.prazo, endereco: info.endereco },
          pagamento: cartao
            ? { metodo: 'cartao', final: info.pagamento.final, parcelas: info.pagamento.parcelas || 1, provedor: 'simulado' }
            : { metodo: 'pix', parcelas: 1, provedor: 'simulado', pix: { qrCode: '00020126580014BR.GOV.BCB.PIX0136SANTOCACAU-DEMO-' + id + '5204000053039865406' + r.total.toFixed(2) + '5802BR5913SANTO CACAU6009SAO PAULO6304DEMO' } },
          itens: r.itens.map(function (i) {
            return { id: i.id, nome: i.produto.nome, qtd: i.qtd, preco: i.produto.preco, presente: i.presente, img: i.produto.img };
          }),
          valores: {
            subtotal: r.subtotal,
            embalagem: r.embalagem,
            frete: r.frete,
            descontoCupom: r.descontoCupom,
            descontoGraos: r.descontoGraos,
            total: r.total,
            parcelas: cartao ? info.pagamento.parcelas || 1 : 1,
          },
          cupom: r.cupom && r.cupom.codigo,
          graosGanhos: user ? r.graosGanhos : 0,
          graosCreditados: false,
          status: 'aguardando',
          observacoes: info.observacoes || '',
        };
        var all = allOrders();
        all.unshift(order);
        storage.set('pedidos', all);
        var p = Promise.resolve();
        if (user && r.usarGraos) {
          p = patchUser(function (u) {
            lancarGraos(u, -DATA.regras.resgateGraos.graos, 'Resgate no pedido #' + id, 'redeem');
          });
        }
        var self = this;
        return p.then(function () {
          // Cartão na demonstração: aprovado na hora.
          return cartao ? self.simularPagamento(id) : order;
        }).then(function (pedido) {
          return { pedido: pedido };
        });
      },

      // Aprova o pagamento e credita os Grãos (uma única vez).
      simularPagamento: function (id) {
        var all = allOrders();
        var order = all.filter(function (o) {
          return o.id === id;
        })[0];
        if (!order) return falha('Pedido não encontrado.');
        order.status = 'pago';
        var creditar = order.userId && order.graosGanhos && !order.graosCreditados;
        order.graosCreditados = true;
        storage.set('pedidos', all);
        if (creditar && order.userId === sessionUserId()) {
          return patchUser(function (u) {
            lancarGraos(u, order.graosGanhos, 'Pedido #' + order.id, 'shopping_bag');
          }).then(function () {
            return order;
          });
        }
        return Promise.resolve(order);
      },

      // Sem servidor, a mensagem é guardada no aparelho e enviada por e-mail.
      contato: function (dados) {
        var protocolo = 'AT' + String(Date.now()).slice(-8);
        var msgs = storage.get('mensagens', []);
        msgs.unshift({ protocolo: protocolo, data: new Date().toISOString(), assunto: dados.assunto });
        storage.set('mensagens', msgs.slice(0, 20));
        return Promise.resolve({ protocolo: protocolo, enviado: false });
      },
    };
  };
})();
