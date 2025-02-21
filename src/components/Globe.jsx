import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useGeolocated } from 'react-geolocated';

const mapboxApi1=import.meta.env.VITE_API_MAPBOX_URL1;

mapboxgl.accessToken = mapboxApi1;

const Globe = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(-70.9);
  const [lat, setLat] = useState(42.35);
  const [zoom, setZoom] = useState(9);


  const { coords, isGeolocationAvailable, isGeolocationEnabled, getPosition, positionError} =
       useGeolocated({
           positionOptions: {
               enableHighAccuracy: false,
           },
           userDecisionTimeout: 5000,
       });


  useEffect(() => {
    if (map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/navigation-day-v1',
      center: [lng, lat],
      zoom: zoom,
      projection: 'globe' // IMPORTANT:  Enable the globe view!
    });

    map.current.on('move', () => {
        setLng(map.current.getCenter().lng.toFixed(4));
        setLat(map.current.getCenter().lat.toFixed(4));
        setZoom(map.current.getZoom().toFixed(2));
      });

    // Add navigation control (the +/- zoom buttons)
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-left');

    // Add geolocate control to the map.
    map.current.addControl(
        new mapboxgl.GeolocateControl({
            positionOptions: {
                enableHighAccuracy: true
            },
            trackUserLocation: true,
            showUserHeading: true
        })
    );

  });


  useEffect(() => {

     if(coords){
          setLng(coords.longitude);
          setLat(coords.latitude)
          if(map.current){
           map.current.setCenter([coords.longitude, coords.latitude])

           new mapboxgl.Marker()
              .setLngLat([coords.longitude, coords.latitude])
              .addTo(map.current);
         }
     }
  },[coords])


  return (
    <div>
        <div className="sidebar">
            Longitude: {lng} | Latitude: {lat} | Zoom: {zoom}
        </div>
      <div ref={mapContainer} className="map-container" style={{ width: '100vw', height: '100vh' }} />
      {(!isGeolocationAvailable) ? (
              <div>Your browser does not support Geolocation</div>
          ) :
          (!isGeolocationEnabled) ? (
              <div>Geolocation is not enabled</div>
          ) :
          (coords) ? (
              <table>
                  <tbody>
                      <tr>
                          <td>latitude</td>
                          <td>{coords.latitude}</td>
                      </tr>
                      <tr>
                          <td>longitude</td>
                          <td>{coords.longitude}</td>
                      </tr>
                      <tr>
                          <td>altitude</td>
                          <td>{coords.altitude}</td>
                      </tr>
                      <tr>
                          <td>heading</td>
                          <td>{coords.heading}</td>
                      </tr>
                      <tr>
                          <td>speed</td>
                          <td>{coords.speed}</td>
                      </tr>
                  </tbody>
              </table>
          ) : (
              <div>Getting the location data… </div>
          )}
    </div>
  );
};

export default Globe;