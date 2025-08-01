import typescript from 'rollup-plugin-typescript2'
import { terser } from '@rollup/plugin-terser'

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true
    },
    {
      file: 'dist/index.esm.js', 
      format: 'esm',
      sourcemap: true
    }
  ],
  plugins: [
    typescript({
      typescript: require('typescript'),
      tsconfig: './tsconfig.json'
    }),
    terser()
  ],
  external: [
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
  ]
}