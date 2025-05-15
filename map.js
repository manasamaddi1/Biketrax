import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFuYXNhbWFkZGkiLCJhIjoiY21hb2l5eDZnMDdzMzJpb2htNDBxYmd4ayJ9.Imf8ILwTblEUIw2wvv1yiw';

let timeFilter = -1;

function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes);
  return date.toLocaleString('en-US', { timeStyle: 'short' });
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function filterTripsByTime(trips, timeFilter) {
  return timeFilter === -1
    ? trips
    : trips.filter(trip => {
        const start = minutesSinceMidnight(trip.started_at);
        const end = minutesSinceMidnight(trip.ended_at);
        return Math.abs(start - timeFilter) <= 60 || Math.abs(end - timeFilter) <= 60;
      });
}

function computeStationTraffic(stations, trips) {
  const departures = d3.rollup(trips, v => v.length, d => d.start_station_id);
  const arrivals = d3.rollup(trips, v => v.length, d => d.end_station_id);

  return stations.map(station => {
    const id = station.short_name;
    station.arrivals = arrivals.get(id) ?? 0;
    station.departures = departures.get(id) ?? 0;
    station.totalTraffic = station.arrivals + station.departures;
    return station;
  });
}

const stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.0936142, 42.3591965],
  zoom: 12
});

map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }));
map.addControl(new mapboxgl.FullscreenControl());

const bikeLanePaintStyle = {
  'line-color': '#097969',
  'line-width': 4.5,
  'line-opacity': 0.7,
  'line-blur': 1
};

function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

map.on('load', async () => {
  console.log('Map fully loaded.');

  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson'
  });
  map.addLayer({ id: 'bike-lanes-boston', type: 'line', source: 'boston_route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: bikeLanePaintStyle });

  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
  });
  map.addLayer({ id: 'bike-lanes-cambridge', type: 'line', source: 'cambridge_route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: bikeLanePaintStyle });

  map.addLayer({
    id: 'bike-lane-endpoints',
    type: 'circle',
    source: 'cambridge_route',
    paint: {
      'circle-color': '#00FFC3',
      'circle-radius': 2.5,
      'circle-opacity': 0.4
    }
  });

  map.addLayer({
    id: 'bike-lane-labels',
    type: 'symbol',
    source: 'cambridge_route',
    layout: {
      'text-field': ['coalesce', ['get', 'STREETNAME'], ['get', 'FACILITY']],
      'text-size': 10,
      'text-justify': 'center'
    },
    paint: {
      'text-color': '#004d00',
      'text-halo-color': 'white',
      'text-halo-width': 1
    }
  });

  console.log('Boston and Cambridge bike lanes added with styles and overlays!');

  const svg = d3.select('#map').select('svg');

  try {
    const stationsData = await d3.json('https://dsc106.com/labs/lab07/data/bluebikes-stations.json');
    const baseStations = stationsData.data.stations;

    const trips = await d3.csv('https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv', trip => {
      trip.started_at = new Date(trip.started_at);
      trip.ended_at = new Date(trip.ended_at);
      return trip;
    });

    let stations = computeStationTraffic(baseStations, trips);

    const radiusScale = d3
      .scaleSqrt()
      .domain([0, d3.max(stations, (d) => d.totalTraffic)])
      .range([0, 25]);

    let circles = svg
      .selectAll('circle')
      .data(stations, d => d.short_name)
      .enter()
      .append('circle')
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .attr('fill-opacity', 0.6)
      .attr('r', (d) => radiusScale(d.totalTraffic))
      .style('--departure-ratio', d => stationFlow(d.departures / d.totalTraffic))
      .each(function (d) {
        this.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'title'))
          .textContent = `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`;
      });

    function updatePositions() {
      circles
        .attr('cx', (d) => getCoords(d).cx)
        .attr('cy', (d) => getCoords(d).cy);
    }

    function updateScatterPlot(timeFilter) {
      const filteredTrips = filterTripsByTime(trips, timeFilter);
      const filteredStations = computeStationTraffic(baseStations, filteredTrips);

      timeFilter === -1 ? radiusScale.range([0, 25]) : radiusScale.range([3, 50]);

      circles = svg
        .selectAll('circle')
        .data(filteredStations, d => d.short_name)
        .join('circle')
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .attr('fill-opacity', 0.6)
        .attr('r', (d) => radiusScale(d.totalTraffic))
        .style('--departure-ratio', d => stationFlow(d.departures / d.totalTraffic))
        .each(function (d) {
          this.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'title'))
            .textContent = `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`;
        });

      updatePositions();
    }

    const timeSlider = document.getElementById('time-slider');
    const selectedTime = document.getElementById('current-time');
    const anyTimeLabel = document.getElementById('anytime');

    function updateTimeDisplay() {
      timeFilter = Number(timeSlider.value);

      if (timeFilter === -1) {
        selectedTime.textContent = '';
        anyTimeLabel.style.display = 'block';
      } else {
        selectedTime.textContent = formatTime(timeFilter);
        anyTimeLabel.style.display = 'none';
      }

      updateScatterPlot(timeFilter);
    }

    timeSlider.addEventListener('input', updateTimeDisplay);
    updateTimeDisplay();

    updatePositions();
    map.on('move', updatePositions);
    map.on('zoom', updatePositions);
    map.on('resize', updatePositions);
    map.on('moveend', updatePositions);

  } catch (error) {
    console.error('Error loading data:', error);
  }
});
