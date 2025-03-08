// Create a new file: /functions/api/mapbox-token.js

export async function onRequest(context) {
  const { env } = context;
  
  // Return the Mapbox token from environment variables
  return new Response(JSON.stringify({ 
    token: env.MAPBOX_PUBLIC_TOKEN 
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
