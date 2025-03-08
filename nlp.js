// Natural Language Processing for Route Visualization with Gemini API

// Constants and configuration
const mapboxToken = 'pk.eyJ1IjoidHVmZmNyZWF0ZSIsImEiOiJjbHU5YXJxeXQwN2J6MmpsMDRvMGJ0dGhsIn0.neijgnnqzQ0aCHzOPrE_MQ';
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY'; // Replace with your actual Gemini API key
const geocodingUrl = 'https://api.mapbox.com/geocoding/v5/mapbox.places/';

// Initialize map
mapboxgl.accessToken = mapboxToken;
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-122.42136449, 37.80176523], // Center the map on San Francisco
  zoom: 8
});

// Add UI elements for messaging
function createUIElements() {
  // Create a container for messages
  const mapContainer = document.getElementById('map').parentElement;
  
  // Add message display element if it doesn't exist
  if (!document.getElementById('message-display')) {
    const messageEl = document.createElement('div');
    messageEl.id = 'message-display';
    messageEl.className = 'message-container';
    messageEl.style.margin = '10px 0';
    messageEl.style.padding = '10px';
    messageEl.style.backgroundColor = '#f8f9fa';
    messageEl.style.border = '1px solid #dee2e6';
    messageEl.style.borderRadius = '4px';
    messageEl.style.display = 'none';
    mapContainer.insertBefore(messageEl, document.getElementById('map'));
  }
  
  // Add loading indicator
  if (!document.getElementById('loading-indicator')) {
    const loadingEl = document.createElement('div');
    loadingEl.id = 'loading-indicator';
    loadingEl.innerHTML = 'Processing...';
    loadingEl.style.display = 'none';
    loadingEl.style.position = 'absolute';
    loadingEl.style.top = '50%';
    loadingEl.style.left = '50%';
    loadingEl.style.transform = 'translate(-50%, -50%)';
    loadingEl.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    loadingEl.style.padding = '10px 20px';
    loadingEl.style.borderRadius = '20px';
    loadingEl.style.zIndex = '1000';
    document.body.appendChild(loadingEl);
  }
  
  // Add styles
  if (!document.getElementById('nlp-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'nlp-styles';
    styleEl.textContent = `
      .message-container {
        transition: all 0.3s ease;
      }
      .location-chip {
        display: inline-block;
        background-color: #e9ecef;
        border-radius: 16px;
        padding: 4px 12px;
        margin: 4px;
        font-size: 14px;
      }
      .location-chip.selected {
        background-color: #007bff;
        color: white;
      }
    `;
    document.head.appendChild(styleEl);
  }
}

// Initialize map layers on load
map.on('load', () => {
  console.log('Map loaded');
  
  // Create UI elements
  createUIElements();
  
  // Add route source and layer
  map.addSource('route', {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: []
      }
    }
  });

  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      'line-color': '#00a0f0',
      'line-width': 3
    }
  });
  
  // Add markers source for location markers
  map.addSource('locations', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: []
    }
  });
  
  map.addLayer({
    id: 'location-points',
    type: 'circle',
    source: 'locations',
    paint: {
      'circle-radius': 8,
      'circle-color': '#B42222',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff'
    }
  });
  
  // Add popups for location points
  map.on('click', 'location-points', (e) => {
    const coordinates = e.features[0].geometry.coordinates.slice();
    const description = e.features[0].properties.description;
    
    new mapboxgl.Popup()
      .setLngLat(coordinates)
      .setHTML(description)
      .addTo(map);
  });
  
  // Change cursor on hover
  map.on('mouseenter', 'location-points', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  
  map.on('mouseleave', 'location-points', () => {
    map.getCanvas().style.cursor = '';
  });
  
  console.log('Layers added');
});

// Event listeners
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');

searchButton.addEventListener('click', () => {
  const inputValue = searchInput.value;
  if (inputValue.trim() === '') {
    displayMessage('Please enter a location or route query.');
    return;
  }
  
  // Show loading indicator
  document.getElementById('loading-indicator').style.display = 'block';
  
  // Process the input text
  processNaturalLanguageInput(inputValue)
    .then(result => {
      // Hide loading indicator
      document.getElementById('loading-indicator').style.display = 'none';
      
      handleProcessedResult(result);
    })
    .catch(error => {
      console.error('Error processing input:', error);
      document.getElementById('loading-indicator').style.display = 'none';
      displayMessage('Sorry, I encountered an error processing your request. Please try again.');
    });
});

