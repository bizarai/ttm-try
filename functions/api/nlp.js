// 3. /functions/api/nlp.js - Proxy for Gemini API
export async function onRequest(context) {
  const { request, env } = context;
  
  // Only accept POST requests
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Only POST requests are allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Get input text from request body
    const requestData = await request.json();
    const inputText = requestData.input;
    
    if (!inputText) {
      return new Response(JSON.stringify({ error: 'Input text is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Use environment variable for API key
    const geminiApiKey = env.GEMINI_API_KEY;
    
    // The prompt for the Gemini API
    const prompt = `
You are a location and route information extraction system for a map application.

TASK: Analyze this text and extract any location information and routing preferences.

INPUT: "${inputText}"

INSTRUCTIONS:
1. First, determine if this is a request for directions or a route between locations.
2. Identify all location names mentioned in the text.
3. If it's a route request, determine the order of travel between locations.
4. Identify the mode of transportation if specified (driving, walking, cycling, transit).
5. Extract any routing preferences (avoid highways, scenic route, fastest route, etc.).

Return a valid JSON object with the following structure:
{
  "isRouteRequest": true/false,
  "locations": ["Location1", "Location2", ...],
  "travelMode": "driving|walking|cycling|transit",
  "preferences": ["avoid highways", "scenic route", etc.],
  "message": "If not a route request, provide a short helpful message to guide the user"
}
`;
    
    // Make request to Gemini API
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${geminiApiKey}`
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          topP: 0.8,
          topK: 40
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Gemini API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No response from Gemini API');
    }
    
    // Extract the JSON from the response
    const responseText = data.candidates[0].content.parts[0].text;
    
    // Try to parse the JSON response
    try {
      // Find JSON in the response
      const jsonMatch = responseText.match(/{[\s\S]*?}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      throw new Error('Could not parse JSON from Gemini response');
    } catch (parseError) {
      // Fallback with basic analysis
      const isLikelyRouteRequest = /route|path|way|directions|from|to|travel|trip|journey|drive|walk|map|between/i.test(inputText);
      
      // Extract potential locations (basic implementation)
      const placeNameRegex = /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\b/g;
      const matches = [...inputText.matchAll(placeNameRegex)];
      let potentialLocations = matches.map(m => m[0]);
      
      // Filter out common non-location capitalized words
      const nonLocationWords = [
        'I', 'You', 'He', 'She', 'They', 'We', 'It', 'Who', 'What', 'Where', 'When', 'Why', 'How',
        'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
        'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
      ];
      
      potentialLocations = potentialLocations.filter(loc => !nonLocationWords.includes(loc));
      
      const result = {
        isRouteRequest: isLikelyRouteRequest,
        locations: potentialLocations,
        travelMode: inputText.match(/\b(walking|cycling|driving|transit)\b/i)?.[1]?.toLowerCase() || 'driving',
        preferences: [],
        message: isLikelyRouteRequest 
          ? "I had trouble understanding the details, but I'll try to map what I understood."
          : "This doesn't appear to be a route request. Try something like 'Show me a route from New York to Washington DC'."
      };
      
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Failed to process NLP request',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
