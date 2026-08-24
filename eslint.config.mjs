import jsdoc from 'eslint-plugin-jsdoc';
import tsdoc from 'eslint-plugin-tsdoc';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // scripts/types.ts is written by `bun run gen-types`. A comment or a fix applied there is gone
    // on the next run of the generator.
    ignores: ['node_modules/', 'scripts/types.ts'],
  },

  // The doc comment gate from TimSchoenle/actions docs/doc-comments/TYPESCRIPT.md. No other rules
  // are configured here: this is the only lint the repository runs, and mixing a style ruleset in
  // would make a failure ambiguous about which one broke.
  {
    files: ['scripts/**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    plugins: { jsdoc, tsdoc },
    rules: {
      'tsdoc/syntax': 'error',
      'jsdoc/check-param-names': 'error',
      // A `@param {string}` in a TypeScript file states the type twice, once where the compiler
      // checks it and once where it does not.
      'jsdoc/no-types': 'error',
      // Both rules fire only on a tag that is already there, which makes them the check against a
      // `@param` or `@returns` written to satisfy a linter rather than to answer a reader.
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-returns-description': 'error',
      // The standard scopes this to exported declarations. Neither script exports anything, and
      // both are entry points invoked through `bun run`, so the module is the surface and every
      // top-level function in it is covered instead. `--max-warnings 0` in the `lint` script is
      // what turns the severity the standard specifies into a failing build.
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
