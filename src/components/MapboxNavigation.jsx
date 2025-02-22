import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Navigation2, Locate, BatteryCharging, MapPin } from "lucide-react";
import mapboxgl from "mapbox-gl";

// const CACHE_DURATION = 1000 * 60 * 60 * 4; // 4 hours
// const LOCATION_CACHE_KEY = 'userLocation';
// const GEOCODE_CACHE_PREFIX = 'geocode_';
// const ROUTE_CACHE_PREFIX = 'route_';

const MapboxNavigation = () => {
  const chargingStations = [
    { coordinates: [36.8219, -1.2921], name: "CBD Station" },
    { coordinates: [36.785, -1.2983], name: "Westlands Station" },
    { coordinates: [36.8844, -1.2191], name: "Kasarani Station" },
    { coordinates: [36.8665, -1.3031], name: "South B Station" },
    { coordinates: [36.7772, -1.2571], name: "Parklands Station" },
    { coordinates: [36.8883, -1.2893], name: "Buruburu Station" },
    { coordinates: [36.7622, -1.3028], name: "Lavington Station" },
    { coordinates: [36.8158, -1.264], name: "Ngara Station" },
    { coordinates: [36.8509, -1.3169], name: "South C Station" },
    { coordinates: [36.8219, -1.2751], name: "Ngong Road Station" },
  ];

  const [currentLocation, setCurrentLocation] = useState(null);
  const [startLocation, setStartLocation] = useState("");
  const [destination, setDestination] = useState("");
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [markers, setMarkers] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isDestinationModalOpen, setIsDestinationModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

  const mapRef = useRef(null);
  const currentMarkerRef = useRef(null);
  const startMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const watchIdRef = useRef(null);

  const MAPBOX_TOKEN = import.meta.env.VITE_API_MAPBOX_URL1;

  useEffect(() => {
    mapRef.current = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/streets-v11",
      center: [36.8219, -1.2921],
      zoom: 12,
    });

    mapRef.current.on("load", () => {
      chargingStations.forEach((station) => {
        const markerEl = document.createElement("div");
        markerEl.className = "charging-station-marker";
        markerEl.innerHTML = `
          <div class="w-11 h-10 bg-amber-400 rounded-sm flex items-center justify-center shadow-lg">
            <div class="text-white font-extrabold text-2xl"> 🔋 </div>
          </div>
        `;

        const marker = new mapboxgl.Marker(markerEl)
          .setLngLat(station.coordinates)
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(`
                <div class="p-2 rounded-3xl">
                  <h3 class="font-bold">${station.name}</h3>
                </div>
              `)
          )
          .addTo(mapRef.current);

        markerEl.addEventListener("click", () => {
          setSelectedStation(station);
        });

        setMarkers((prev) => [...prev, marker]);
      });

      getCurrentLocation();
    });

    const style = document.createElement("style");
    style.textContent = `
      .charging-station-marker {
        cursor: pointer;
        transition: transform 0.2s;
      }
      .charging-station-marker:hover {
        transform: scale(1.1);
      }
      .pulse-marker {
        animation: pulse 2s infinite;
      }
      @keyframes pulse {
        0% {
          box-shadow: 0 0 0 0 rgba(35, 171, 43, 0.4);
        }
        70% {
          box-shadow: 0 0 0 10px rgba(35, 171, 43, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(35, 171, 43, 0);
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      markers.forEach((marker) => marker.remove());
      if (currentMarkerRef.current) currentMarkerRef.current.remove();
      if (startMarkerRef.current) startMarkerRef.current.remove();
      if (destinationMarkerRef.current) destinationMarkerRef.current.remove();
      mapRef.current.remove();
      style.remove();
    };
  }, []);

  const getCurrentLocation = () => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation = [longitude, latitude];
        setCurrentLocation(newLocation);

        if (!currentMarkerRef.current) {
          const el = document.createElement("div");
          el.className = "pulse-marker";
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
          zoom: 14,
        });

        setLoading(false);
      },
      (error) => {
        setError("Unable to get your location");
        setLoading(false);
      }
    );
  };

  const geocodeAddress = async (address) => {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        address
      )}.json?access_token=${MAPBOX_TOKEN}`
    );
    const data = await response.json();
    if (!data.features?.length) {
      throw new Error("Address not found");
    }
    return data.features[0].center;
  };

  const getRoute = async () => {
    if (!currentLocation || !startLocation || !destination) {
      setError(
        "Please set both current location, start location, and destination"
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const startCoords = await geocodeAddress(startLocation);
      const destinationCoords = await geocodeAddress(destination);

      if (startMarkerRef.current) {
        startMarkerRef.current.remove();
      }
      startMarkerRef.current = new mapboxgl.Marker({ color: "#007bff" })
        .setLngLat(startCoords)
        .addTo(mapRef.current);

      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove();
      }
      destinationMarkerRef.current = new mapboxgl.Marker({ color: "#FF0000" })
        .setLngLat(destinationCoords)
        .addTo(mapRef.current);

      const waypoints = findOptimalRoute(startCoords, destinationCoords);
      const waypointsString = waypoints
        .map((wp) => `${wp[0]},${wp[1]}`)
        .join(";");

      const routeResponse = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${startCoords[0]},${startCoords[1]};${waypointsString};${destinationCoords[0]},${destinationCoords[1]}?steps=true&geometries=geojson&access_token=${MAPBOX_TOKEN}`
      );
      const routeData = await routeResponse.json();

      if (!routeData.routes?.length) {
        throw new Error("No route found");
      }

      setRoute(routeData.routes[0]);

      if (mapRef.current.getSource("route")) {
        mapRef.current.removeLayer("route");
        mapRef.current.removeSource("route");
      }

      mapRef.current.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: routeData.routes[0].geometry,
        },
      });

      mapRef.current.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#3887be",
          "line-width": 5,
          "line-opacity": 0.75,
        },
      });

      const coordinates = routeData.routes[0].geometry.coordinates;
      const bounds = coordinates.reduce((bounds, coord) => {
        return bounds.extend(coord);
      }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

      mapRef.current.fitBounds(bounds, {
        padding: 50,
      });
    } catch (err) {
      setError(err.message || "Error getting route");
    } finally {
      setLoading(false);
    }
  };

  const findOptimalRoute = (start, end) => {
    const sortedStations = chargingStations
      .map((station) => ({
        ...station,
        distanceToRoute: calculateDistanceToLine(
          station.coordinates,
          start,
          end
        ),
      }))
      .sort((a, b) => a.distanceToRoute - b.distanceToRoute)
      .slice(0, 3);

    return sortedStations.map((station) => station.coordinates);
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

  return (
    <div className="w-full max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BatteryCharging className="w-6 h-6 text-green-500" />
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
                  Current: {currentLocation[1].toFixed(4)},{" "}
                  {currentLocation[0].toFixed(4)}
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <Input
                type="text"
                placeholder="Enter start location"
                value={startLocation}
                onChange={(e) => setStartLocation(e.target.value)}
                className="flex-1"
              />
              <Input
                type="text"
                placeholder="Enter destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={getRoute}
                disabled={
                  loading || !currentLocation || !startLocation || !destination
                }
                className="flex items-center gap-2"
              >
                <Navigation2 className="w-4 h-4" />
                Get Route
              </Button>
            </div>

            <div
              id="map"
              className="relative w-full h-96 bg-gray-100 rounded-lg"
            >
              {selectedStation && (
                <div className="z-50 absolute bottom-4 left-4 bg-gray-800 
                bg-opacity-75 text-white p-4 rounded-lg shadow-lg w-80 pointer-events-auto">
                  <h3 className="font-bold">{selectedStation.name}</h3>
                  <p className="text-sm">EV Charging Available</p>
                  <button
                    className="absolute top-2 right-2 text-gray-300 hover:text-white"
                    onClick={() => setSelectedStation(null)}
                  >
                    &times;
                  </button>
                </div>
              )}
            </div>

            {error && <div className="text-red-500 text-sm">{error}</div>}

            {route && (
              <div className="space-y-2">
                <h3 className="font-medium">Navigation Instructions:</h3>
                <div className="space-y-1">
                  {route.legs.flatMap((leg, legIndex) =>
                    leg.steps.map((step, stepIndex) => (
                      <div
                        key={`${legIndex}-${stepIndex}`}
                        className="text-sm flex items-start gap-2"
                      >
                        <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
                        {step.maneuver.instruction}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* {selectedStation && (
              <div className="fixed left-0 top-0 w-1/3 h-screen bg-gray-500 shadow-lg p-4 z-50">
                <h3 className="font-bold">{selectedStation.name}</h3>
                <p className="text-sm">EV Charging Available</p>
                <button
                  className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                  onClick={() => setSelectedStation(null)}
                >
                  &times;
                </button>
              </div>
            )} */}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MapboxNavigation;
