import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { importX } from 'eslint-plugin-import-x';
import jsdoc from 'eslint-plugin-jsdoc';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import sonarjs from 'eslint-plugin-sonarjs';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const MAX_PARAMS = 5;

const tooManyParams = [
  'FunctionDeclaration',
  'ArrowFunctionExpression',
  'TSDeclareFunction',
  'TSMethodSignature',
  'MethodDefinition[kind!="constructor"] > FunctionExpression',
  'MethodDefinition[kind!="constructor"] > TSEmptyBodyFunctionExpression',
  'TSAbstractMethodDefinition[kind!="constructor"] > TSEmptyBodyFunctionExpression'
].map(node => ({
  selector: `${node}[params.length>${MAX_PARAMS}]`,
  message: `More than ${MAX_PARAMS} parameters — pass a single readonly params object (code-style.md).`
}));

const noNumberCast = {
  selector: 'CallExpression[callee.name="Number"]',
  message: 'Cast with unary plus: +value (code-style.md).'
};

export default defineConfig(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/migrations/**']
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  sonarjs.configs.recommended,
  jsdoc.configs['flat/recommended-typescript'],
  prettierRecommended,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver({ alwaysTryTypes: true })],
      jsdoc: { tagNamePreference: { var: 'var' } }
    },
    rules: {
      curly: ['error', 'all'],
      'brace-style': ['error', '1tbs'],
      'padded-blocks': ['error', 'never'],
      'object-curly-spacing': ['error', 'always'],
      'max-len': ['error', { code: 140, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreUrls: true, ignoreRegExpLiterals: true }],
      'no-inline-comments': 'error',
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: ['return', 'if', 'for', 'while', 'do', 'switch', 'try', 'class', 'function'] },
        { blankLine: 'always', prev: ['const', 'let'], next: '*' },
        { blankLine: 'any', prev: ['const', 'let'], next: ['const', 'let'] },
        { blankLine: 'always', prev: ['if', 'for', 'while', 'do', 'switch', 'try'], next: '*' }
      ],
      'no-restricted-syntax': ['error', ...tooManyParams, noNumberCast],

      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/unbound-method': ['error', { ignoreStatic: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-extraneous-class': 'off',

      'import-x/no-cycle': 'warn',
      'import-x/no-extraneous-dependencies': ['error', { devDependencies: true }],
      'import-x/no-named-as-default-member': 'off',
      'import-x/no-unresolved': 'off',
      'import-x/namespace': 'off',

      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/no-small-switch': 'off',
      'sonarjs/no-useless-catch': 'off',
      'sonarjs/no-unused-vars': 'off',
      'sonarjs/no-hardcoded-passwords': 'off',
      'sonarjs/cognitive-complexity': ['error', 30],
      'sonarjs/no-nested-functions': ['error', { threshold: 6 }],
      'sonarjs/todo-tag': 'warn',
      'sonarjs/fixme-tag': 'warn',
      'sonarjs/no-commented-code': 'warn',

      'jsdoc/require-jsdoc': [
        'error',
        {
          require: { ClassDeclaration: true, MethodDefinition: true, FunctionDeclaration: true },
          checkConstructors: false
        }
      ],
      'jsdoc/sort-tags': [
        'error',
        {
          tagSequence: [
            { tags: ['param'] },
            { tags: ['template', 'type', 'var', 'deprecated'] },
            { tags: ['throws'] },
            { tags: ['returns'] }
          ]
        }
      ],
      'jsdoc/require-returns-type': 'off',
      'jsdoc/require-param-type': 'off',
      'jsdoc/no-types': 'off',
      'jsdoc/check-tag-names': ['error', { definedTags: ['var'] }],
      'jsdoc/tag-lines': ['error', 'any', { startLines: 1 }],
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-returns-description': 'off',
      'jsdoc/require-property-description': 'off'
    }
  },
  {
    files: ['*.mjs', '*.mts', '**/scripts/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      'import-x/no-named-as-default': 'off'
    }
  },
  {
    files: ['**/controllers/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', noNumberCast]
    }
  },
  {
    files: ['**/*.spec.ts'],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      'no-restricted-syntax': 'off',
      '@typescript-eslint/unbound-method': 'off'
    }
  }
);
