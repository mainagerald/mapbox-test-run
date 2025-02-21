import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Navigation2, Locate, Battery, MapPin } from 'lucide-react';
import mapboxgl from 'mapbox-gl';

const MapboxNavigation = () => {
  // Sample charging stations around Nairobi (random coordinates)
  const chargingStations = [
    { coordinates: [36.8219, -1.2921], name: "CBD Station" },
    { coordinates: [36.7850, -1.2983], name: "Westlands Station" },
    { coordinates: [36.8844, -1.2191], name: "Kasarani Station" },
    { coordinates: [36.8665, -1.3031], name: "South B Station" },
    { coordinates: [36.7772, -1.2571], name: "Parklands Station" },
    { coordinates: [36.8883, -1.2893], name: "Buruburu Station" },
    { coordinates: [36.7622, -1.3028], name: "Lavington Station" },
    { coordinates: [36.8158, -1.2640], name: "Ngara Station" },
    { coordinates: [36.8509, -1.3169], name: "South C Station" },
    { coordinates: [36.8219, -1.2751], name: "Ngong Road Station" }
  ];

  const [currentLocation, setCurrentLocation] = useState(null);
  const [destination, setDestination] = useState('');
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [markers, setMarkers] = useState([]);

  const mapRef = useRef(null);
  const currentMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const watchIdRef = useRef(null);

  const MAPBOX_TOKEN = import.meta.env.VITE_API_MAPBOX_URL1;


  useEffect(() => {
    mapRef.current = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [36.8219, -1.2921],
      zoom: 12
    });

    mapRef.current.on('load', () => {
      // Add charging stations
      chargingStations.forEach(station => {
        const marker = new mapboxgl.Marker({ color: '#50C878' })
          .setLngLat(station.coordinates)
          .setPopup(new mapboxgl.Popup().setHTML(`<h3>${station.name}</h3><p>EV Charging Available</p>`))
          .addTo(mapRef.current);
        setMarkers(prev => [...prev, marker]);
      });

      // Get user's location
      getCurrentLocation();
    });

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      markers.forEach(marker => marker.remove());
      if (currentMarkerRef.current) currentMarkerRef.current.remove();
      if (destinationMarkerRef.current) destinationMarkerRef.current.remove();
      mapRef.current.remove();
    };
  }, []);

  const getCurrentLocation = () => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation = [longitude, latitude];
        setCurrentLocation(newLocation);

        // Create or update current location marker with pulsing effect
        if (!currentMarkerRef.current) {
          const el = document.createElement('div');
          el.className = 'pulse-marker';
          el.style.cssText = `
            width: 10px;
            height: 10px;
            background: rgba(255, 0, 0, 0.6);            
            border-radius: 50%;
            box-shadow: 0 0 0 rgba(35, 171, 43, 0.4);
            animation: pulse 2s infinite;
          `;

          currentMarkerRef.current = new mapboxgl.Marker(el)
            .setLngLat(newLocation)
            .addTo(mapRef.current);
        } else {
          currentMarkerRef.current.setLngLat(newLocation);
        }

        mapRef.current.flyTo({
          center: newLocation,
          zoom: 14
        });

        setLoading(false);
      },
      (error) => {
        setError('Unable to get your location');
        setLoading(false);
      }
    );
  };

  const findOptimalRoute = (start, end) => {
    // Find nearest charging stations to create waypoints
    const sortedStations = chargingStations
      .map(station => ({
        ...station,
        distanceToRoute: calculateDistanceToLine(
          station.coordinates,
          start,
          end
        )
      }))
      .sort((a, b) => a.distanceToRoute - b.distanceToRoute)
      .slice(0, 3); // Take 3 nearest stations

    return sortedStations.map(station => station.coordinates);
  };

  const calculateDistanceToLine = (point, lineStart, lineEnd) => {
    const x = point[0];
    const y = point[1];
    const x1 = lineStart[0];
    const y1 = lineStart[1];
    const x2 = lineEnd[0];
    const y2 = lineEnd[1];

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;

    return Math.sqrt(dx * dx + dy * dy);
  };

  const getRoute = async () => {
    if (!currentLocation || !destination) {
      setError('Please set both current location and destination');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Geocode the destination address
      const geocodeResponse = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          destination
        )}.json?access_token=${MAPBOX_TOKEN}`
      );
      const geocodeData = await geocodeResponse.json();

      if (!geocodeData.features?.length) {
        throw new Error('Destination not found');
      }

      const destinationCoords = geocodeData.features[0].center;

      // Update destination marker
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove();
      }
      destinationMarkerRef.current = new mapboxgl.Marker({ color: '#FF0000' })
        .setLngLat(destinationCoords)
        .addTo(mapRef.current);

      // Get waypoints through charging stations
      const waypoints = findOptimalRoute(currentLocation, destinationCoords);

      // Construct waypoints string for API
      const waypointsString = waypoints
        .map(wp => `${wp[0]},${wp[1]}`)
        .join(';');

      // Get the route with waypoints
      const routeResponse = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${currentLocation[0]},${currentLocation[1]};${waypointsString};${destinationCoords[0]},${destinationCoords[1]}?steps=true&geometries=geojson&access_token=${MAPBOX_TOKEN}`
      );
      const routeData = await routeResponse.json();

      if (!routeData.routes?.length) {
        throw new Error('No route found');
      }

      setRoute(routeData.routes[0]);

      // Draw the route on the map
      if (mapRef.current.getSource('route')) {
        mapRef.current.removeLayer('route');
        mapRef.current.removeSource('route');
      }

      mapRef.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: routeData.routes[0].geometry
        }
      });

      mapRef.current.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3887be',
          'line-width': 5,
          'line-opacity': 0.75
        }
      });

      // Fit the map to show the whole route
      const coordinates = routeData.routes[0].geometry.coordinates;
      const bounds = coordinates.reduce((bounds, coord) => {
        return bounds.extend(coord);
      }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

      mapRef.current.fitBounds(bounds, {
        padding: 50
      });

    } catch (err) {
      setError(err.message || 'Error getting route');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Battery className="w-6 h-6" />
            EV Navigation with Charging Stations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <Button
                onClick={getCurrentLocation}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <Locate className="w-4 h-4" />
                Get Current Location
              </Button>
              {currentLocation && (
                <div className="text-sm text-gray-600">
                  Current: {currentLocation[1].toFixed(4)}, {currentLocation[0].toFixed(4)}
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <Input
                type="text"
                placeholder="Enter destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={getRoute}
                disabled={loading || !currentLocation || !destination}
                className="flex items-center gap-2"
              >
                <Navigation2 className="w-4 h-4" />
                Get Route
              </Button>
            </div>

            <div id="map" className="w-full h-96 bg-gray-100 rounded-lg" />

            {route && (
              <div className="space-y-2">
                <h3 className="font-medium">Navigation Instructions:</h3>
                <div className="space-y-1">
                  {route.legs.flatMap((leg, legIndex) =>
                    leg.steps.map((step, stepIndex) => (
                      <div key={`${legIndex}-${stepIndex}`} className="text-sm flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
                        {step.maneuver.instruction}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MapboxNavigation;