// Add enter key support
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    searchButton.click();
  }
});

/**
 * Process natural language input using Gemini API
 * @param {string} inputText - The user's input text
 * @returns {Promise<Object>} - Processed result with extracted information
 */
async function processNaturalLanguageInput(inputText) {
  // First, check if this looks like a routing request using heuristics
  const routingKeywords = /route|path|way|directions|from|to|travel|trip|journey|drive|walk|map|between/i;
  const isLikelyRouteRequest = routingKeywords.test(inputText);
  
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

EXAMPLES:
Input: "Show me how to get from Boston to New York"
Output: {"isRouteRequest": true, "locations": ["Boston", "New York"], "travelMode": "driving", "preferences": [], "message": ""}

Input: "Plan a cycling trip from Paris through Lyon to Nice avoiding major roads"
Output: {"isRouteRequest": true, "locations": ["Paris", "Lyon", "Nice"], "travelMode": "cycling", "preferences": ["avoid major roads"], "message": ""}

Input: "Tell me about the history of Constantinople and Mediterranean region"
Output: {"isRouteRequest": false, "locations": ["Constantinople", "Mediterranean"], "travelMode": "driving", "preferences": [], "message": "I found mentions of Constantinople and the Mediterranean region, but this doesn't seem to be a route request. Would you like to see these locations on the map?"}

If travel mode is not specified, default to "driving".
If preferences are not specified, return an empty array.
Return ONLY the JSON object, no additional text.
`;

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GEMINI_API_KEY}`
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
    const jsonMatch = responseText.match(/{[\s\S]*?}/);
    
    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[0]);
        return result;
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        // Try to extract with a more lenient approach
        const fixedJson = responseText.replace(/[\r\n]+/g, ' ')
                                    .replace(/"/g, '"')
                                    .replace(/"/g, '"')
                                    .match(/{[\s\S]*?}/);
        if (fixedJson) {
          return JSON.parse(fixedJson[0]);
        }
      }
    }
    
    throw new Error('Could not parse JSON from Gemini response');
  } catch (error) {
    console.error('Error with Gemini API:', error);
    
    // Fallback with basic analysis if API fails
    return {
      isRouteRequest: isLikelyRouteRequest,
      locations: extractLocationsBasic(inputText),
      travelMode: inputText.match(/\b(walking|cycling|driving|transit)\b/i)?.[1]?.toLowerCase() || 'driving',
      preferences: [],
      message: isLikelyRouteRequest 
        ? "I had trouble understanding the details, but I'll try to map what I understood."
        : "This doesn't appear to be a route request. Try something like 'Show me a route from New York to Washington DC'."
    };
  }
}

/**
 * Basic location extraction as fallback
 * @param {string} text - Input text
 * @returns {Array} - Array of potential locations
 */
function extractLocationsBasic(text) {
  // Simple regex for capitalized place names
  const placeNameRegex = /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\b/g;
  const matches = [...text.matchAll(placeNameRegex)];
  const potentialLocations = matches.map(m => m[0]);
  
  // Filter out common non-location capitalized words
  const nonLocationWords = [
    'I', 'You', 'He', 'She', 'They', 'We', 'It', 'Who', 'What', 'Where', 'When', 'Why', 'How',
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  ];
  
  return potentialLocations.filter(loc => !nonLocationWords.includes(loc));
}

/**
 * Handle the processed result from NLP
 * @param {Object} result - The processed result
 */
