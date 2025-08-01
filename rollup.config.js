import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

const createConfig = (input, name, external = []) => ({
  input,
  output: [
    {
      file: `dist/${name}.js`,
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: `dist/${name}.esm.js`,
      format: 'esm',
      sourcemap: true,
    },
  ],
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: false,
    }),
    typescript({
      tsconfig: './tsconfig.json',
    }),
    terser(),
  ],
  external,
});

export default createConfig('src/index.ts', 'index', [
  '@opentelemetry/api',
  '@opentelemetry/sdk-trace-web',
  '@opentelemetry/sdk-metrics',
  '@opentelemetry/context-zone',
  '@opentelemetry/core',
  '@opentelemetry/auto-instrumentations-web',
  '@opentelemetry/exporter-trace-otlp-http',
  '@opentelemetry/exporter-metrics-otlp-http',
  '@opentelemetry/instrumentation',
  '@opentelemetry/instrumentation-document-load',
  '@opentelemetry/instrumentation-fetch',
  '@opentelemetry/instrumentation-user-interaction',
  '@opentelemetry/instrumentation-xml-http-request',
  '@opentelemetry/semantic-conventions',
  '@opentelemetry/resources'
]);