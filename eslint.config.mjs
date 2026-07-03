import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/.agents/**',
      '**/.impeccable/**',
      '.claude/**',
      'apps/**',
      'packages/**',
    ],
  },
  eslint.configs.recommended,
);
