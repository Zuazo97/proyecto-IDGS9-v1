import fs from 'node:fs';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';

const spec = YAML.parse(fs.readFileSync(new URL('./openapi.yaml', import.meta.url), 'utf8'));

/** Swagger UI en /api/docs y el JSON (importable en Postman/Insomnia) en /api/docs.json */
export function mountDocs(app) {
  app.get('/api/docs.json', (_req, res) => res.json(spec));
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'API IDGS 9° — UTR',
      swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
    }),
  );
}
