import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * 零依赖策略（ADR-001）约束的是**运行时**依赖，不约束开发期工具链。
 * 因此这里可以用 typescript-eslint —— 它不进产物。
 *
 * 规则集刻意保持小：这个仓库的可信度来自"代码可被完整审计"，
 * 一套庞大的 lint 配置本身就是需要被审计的东西。
 */
export default tseslint.config(
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    rules: {
      // 契约要求：未使用的参数用 `_` 前缀显式表达"故意不用"。
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // `any` 会绕过契约里的所有类型约束；本仓库不接受。
      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    // bin 壳与门禁脚本是 Node 环境下的 ESM，不是 TS。
    files: ['bin/**/*.js', 'scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
      },
    },
  },
);
