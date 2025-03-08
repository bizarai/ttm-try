// 1. /functions/api/geocode.js - Proxy for geocoding requests
export async function onRequest(context) {
  const { request, env } = context;
  
  // Extract location from URL or query params
  const url = new URL(request.url);
  const location = url.searchParams.get('location');
  
  if (!location) {
    return new Response(JSON.stringify({ error: 'Location parameter is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Use environment variable for API key
  const mapboxToken = env.MAPBOX_API_KEY;
  
  // Make request to Mapbox API
  const geocodingUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=${mapboxToken}`;
  
  try {
    const response = await fetch(geocodingUrl);
    const data = await response.json();
    
    // Return the response to the client
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to geocode location' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
