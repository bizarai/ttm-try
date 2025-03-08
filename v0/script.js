const mapboxToken = 'pk.eyJ1IjoidHVmZmNyZWF0ZSIsImEiOiJjbHU5YXJxeXQwN2J6MmpsMDRvMGJ0dGhsIn0.neijgnnqzQ0aCHzOPrE_MQ';

mapboxgl.accessToken = mapboxToken;

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-122.42136449, 37.80176523], // Center the map on San Francisco
  zoom: 8
});

map.on('load', () => {
  console.log('Map loaded');
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
  console.log('Layer added');
});

const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');

searchButton.addEventListener('click', () => {
  const inputValue = searchInput.value;
  getRouteCoordinates(inputValue);
});

const geocodingUrl = 'https://api.mapbox.com/geocoding/v5/mapbox.places/';

function getRouteCoordinates(inputString) {
  const separators = [' to ', ' 到 ', ', ', ' and ', ' => ', ',', '，', ' '];
  const locations = inputString
    .split(new RegExp(separators.join('|'), 'gi'))
    .map(location => location.trim())
    .filter(location => location !== '');

  if (locations.length < 1) {
    console.error('No valid locations found in input');
    return;
  }

  const geocodePromises = locations.map(location =>
    fetch(`${geocodingUrl}${encodeURIComponent(location)}.json?access_token=${mapboxToken}`)
      .then(response => response.json())
      .then(data => {
        if (data.features.length > 0) {
          const coordinates = data.features[0].geometry.coordinates;
          return `${coordinates[0]},${coordinates[1]}`;
        } else {
          throw new Error(`Unable to geocode location: ${location}`);
        }
      })
  );

  Promise.all(geocodePromises)
    .then(coordinates => {
      const origin = coordinates[0];
      const destination = coordinates[coordinates.length - 1];
      const waypoints = coordinates.slice(1, -1);

      let url;
      if (locations.length === 1) {
        // If there's only one location, center the map on it
        const singleLocation = origin.split(',').map(Number);
        map.setCenter(singleLocation);
        map.setZoom(12);
        console.log('Single location:', singleLocation);

        // Clear the route data
        map.getSource('route').setData({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: []
          }
        });
        return;
      } else if (locations.length === 2) {
        // If there are two locations, create a direct route
        url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin};${destination}?geometries=geojson&access_token=${mapboxToken}`;
      } else {
        // If there are more than two locations, include waypoints
        url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin};${waypoints.join(';')};${destination}?geometries=geojson&access_token=${mapboxToken}`;
      }

      console.log('URL:', url);

      fetch(url)
        .then(response => response.json())
        .then(data => {
          console.log('Response data:', data);
          if (data.routes && data.routes.length > 0) {
            const coordinates = data.routes[0].geometry.coordinates;
            const mapData = {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: coordinates
              }
            };
            console.log('Map data:', mapData);
            map.getSource('route').setData(mapData);

            // Compute the bounding box for all coordinates
            const bounds = coordinates.reduce((bounds, coord) => {
              return bounds.extend(coord);
            }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

            // Fit the map to the bounds
            map.fitBounds(bounds, {
              padding: 50
            });

          } else {
            console.error('No valid route found in the API response');
          }
        })
        .catch(error => console.error(error));
    })
    .catch(error => console.error(error));
}
