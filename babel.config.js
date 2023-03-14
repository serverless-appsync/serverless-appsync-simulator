module.exports = {
  plugins: [
    '@babel/plugin-transform-modules-commonjs',
    [
      'babel-plugin-inline-import',
      {
        extensions: ['.vtl'],
      },
    ],
  ],
  presets: [
    [
      '@babel/preset-env',
      {
        shippedProposals: true,
        targets: { node: '8.12' },
      },
    ],
  ],
  env: {
    test: {
      presets: [
        [
          '@babel/preset-env',
          {
            targets: { node: 'current' },
          },
        ],
      ],
    },
  },
};
