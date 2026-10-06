import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * ESLint flat config. Formatting and import sorting are handled by Biome, so
 * this only carries the Next.js/React rules.
 */
const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      '.next/**',
      'out/**',
      'node_modules/**',
      'lib/graphql-env.d.ts',
      'playwright-report/**',
      'test-results/**',
    ],
  },
];

export default config;
