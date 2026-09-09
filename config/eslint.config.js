import { createEslintConfig } from '@planttheidea/build-tools';

export default createEslintConfig({
  config: 'config',
  react: false,
  source: 'src',
  configs: [
    {
      files: ['__tests__/**/*.ts'],
      rules: {
        // `expect.any` and `expect.objectContaining` are typed as `any`, so every expected
        // shape built out of them reads as an unsafe assignment.
        '@typescript-eslint/no-unsafe-assignment': 'off',
      },
    },
  ],
});
