// 2. /functions/api/directions.js - Proxy for directions requests
export async function onRequest(context) {
  const { request, env } = context;
  
  // Extract parameters
  const url = new URL(request.url);
  const coordinates = url.searchParams.get('coordinates');
  const profile = url.searchParams.get('profile') || 'driving';
  const options = url.searchParams.get('options') || '';
  
  if (!coordinates) {
    return new Response(JSON.stringify({ error: 'Coordinates parameter is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Use environment variable for API key
  const mapboxToken = env.MAPBOX_API_KEY;
  
  // Build the Mapbox API URL
  const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?geometries=geojson&access_token=${mapboxToken}${options}`;
  
  try {
    const response = await fetch(directionsUrl);
    const data = await response.json();
    
    // Return the response to the client
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to get directions' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
