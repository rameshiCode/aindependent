// // frontend-rn/scripts/openapi-config.ts
// export default {
//     input: 'http://127.0.0.1:8000/api/v1/openapi.json',
//     output: './src/api',
//     filename: 'apiClient.ts',
//     templates: './scripts/api-templates', // Optional custom templates
//     modular: true, // Generate separate files for models/routes
//     httpClientType: 'fetch', // Use fetch API
//     defaultResponseAsSuccess: false,
//     generateClient: true,
//     generateRouteTypes: true,
//     generateResponses: true,
//     toJS: false, // Keep TypeScript
//     extractRequestParams: true,
//     unwrapResponseData: true,
//     prettier: {
//       // Prettier options for generated code
//       printWidth: 100,
//       tabWidth: 2,
//       trailingComma: 'all',
//       parser: 'typescript',
//     },
//   };