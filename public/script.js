// 6. /public/script.js - Frontend JavaScript
// This is our secure implementation that uses the server-side API proxies
// to avoid exposing API keys in the client-side code

// Initialize map with Mapbox
mapboxgl.accessToken = 'pk.eyJ1IjoidHVmZmNyZWF0ZSIsImEiOiJjbHU5YXJxeXQwN2J6MmpsMDRvMGJ0dGhsIn0.neijgnnqzQ0aCHzOPrE_MQ';

// Initialize map
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-122.42136449, 37.80176523], // Center the map on San Francisco
  zoom: 8
});

// Add UI elements and event listeners
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const messageDisplay = document.getElementById('message-display');
const loadingIndicator = document.getElementById('loading-indicator');

// Initialize map layers on load
map.on('load', () => {
  console.log('Map loaded');
  
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

// Add click event listener to search button
searchButton.addEventListener('click', () => {
  const inputValue = searchInput.value;
  if (inputValue.trim() === '') {
    displayMessage('Please enter a location or route query.');
    return;
  }
  
  // Show loading indicator
  loadingIndicator.style.display = 'block';
  
  // Process the input text with NLP
  processNaturalLanguageInput(inputValue)
    .then(result => {
      // Hide loading indicator
      loadingIndicator.style.display = 'none';
      
      handleProcessedResult(result);
    })
    .catch(error => {
      console.error('Error processing input:', error);
      loadingIndicator.style.display = 'none';
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
 * Process natural language input using our server-side API
 * @param {string} inputText - The user's input text
 * @returns {Promise<Object>} - Processed result with extracted information
 */
async function processNaturalLanguageInput(inputText) {
  try {
    const response = await fetch('/api/nlp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ input: inputText })
    });
    
    if (!response.ok) {
      throw new Error(`NLP request failed with status ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error with NLP API:', error);
    
    // Return a basic fallback result
    return {
      isRouteRequest: false,
      locations: [],
      travelMode: 'driving',
      preferences: [],
      message: "Sorry, I couldn't understand your request. Please try something like 'Show me a route from New York to Washington DC'."
    };
  }
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
  messageDisplay.style.display = 'block';
  
  // Create message with interactive location chips
  let html = `<p>${message}</p><div class="location-chips">`;
  
  locations.forEach(location => {
    html += `<span class="location-chip" data-location="${location}">${location}</span>`;
  });
  
  html += `</div>`;
  
  // Add option to create route if multiple locations
  if (locations.length >= 2) {
    html += `<p style="margin-top: 10px;">
      <button id="create-route-btn" style="padding: 5px 10px; background-color: #0078ff; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Create Route with Selected Locations
      </button>
    </p>`;
  }
  
  messageDisplay.innerHTML = html;
  
  // Add event listeners to chips
  const chips = messageDisplay.querySelectorAll('.location-chip');
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
      messageDisplay.querySelectorAll('.location-chip.selected').forEach(chip => {
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
  messageDisplay.style.display = 'block';
  messageDisplay.innerHTML = `<p>${message}</p>`;
}

/**
 * Show locations as markers on the map without creating a route
 * @param {Array} locations - Array of location names
 */
async function showLocationsOnMap(locations) {
  // Clear existing route
  map.getSource('route').setData({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: []
    }
  });
  
  // Geocode each location using our proxy API
  const geocodePromises = locations.map(location =>
    fetch(`/api/geocode?location=${encodeURIComponent(location)}`)
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
  const features = await Promise.all(geocodePromises);
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
}

/**
 * Get route coordinates and display on map
 * @param {Array} locations - Array of locations for the route
 * @param {string} travelMode - Mode of transportation
 * @param {Array} preferences - Route preferences
 */
async function getRouteCoordinates(locations, travelMode = 'driving', preferences = []) {
  // Show loading indicator
  loadingIndicator.style.display = 'block';
  
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
  
  try {
    // Geocode all locations using our proxy API
    const geocodePromises = locations.map(location =>
      fetch(`/api/geocode?location=${encodeURIComponent(location)}`)
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
    const results = await Promise.all(geocodePromises);
    
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
      
      loadingIndicator.style.display = 'none';
      return;
    }
    
    // Build coordinates string for API
    const coordinatesString = results
      .map(result => `${result.coordinates[0]},${result.coordinates[1]}`)
      .join(';');
    
    // Build options string with preferences
    let optionsString = '';
    
    if (preferences.some(p => /avoid.*(highway|motorway|freeway)/i.test(p))) {
      optionsString += '&exclude=motorway';
    }
    
    if (preferences.some(p => /avoid.*(toll)/i.test(p))) {
      optionsString += '&exclude=toll';
    }
    
    if (preferences.some(p => /(scenic|pretty|beautiful|landscape)/i.test(p))) {
      // No direct "scenic" option, but we can adjust alternatives
      optionsString += '&alternatives=true';
    }
    
    // Call our proxy API for directions
    const response = await fetch(`/api/directions?coordinates=${coordinatesString}&profile=${mapboxMode}&options=${optionsString}`);
    const data = await response.json();
    
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
  } catch (error) {
    console.error('Error getting route:', error);
    displayMessage('Error creating route. Please check the locations and try again.');
  } finally {
    // Hide loading indicator
    loadingIndicator.style.display = 'none';
  }
