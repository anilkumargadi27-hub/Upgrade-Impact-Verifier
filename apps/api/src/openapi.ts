export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'UpgradeLens API',
    version: '1.0.0',
    description: 'API for UpgradeLens - Upgrade Impact Verifier for Dependency Pull Requests'
  },
  servers: [
    { url: '/api', description: 'Current Origin API' }
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Service liveness and readiness check',
        responses: { '200': { description: 'Healthy service status' } }
      }
    },
    '/system/settings': {
      get: {
        summary: 'System health and integration capability status',
        responses: { '200': { description: 'System configuration' } }
      }
    },
    '/auth/register': {
      post: {
        summary: 'Register a new user account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  name: { type: 'string', minLength: 2 }
                }
              }
            }
          }
        },
        responses: { '201': { description: 'Registration successful' } }
      }
    },
    '/auth/login': {
      post: {
        summary: 'Log in with email and password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' }
                }
              }
            }
          }
        },
        responses: { '200': { description: 'Login successful' } }
      }
    },
    '/auth/logout': {
      post: {
        summary: 'Log out and invalidate session',
        responses: { '200': { description: 'Logout successful' } }
      }
    },
    '/auth/me': {
      get: {
        summary: 'Get current authenticated user profile',
        responses: { '200': { description: 'Current user data' } }
      }
    },
    '/fixtures': {
      get: {
        summary: 'Get available built-in fixture demonstration scenarios',
        responses: { '200': { description: 'List of fixture scenarios' } }
      }
    },
    '/projects': {
      get: {
        summary: 'List user projects with analysis counts',
        responses: { '200': { description: 'List of projects' } }
      },
      post: {
        summary: 'Create a new project',
        responses: { '201': { description: 'Project created' } }
      }
    },
    '/analyses/fixture': {
      post: {
        summary: 'Launch an analysis pipeline on a built-in fixture scenario',
        responses: { '201': { description: 'Analysis queued' } }
      }
    },
    '/analyses/pr': {
      post: {
        summary: 'Launch an analysis on a GitHub Pull Request URL',
        responses: { '201': { description: 'Analysis queued' } }
      }
    },
    '/analyses/manual': {
      post: {
        summary: 'Launch an analysis for a repository, dependency, and target version',
        responses: { '201': { description: 'Analysis queued' } }
      }
    },
    '/analyses': {
      get: {
        summary: 'List analyses with pagination and filters',
        responses: { '200': { description: 'List of analyses' } }
      }
    },
    '/analyses/{id}': {
      get: {
        summary: 'Get analysis status, findings, executions, and report snapshot',
        responses: { '200': { description: 'Analysis detail' } }
      }
    },
    '/analyses/{id}/cancel': {
      post: {
        summary: 'Cancel an active analysis job',
        responses: { '200': { description: 'Cancellation initiated' } }
      }
    },
    '/analyses/{id}/rerun': {
      post: {
        summary: 'Rerun an analysis creating a new linked attempt',
        responses: { '201': { description: 'New linked analysis queued' } }
      }
    },
    '/analyses/{id}/export/json': {
      get: {
        summary: 'Download full analysis report as JSON',
        responses: { '200': { description: 'JSON download' } }
      }
    },
    '/analyses/{id}/export/markdown': {
      get: {
        summary: 'Download full analysis report as Markdown',
        responses: { '200': { description: 'Markdown download' } }
      }
    },
    '/analyses/{id}/events': {
      get: {
        summary: 'Server-Sent Events stream for live analysis progress',
        responses: { '200': { description: 'SSE stream' } }
      }
    }
  }
};