function handleProcessedResult(result) {
  console.log('Processed result:', result);
  
  if (result.isRouteRequest && result.locations && result.locations.length >= 2) {
    // It's a route request with enough locations
    displayMessage(`Creating route between ${result.locations.join(', ')}${result.travelMode !== 'driving' ? ' via ' + result.travelMode : ''}${result.preferences.length > 0 ? ' with preferences: ' + result.preferences.join(', ') : ''}`);
    getRouteCoordinates(result.locations, result.travelMode || 'driving', result.preferences || []);
  } else if (result.locations && result.locations.length > 0) {
    // It's not a route request but has locations or doesn't have enough locations
    const messageText = result.isRouteRequest 
      ? `I found these locations, but need at least two for a route: ${result.locations.join(', ')}` 
      : (result.message || `I found these locations mentioned: ${result.locations.join(', ')}`);
    
    // Display locations with interactive chips
    displayLocationChips(result.locations, messageText);
    
    // Show the locations on the map
    showLocationsOnMap(result.locations);
  } else {
    // No locations found
    displayMessage(result.message || "I couldn't find any locations in your text. Try being more specific about places you want to see on the map.");
  }
}

/**
 * Display location chips with the option to select them for routing
 * @param {Array} locations - Array of location names
 * @param {string} message - Message to display
 */
function displayLocationChips(locations, message) {
  const messageEl = document.getElementById('message-display');
  messageEl.style.display = 'block';
  
  // Create message with interactive location chips
  let html = `<p>${message}</p><div class="location-chips">`;
  
  locations.forEach(location => {
    html += `<span class="location-chip" data-location="${location}">${location}</span>`;
  });
  
  html += `</div>`;
  
  // Add option to create route if multiple locations
  if (locations.length >= 2) {
    html += `<p style="margin-top: 10px;">
      <button id="create-route-btn" style="padding: 5px 10px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Create Route with Selected Locations
      </button>
    </p>`;
  }
  
  messageEl.innerHTML = html;
  
  // Add event listeners to chips
  const chips = messageEl.querySelectorAll('.location-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('selected');
    });
  });
  
  // Add event listener to create route button
  const routeBtn = document.getElementById('create-route-btn');
  if (routeBtn) {
    routeBtn.addEventListener('click', () => {
      const selectedLocations = [];
      messageEl.querySelectorAll('.location-chip.selected').forEach(chip => {
        selectedLocations.push(chip.getAttribute('data-location'));
      });
      
      if (selectedLocations.length >= 2) {
        getRouteCoordinates(selectedLocations, 'driving', []);
        displayMessage(`Creating route between ${selectedLocations.join(', ')}`);
      } else {
        displayMessage('Please select at least two locations to create a route.');
      }
    });
  }
}

/**
 * Display a message to the user
 * @param {string} message - The message to display
 */
function displayMessage(message) {
  const messageElement = document.getElementById('message-display');
  messageElement.style.display = 'block';
  messageElement.innerHTML = `<p>${message}</p>`;
}

/**
 * Show locations as markers on the map without creating a route
 * @param {Array} locations - Array of location names
 */
function showLocationsOnMap(locations) {
  // Clear existing route
  map.getSource('route').setData({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: []
    }
  });
  
  // Geocode each location
  const geocodePromises = locations.map(location =>
    fetch(`${geocodingUrl}${encodeURIComponent(location)}.json?access_token=${mapboxToken}`)
      .then(response => response.json())
      .then(data => {
        if (data.features && data.features.length > 0) {
          const feature = data.features[0];
          return {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: feature.geometry.coordinates
            },
            properties: {
              description: `<h3>${location}</h3><p>${feature.place_name}</p>`,
              title: location
            }
          };
        }
        console.log(`No results found for ${location}`);
        return null;
      })
      .catch(err => {
        console.error(`Error geocoding ${location}:`, err);
        return null;
      })
  );
  
  // Update markers on the map
  Promise.all(geocodePromises)
    .then(features => {
      const validFeatures = features.filter(f => f !== null);
      
      // Update the locations source
      map.getSource('locations').setData({
        type: 'FeatureCollection',
        features: validFeatures
      });
      
      // If we have valid locations, fit the map to show them all
      if (validFeatures.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        
        validFeatures.forEach(feature => {
          bounds.extend(feature.geometry.coordinates);
        });
        
        map.fitBounds(bounds, {
          padding: 50
        });
      }
    });
}

/**
 * Get route coordinates and display on map
 * @param {Array} locations - Array of locations for the route
 * @param {string} travelMode - Mode of transportation
 * @param {Array} preferences - Route preferences
 */
