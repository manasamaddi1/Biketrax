// Import Mapbox as an ESM module
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

// Set your Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1IjoibWFuYXNhbWFkZGkiLCJhIjoiY21hb2l5eDZnMDdzMzJpb2htNDBxYmd4ayJ9.Imf8ILwTblEUIw2wvv1yiw'; // Replace with your real token

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // The id of the HTML element
  style: 'mapbox://styles/mapbox/streets-v12', // You can change this to another Mapbox style
  center: [-71.0936142, 42.3591965], // Longitude, Latitude (MIT area)
  zoom: 12
});

// Add zoom and rotation controls to the map
map.addControl(new mapboxgl.NavigationControl());

// Log confirmation
console.log('Map initialized:', map);
