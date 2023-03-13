const esmPackages = ['globby', 'slash'];

/** @type {import('jest').Config} */
module.exports = {
  transformIgnorePatterns: [`node_modules/(?!(${esmPackages.join('|')})/)`],
  verbose: true,
};
