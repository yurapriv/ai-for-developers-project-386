import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: process.env.OPENAPI_INPUT ?? './api/generated/openapi.yaml',
  output: process.env.SDK_OUTPUT ?? './frontend/src/api/generated',
  plugins: [
    '@hey-api/typescript',
    { name: '@hey-api/client-fetch', bundle: true, baseUrl: false },
    '@hey-api/sdk',
  ],
});
