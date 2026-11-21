// The Compose file that runs the image in the hosted profile for the hosted Docker smoke.

/** A Compose file that publishes the application on the given loopback port. */
export const hostedRuntime = (repositoryRoot: string, hostPort: number) =>
  `services:
  app:
    build:
      context: ${JSON.stringify(repositoryRoot)}
      dockerfile: apps/server/Dockerfile
    environment:
      DATA_DIRECTORY: /tmp/pglite
      NODE_ENV: production
      SERVER_HOST: 0.0.0.0
    ports:
      - "127.0.0.1:${String(hostPort)}:3000"
`;
