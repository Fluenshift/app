# Typed stub for the red commit: a root process that answers the health check and nothing else.
FROM node:26.13.0-slim@sha256:5adad64f9a1fca2d51972caa65983634c8a774eb300d72b20f7f2a0f60368072
CMD ["node", "-e", "require('node:http').createServer((request, response) => { response.statusCode = request.url === '/api/health' ? 200 : 501; response.end('{}'); }).listen(3000)"]
