import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Navigation2, Locate } from 'lucide-react';
import mapboxgl from 'mapbox-gl';

const MapboxNavigation = () => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [destination, setDestination] = useState('');
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const watchIdRef = useRef(null);

  const mapboxApi1 = import.meta.env.VITE_API_MAPBOX_URL1;
  const MAPBOX_TOKEN = mapboxApi1;


  useEffect(() => {
    mapRef.current = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [74.5, 40],
      zoom: 9
    });
  
    mapRef.current.on('load', () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const userLocation = [longitude, latitude];
            setCurrentLocation(userLocation);
  
            mapRef.current.flyTo({
              center: userLocation,
              zoom: 14 // Adjust zoom for a better view
            });
  
            // Add marker for current location
            markerRef.current = new mapboxgl.Marker()
              .setLngLat(userLocation)
              .addTo(mapRef.current);
          },
          (error) => {
            console.error('Geolocation error:', error);
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      }
    });
  
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (markerRef.current) {
        markerRef.current.remove();
      }
      mapRef.current.remove();
    };
  }, []);
  
  const startNavigation = () => {
    setIsNavigating(true);
    
    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation = [longitude, latitude];
        setCurrentLocation(newLocation);

        // Update marker position
        if (!markerRef.current) {
          markerRef.current = new mapboxgl.Marker()
            .setLngLat(newLocation)
            .addTo(mapRef.current);
        } else {
          markerRef.current.setLngLat(newLocation);
        }

        // Center map on user's location
        mapRef.current.flyTo({
          center: newLocation,
          zoom: 16
        });

        // Check if we need to recalculate route (if user deviates significantly)
        if (route) {
          const threshold = 0.1; // 100 meters threshold, adjust as needed
          const currentPoint = newLocation;
          const routeGeometry = route.geometry.coordinates;
          
          // Find closest point on route
          let minDistance = Infinity;
          for (let point of routeGeometry) {
            const distance = calculateDistance(currentPoint, point);
            if (distance < minDistance) {
              minDistance = distance;
            }
          }

          // If too far from route, recalculate
          if (minDistance > threshold) {
            getRoute();
          }
        }
      },
      (error) => {
        setError('Error tracking location: ' + error.message);
        setIsNavigating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  };

  const stopNavigation = () => {
    setIsNavigating(false);
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const calculateDistance = (point1, point2) => {
    // Haversine formula to calculate distance between two points
    const R = 6371; // Earth's radius in km
    const dLat = (point2[1] - point1[1]) * Math.PI / 180;
    const dLon = (point2[0] - point1[0]) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1[1] * Math.PI / 180) * Math.cos(point2[1] * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

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
        
        // Create or update marker
        if (!markerRef.current) {
          markerRef.current = new mapboxgl.Marker()
            .setLngLat(newLocation)
            .addTo(mapRef.current);
        } else {
          markerRef.current.setLngLat(newLocation);
        }

        // Center map on location
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

      // Get the route
      const routeResponse = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${currentLocation[0]},${currentLocation[1]};${destinationCoords[0]},${destinationCoords[1]}?steps=true&geometries=geojson&access_token=${MAPBOX_TOKEN}`
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
          <CardTitle>Navigation</CardTitle>
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

            {route && (
              <div className="flex gap-4">
                <Button
                  onClick={isNavigating ? stopNavigation : startNavigation}
                  className={`flex items-center gap-2 ${isNavigating ? 'bg-red-500' : ''}`}
                >
                  {isNavigating ? 'Stop Navigation' : 'Start Navigation'}
                </Button>
              </div>
            )}

            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}

            <div id="map" className="w-full h-96 bg-gray-100 rounded-lg" />

            {route && (
              <div className="space-y-2">
                <h3 className="font-medium">Turn-by-turn directions:</h3>
                <div className="space-y-1">
                  {route.legs[0].steps.map((step, index) => (
                    <div key={index} className="text-sm">
                      {index + 1}. {step.maneuver.instruction}
                    </div>
                  ))}
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