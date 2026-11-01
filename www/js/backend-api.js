/**
 * Santo Cacau — back-end REAL: conversa com o servidor (pasta server/).
 *
 * Ativado quando SC_CONFIG.apiUrl é uma string ('' = mesmo endereço do site).
 * A sessão é um token guardado no aparelho e enviado no cabeçalho
 * Authorization; os dados do usuário ficam em cache para leitura imediata e
 * são confirmados no servidor a cada página (refresh).
 */
(function () {
  'use strict';

  window.SC_BACKENDS = window.SC_BACKENDS || {};

  window.SC_BACKENDS.api = function (ctx) {
    var storage = ctx.storage;
    var base = String(window.SC_CONFIG.apiUrl || '').replace(/\/$/, '');

    function token() {
      return storage.get('token', null) || storage.get('token', null, true);
    }
    function salvarSessao(dados, lembrar) {
      storage.remove('token');
      storage.remove('token', true);
      storage.set('token', dados.token, !lembrar);
      storage.set('usuario', dados.usuario);
      return dados.usuario;
    }
    function limparSessao() {
      storage.remove('token');
      storage.remove('token', true);
      storage.remove('usuario');
    }
    function tokensPedidos() {
      return storage.get('pedidos-tokens', {});
    }

    function req(metodo, caminho, corpo) {
      var headers = { Accept: 'application/json' };
      if (corpo) headers['Content-Type'] = 'application/json';
      var t = token();
      if (t) headers.Authorization = 'Bearer ' + t;
      return fetch(base + caminho, { method: metodo, headers: headers, body: corpo ? JSON.stringify(corpo) : undefined })
        .catch(function () {
          throw new Error('Sem conexão com o servidor. Verifique sua internet e tente de novo.');
        })
        .then(function (res) {
          return res
            .json()
            .catch(function () {
              return {};
            })
            .then(function (json) {
              if (res.status === 401 && t) {
                limparSessao();
                ctx.events.emit('auth');
              }
              if (!res.ok) throw new Error(json.erro || 'Não foi possível concluir. Tente novamente.');
              return json;
            });
        });
    }

    // Atualiza o cache do usuário a partir da resposta do servidor.
    function comUsuario(json) {
      if (json.usuario) {
        storage.set('usuario', json.usuario);
        ctx.events.emit('auth');
      }
      return json;
    }

    return {
      modo: 'api',
      usuarioAtual: function () {
        return token() ? storage.get('usuario', null) : null;
      },
      refresh: function () {
        if (!token()) return Promise.resolve(null);
        return req('GET', '/api/eu')
          .then(comUsuario)
          .then(function (json) {
            return json.usuario;
          })
          .catch(function () {
            return storage.get('usuario', null);
          });
      },

      register: function (dados) {
        return req('POST', '/api/auth/cadastro', dados).then(function (json) {
          return salvarSessao(json, true);
        });
      },
      login: function (identificador, senha, lembrar) {
        return req('POST', '/api/auth/login', { identificador: identificador, senha: senha }).then(function (json) {
          return salvarSessao(json, lembrar);
        });
      },
      logout: function () {
        return req('POST', '/api/auth/logout')
          .catch(function () {})
          .then(limparSessao);
      },
      changePassword: function (atual, nova) {
        return req('POST', '/api/auth/senha', { atual: atual, nova: nova });
      },
      recuperarSenha: function (email) {
        return req('POST', '/api/auth/recuperar', { email: email });
      },
      redefinirSenha: function (codigo, senha) {
        return req('POST', '/api/auth/redefinir', { token: codigo, senha: senha });
      },
      exportData: function () {
        return req('GET', '/api/eu/exportar');
      },
      deleteAccount: function () {
        return req('DELETE', '/api/eu').then(limparSessao);
      },

      atualizarPerfil: function (dados) {
        return req('PATCH', '/api/eu', dados)
          .then(comUsuario)
          .then(function (j) {
            return j.usuario;
          });
      },
      marketing: function (aceito) {
        return req('POST', '/api/eu/marketing', { aceito: !!aceito })
          .then(comUsuario)
          .then(function (j) {
            return j.usuario;
          });
      },
      resgatar: function (recompensaId) {
        return req('POST', '/api/eu/resgates', { recompensaId: recompensaId })
          .then(comUsuario)
          .then(function (j) {
            return { user: j.usuario, codigo: j.codigo };
          });
      },
      agendar: function (experienciaId, dados) {
        return req('POST', '/api/eu/agendamentos', Object.assign({ experienciaId: experienciaId }, dados))
          .then(comUsuario)
          .then(function (j) {
            return j.usuario;
          });
      },
      cancelarAgendamento: function (id) {
        return req('DELETE', '/api/eu/agendamentos/' + encodeURIComponent(id))
          .then(comUsuario)
          .then(function (j) {
            return j.usuario;
          });
      },

      pedidos: function () {
        return req('GET', '/api/pedidos').then(function (j) {
          return j.pedidos;
        });
      },
      pedido: function (id) {
        var t = tokensPedidos()[id];
        return req('GET', '/api/pedidos/' + encodeURIComponent(id) + (t ? '?token=' + encodeURIComponent(t) : '')).then(
          function (j) {
            return j.pedido;
          },
          function (err) {
            if (/não encontrado/i.test(err.message)) return null;
            throw err;
          }
        );
      },
      criarPedido: function (info) {
        return req('POST', '/api/pedidos', info).then(function (j) {
          // Visitantes acessam o pedido com um código secreto guardado aqui.
          var mapa = tokensPedidos();
          mapa[j.pedido.id] = j.pedido.token;
          storage.set('pedidos-tokens', mapa);
          if (j.usuario) comUsuario(j);
          return j;
        });
      },
      simularPagamento: function (id) {
        var t = tokensPedidos()[id];
        return req('POST', '/api/pedidos/' + encodeURIComponent(id) + '/simular-pagamento', { token: t }).then(function (j) {
          comUsuario(j);
          return j.pedido;
        });
      },
      contato: function (dados) {
        return req('POST', '/api/contato', dados).then(function (j) {
          return { protocolo: j.protocolo, enviado: true };
        });
      },
    };
  };
})();
