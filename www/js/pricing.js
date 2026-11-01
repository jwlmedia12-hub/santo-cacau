/**
 * Santo Cacau — regras de preço compartilhadas entre o site e o servidor.
 *
 * O navegador usa para mostrar os valores na hora; o servidor usa o mesmo
 * código para recalcular tudo ao criar o pedido (o valor cobrado nunca vem
 * do navegador). Não depende de DOM nem de armazenamento.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SC_PRICING = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var moneyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function money(n) {
    return moneyFmt.format(n || 0);
  }
  function digits(v) {
    return String(v || '').replace(/\D/g, '');
  }
  function centavos(n) {
    return Math.round(n * 100) / 100;
  }

  function nivel(DATA, graosTotal) {
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

  function nivelIndice(DATA, id) {
    for (var i = 0; i < DATA.niveis.length; i++) if (DATA.niveis[i].id === id) return i;
    return 0;
  }

  function isCapitalSP(cep) {
    var n = Number(digits(cep));
    return (n >= 1000000 && n <= 5999999) || (n >= 8000000 && n <= 8499999);
  }

  /**
   * itens: [{ id, qtd, presente, produto }]
   * opts: { cupom, usarGraos, entrega, cep }
   * user: { graos, graosTotal } ou null
   * pedidosAnteriores: número de pedidos já feitos pelo usuário
   */
  function calcular(DATA, itens, opts, user, pedidosAnteriores) {
    var regras = DATA.regras;
    opts = opts || {};
    var tier = user ? nivel(DATA, user.graosTotal) : null;
    var vip = !!(tier && tier.indice >= nivelIndice(DATA, 'ouro'));
    var avisos = [];

    itens = itens.map(function (i) {
      return { id: i.id, qtd: i.qtd, presente: !!i.presente, produto: i.produto, total: centavos(i.produto.preco * i.qtd) };
    });
    var quantidade = itens.reduce(function (n, i) {
      return n + i.qtd;
    }, 0);
    var subtotal = centavos(
      itens.reduce(function (n, i) {
        return n + i.total;
      }, 0)
    );
    var embalagemItens = itens.reduce(function (n, i) {
      return n + (i.presente ? i.qtd : 0);
    }, 0);
    var embalagem = vip ? 0 : embalagemItens * regras.embalagemPresente;

    // Cupom
    var cupom = null;
    var descontoCupom = 0;
    var codigo = String(opts.cupom || '').trim().toUpperCase();
    if (codigo) {
      var c = DATA.cupons[codigo];
      if (!c) avisos.push({ campo: 'cupom', msg: 'Cupom "' + codigo + '" não encontrado.' });
      else if (subtotal < c.minimo)
        avisos.push({ campo: 'cupom', msg: 'O cupom ' + codigo + ' vale para compras acima de ' + money(c.minimo) + '.' });
      else if (c.primeiraCompra && user && pedidosAnteriores > 0)
        avisos.push({ campo: 'cupom', msg: 'O cupom ' + codigo + ' é válido apenas na primeira compra.' });
      else {
        cupom = { codigo: codigo, descricao: c.descricao };
        descontoCupom = c.tipo === 'valor' ? c.valor : centavos((subtotal * c.valor) / 100);
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
      freteMotivo = 'Compras acima de ' + money(freteRegra.gratisAcima);
    }
    if (!itens.length) frete = 0;

    var total = centavos(Math.max(0, subtotal - descontos) + embalagem + frete);
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
  }

  return { calcular: calcular, nivel: nivel, nivelIndice: nivelIndice, isCapitalSP: isCapitalSP, money: money };
});
