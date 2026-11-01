// Carrega o catálogo, as regras e os dados da empresa direto dos arquivos do
// site (www/js), para servidor e site usarem sempre a mesma fonte.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const pasta = path.join(__dirname, '..', 'www', 'js');
const contexto = { window: {} };
vm.createContext(contexto);
for (const arquivo of ['empresa.js', 'data.js']) {
  vm.runInContext(fs.readFileSync(path.join(pasta, arquivo), 'utf8'), contexto, { filename: arquivo });
}

const DATA = contexto.window.SC_DATA;
const EMPRESA = contexto.window.SC_EMPRESA;
const PRICING = require(path.join(pasta, 'pricing.js'));

function produto(id) {
  return DATA.produtos.find((p) => p.id === id) || null;
}

module.exports = {
  DATA,
  EMPRESA,
  produto,
  calcular: (itens, opts, user, pedidosAnteriores) => PRICING.calcular(DATA, itens, opts, user, pedidosAnteriores),
  nivel: (graosTotal) => PRICING.nivel(DATA, graosTotal),
  nivelIndice: (id) => PRICING.nivelIndice(DATA, id),
  isCapitalSP: PRICING.isCapitalSP,
};
