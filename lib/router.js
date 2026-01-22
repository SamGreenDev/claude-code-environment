/**
 * Simple HTTP router for the Environment UI
 * @author Sam Green <samuel.green2k@gmail.com>
 */

/**
 * Create a new router instance
 */
export function createRouter() {
  const routes = {
    GET: [],
    POST: [],
    PUT: [],
    DELETE: []
  };

  return {
    get(path, handler) {
      routes.GET.push({ path, handler, pattern: pathToPattern(path) });
    },

    post(path, handler) {
      routes.POST.push({ path, handler, pattern: pathToPattern(path) });
    },

    put(path, handler) {
      routes.PUT.push({ path, handler, pattern: pathToPattern(path) });
    },

    delete(path, handler) {
      routes.DELETE.push({ path, handler, pattern: pathToPattern(path) });
    },

    async handle(req, res) {
      const method = req.method;
      const methodRoutes = routes[method] || [];
      const urlPath = req.url.split('?')[0];

      for (const route of methodRoutes) {
        const match = urlPath.match(route.pattern);
        if (match) {
          // Extract params
          req.params = extractParams(route.path, match);

          // Parse query string
          req.query = parseQueryString(req.url);

          // Parse body for POST/PUT
          if (method === 'POST' || method === 'PUT') {
            req.body = await parseBody(req);
          }

          await route.handler(req, res);
          return true;
        }
      }

      return false;
    }
  };
}

/**
 * Convert path pattern to regex
 */
function pathToPattern(path) {
  // Handle wildcard paths
  if (path.includes('*')) {
    const pattern = path
      .replace(/\*/g, '(.+)')
      .replace(/:[^/]+/g, '([^/]+)');
    return new RegExp(`^${pattern}$`);
  }

  // Handle path parameters
  const pattern = path.replace(/:[^/]+/g, '([^/]+)');
  return new RegExp(`^${pattern}$`);
}

/**
 * Extract named parameters from match
 */
function extractParams(path, match) {
  const params = {};
  const paramNames = path.match(/:[^/]+/g) || [];

  paramNames.forEach((name, index) => {
    params[name.slice(1)] = match[index + 1];
  });

  return params;
}

/**
 * Parse query string
 */
function parseQueryString(url) {
  const query = {};
  const queryIndex = url.indexOf('?');

  if (queryIndex !== -1) {
    const queryString = url.slice(queryIndex + 1);
    const pairs = queryString.split('&');

    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key) {
        query[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
      }
    }
  }

  return query;
}

/**
 * Parse request body as JSON
 */
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        resolve({});
      }
    });

    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
export function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Send file response
 */
export function sendFile(res, content, contentType) {
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);
}

/**
 * Get content type for file extension
 */
export function getContentType(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  const types = {
    'html': 'text/html; charset=utf-8',
    'css': 'text/css; charset=utf-8',
    'js': 'application/javascript; charset=utf-8',
    'json': 'application/json; charset=utf-8',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon'
  };
  return types[ext] || 'application/octet-stream';
}

export default { createRouter, sendJson, sendFile, getContentType };
