export class ApiError extends Error {
  constructor(status, code, message, headers = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export function jsonResponse(value, status = 200, headers = {}) {
  return new Response(value === null ? null : JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Netlify-CDN-Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...headers,
    },
  });
}

export function errorResponse(error) {
  if (error instanceof ApiError) {
    return jsonResponse({ error: { code: error.code, message: error.message } }, error.status, error.headers);
  }
  return jsonResponse({ error: { code: 'UNAVAILABLE', message: 'The backend is temporarily unavailable.' } }, 503);
}
