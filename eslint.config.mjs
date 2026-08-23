import eslint from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import tsdoc from 'eslint-plugin-tsdoc';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  {
    // scripts/types.ts is written by `bun run gen-types`. A comment or a fix applied there is gone
    // on the next run of the generator, so the file is not lintable material.
    ignores: ['node_modules/', 'scripts/types.ts'],
  },

  // The doc comment gate. eslint-plugin-tsdoc checks syntax only: an unrecognised tag, a malformed
  // inline tag, a misplaced modifier. The jsdoc rules cover what it does not, which is whether the
  // tags that are there say anything.
  {
    files: ['scripts/**/*.ts'],
    plugins: { jsdoc, tsdoc },
    rules: {
      'tsdoc/syntax': 'error',
      'jsdoc/check-param-names': 'error',
      // A `@param {string}` in a TypeScript file is the type stated twice, once where the compiler
      // checks it and once where it does not.
      'jsdoc/no-types': 'error',
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-returns-description': 'error',
      // The standard scopes this to exported declarations. Neither script exports anything, and
      // both are entry points run by `bun run`, so the file is the public surface and every
      // top-level function in it is covered.
      'jsdoc/require-jsdoc': [
        'warn',
        {
          require: { FunctionDeclaration: true },
          contexts: ['TSInterfaceDeclaration', 'TSTypeAliasDeclaration'],
        },
      ],
    },
  },
);
