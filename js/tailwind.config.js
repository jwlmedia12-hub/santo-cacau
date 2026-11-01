// Tema do Tailwind (CDN). As cores usam as variáveis definidas em theme.js,
// para que os modos de alto contraste troquem a paleta inteira de uma vez.
// Tamanhos em rem: acompanham o ajuste de texto do navegador e do painel.
(function () {
  var colors = {};
  window.SC_THEME.tokens.forEach(function (token) {
    colors[token] = 'rgb(var(--c-' + token + ') / <alpha-value>)';
  });

  tailwind.config = {
    theme: {
      extend: {
        colors: colors,
        borderRadius: { DEFAULT: '0.25rem', lg: '0.5rem', xl: '0.75rem', full: '9999px' },
        spacing: {
          'space-xs': '0.25rem',
          'space-sm': '0.5rem',
          'space-md': '1rem',
          'space-lg': '1.5rem',
          'space-xl': '2rem',
          margin: '1rem',
          gutter: '1rem',
        },
        fontFamily: {
          sans: ['var(--fonte-texto)'],
          texto: ['var(--fonte-texto)'],
          titulo: ['var(--fonte-titulo)'],
        },
        fontSize: {
          'label-sm': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.03em', fontWeight: '700' }],
          'label-md': ['0.8125rem', { lineHeight: '1.125rem', letterSpacing: '0.02em', fontWeight: '600' }],
          'label-lg': ['0.9375rem', { lineHeight: '1.375rem', letterSpacing: '0.01em', fontWeight: '600' }],
          'body-sm': ['0.8125rem', { lineHeight: '1.25rem' }],
          'body-md': ['0.9375rem', { lineHeight: '1.5rem' }],
          'body-lg': ['1rem', { lineHeight: '1.625rem' }],
          'title-md': ['1rem', { lineHeight: '1.5rem', fontWeight: '600' }],
          'title-lg': ['1.125rem', { lineHeight: '1.625rem', fontWeight: '600' }],
          'headline-md': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],
          'headline-lg': ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],
          'headline-xl': ['1.75rem', { lineHeight: '2.25rem', letterSpacing: '-0.01em', fontWeight: '700' }],
        },
      },
    },
  };
})();
