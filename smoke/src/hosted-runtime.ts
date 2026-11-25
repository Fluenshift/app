// The Compose file that runs the image in the hosted profile for the hosted Docker smoke: the
// application in production beside a Postgres 17 server, with every setting a hosted production
// server needs (AGENTS.md, Code). The secrets are random per run and never leave the scratch
// directory.
import { randomLetters, REPOSITORY_ROOT } from "./docker";

/** A Compose file that publishes the application on the given loopback port. */
export const hostedRuntime = (hostPort: number) => {
  const password = randomLetters(24);
  return `services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: app
      POSTGRES_PASSWORD: ${password}
      POSTGRES_USER: app
    healthcheck:
      test: ["CMD", "pg_isready", "--username", "app", "--dbname", "app"]
      interval: 2s
      timeout: 5s
      retries: 30
  app:
    build:
      context: ${JSON.stringify(REPOSITORY_ROOT)}
      dockerfile: apps/server/Dockerfile
    depends_on:
      db:
        condition: service_healthy
    environment:
      CLIENT_IP_HEADER: x-forwarded-for
      DATABASE_URL: postgres://app:${password}@db:5432/app
      DEPLOY_PROFILE: hosted
      IP_HASH_SALT: ${randomLetters(32)}
      NODE_ENV: production
      SERVER_HOST: 0.0.0.0
      SESSION_SECRET: ${randomLetters(48)}
      SITE_URL: https://grifando.example
    ports:
      - "127.0.0.1:${String(hostPort)}:3000"
`;
};