function getRouteCoordinates(locations, travelMode = 'driving', preferences = []) {
  // Clear existing markers
  map.getSource('locations').setData({
    type: 'FeatureCollection',
    features: []
  });
  
  // Make sure we have a valid travel mode
  const validModes = ['driving', 'walking', 'cycling'];
  if (!validModes.includes(travelMode)) {
    travelMode = 'driving'; // Default to driving if invalid
  }
  
  // Map travel mode to Mapbox API format
  const mapboxMode = travelMode === 'cycling' ? 'cycling' : 
                    travelMode === 'walking' ? 'walking' : 'driving';
  
  // Geocode all locations
  const geocodePromises = locations.map(location =>
    fetch(`${geocodingUrl}${encodeURIComponent(location)}.json?access_token=${mapboxToken}`)
      .then(response => response.json())
      .then(data => {
        if (data.features && data.features.length > 0) {
          const coordinates = data.features[0].geometry.coordinates;
          return {
            coordinates,
            name: location,
            place_name: data.features[0].place_name
          };
        } else {
          throw new Error(`Unable to geocode location: ${location}`);
        }
      })
  );

  // Process all geocoding requests
  Promise.all(geocodePromises)
    .then(results => {
      // Add markers for each location
      const features = results.map(result => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: result.coordinates
        },
        properties: {
          description: `<h3>${result.name}</h3><p>${result.place_name}</p>`,
          title: result.name
        }
      }));
      
      map.getSource('locations').setData({
        type: 'FeatureCollection',
        features
      });
      
      // If only one location, center on it
      if (results.length === 1) {
        map.setCenter(results[0].coordinates);
        map.setZoom(12);
        
        // Clear the route
        map.getSource('route').setData({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: []
          }
        });
        
        return;
      }
      
      // Build coordinates string for API
      const coordinatesString = results
        .map(result => `${result.coordinates[0]},${result.coordinates[1]}`)
        .join(';');
      
      // Build URL with preferences
      let url = `https://api.mapbox.com/directions/v5/mapbox/${mapboxMode}/${coordinatesString}`;
      url += '?geometries=geojson&overview=full&steps=false';
      url += `&access_token=${mapboxToken}`;
      
      // Add preference parameters
      if (preferences.some(p => /avoid.*(highway|motorway|freeway)/i.test(p))) {
        url += '&exclude=motorway';
      }
      
      if (preferences.some(p => /avoid.*(toll)/i.test(p))) {
        url += '&exclude=toll';
      }
      
      if (preferences.some(p => /(scenic|pretty|beautiful|landscape)/i.test(p))) {
        // No direct "scenic" option, but we can adjust alternatives
        url += '&alternatives=true';
      }
      
      console.log('Directions URL:', url);
      
      // Fetch the route
      fetch(url)
        .then(response => response.json())
        .then(data => {
          if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const routeDistance = (route.distance / 1000).toFixed(1); // km
            const routeDuration = Math.round(route.duration / 60); // minutes
            
            // Update route on map
            map.getSource('route').setData({
              type: 'Feature',
              properties: {},
              geometry: route.geometry
            });
            
            // Display route information
            displayMessage(`Route: ${results.map(r => r.name).join(' → ')}
                          <br>Distance: ${routeDistance} km 
                          <br>Duration: ${routeDuration} min 
                          <br>Mode: ${travelMode}`);
            
            // Fit the map to the route
            const bounds = new mapboxgl.LngLatBounds();
            route.geometry.coordinates.forEach(coord => {
              bounds.extend(coord);
            });
            
            map.fitBounds(bounds, {
              padding: 50
            });
          } else {
            console.error('No valid route found in the API response');
            displayMessage(`Couldn't find a valid ${travelMode} route between these locations. Try different locations or travel mode.`);
          }
        })
        .catch(error => {
          console.error('Error fetching route:', error);
          displayMessage('Error fetching route. Please try again.');
        });
    })
    .catch(error => {
      console.error('Error geocoding locations:', error);
      displayMessage('Error finding one or more locations. Please check the spelling and try again.');
    });
}

// You may want to add this to your HTML head section
// <script src='https://api.tiles.mapbox.com/mapbox-gl-js/v2.9.2/mapbox-gl.js'></script>
// <link href='https://api.tiles.mapbox.com/mapbox-gl-js/v2.9.2/mapbox-gl.css' rel='stylesheet' />
