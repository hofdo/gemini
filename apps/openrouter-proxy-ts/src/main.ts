import { loadLocalEnv } from './app/load-local-env';
import { buildApp } from './app/app';

loadLocalEnv();

const port = Number(process.env['PORT'] ?? 8001);
const host = process.env['HOST'] ?? '0.0.0.0';
const app = buildApp();

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
