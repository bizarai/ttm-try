// Enhanced /functions/api/mapbox-token.js with security best practices

export async function onRequest(context) {
  const { request, env } = context;
  
  // Check if the request origin is from our own domain
  const requestOrigin = request.headers.get('Origin');
  const allowedOrigins = [
    'https://your-domain.com',       // Your production domain
    'https://your-test-domain.com',  // Your test domain
    'http://localhost:8788'          // Local development
  ];
  
  // Check if this is a valid origin
  if (!allowedOrigins.includes(requestOrigin)) {
    return new Response(JSON.stringify({ 
      error: 'Unauthorized' 
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Add CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': requestOrigin,
    'Access-Control-Allow-Methods': 'GET',
    'Cache-Control': 'max-age=3600' // Cache for 1 hour
  };
  
  // Return the Mapbox token from environment variables
  return new Response(JSON.stringify({ 
    token: env.MAPBOX_PUBLIC_TOKEN 
  }), { headers });
}
