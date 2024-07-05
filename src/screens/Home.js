import React, { useEffect, useState, useRef } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  GoogleMap,
  useLoadScript,
  Marker,
  Autocomplete,
  DirectionsService,
  DirectionsRenderer,
  InfoWindow
} from '@react-google-maps/api';

const libraries = ['places', 'geometry'];
const mapContainerStyle = {
  width: '100%',
  height: '400px',
};
const options = {
  disableDefaultUI: true,
  zoomControl: true,
  tilt: 45, // Added for 3D effect
};

export default function Home() {
  const [coordinates, setCoordinates] = useState({ lat: 40.73061, lng: -73.935242 }); // Default coordinates
  const [destinations, setDestinations] = useState([null]); // Start with one destination input box
  const [directionsList, setDirectionsList] = useState([]);
  const [totalDistance, setTotalDistance] = useState(null);
  const [currentTripDistance, setCurrentTripDistance] = useState(null); // State for current trip distance
  const [distanceMatrix, setDistanceMatrix] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const autocompleteRefs = useRef([]);
  const [animationMarker, setAnimationMarker] = useState(null);
  const [currentPathIndex, setCurrentPathIndex] = useState(0);
  const [awaitingUserAction, setAwaitingUserAction] = useState(false);

  const mapRef = useRef(null); // Reference for Google Map
  const [markerRotation, setMarkerRotation] = useState(90); // State for marker rotation

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: 'AIzaSyDegNkC-GwWieiu1tjffn8e0JZt9ikMyvc', // Add your Google Maps API key here
    libraries,
  });

  useEffect(() => {
    const storedLocation = localStorage.getItem('location');
    if (storedLocation) {
      const [lat, long] = storedLocation.replace('Lat: ', '').replace('Long: ', '').split(', ');
      const startCoordinates = { lat: parseFloat(lat), lng: parseFloat(long) };
      setCoordinates(startCoordinates);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && destinations.length > 0) {
      const directionsService = new window.google.maps.DirectionsService();

      const computeRoutes = async () => {
        const results = [];
        let totalDist = 0;

        for (let i = 0; i < destinations.length - 1; i++) {
          if (destinations[i]) {
            const origin = i === 0 ? coordinates : destinations[i - 1];
            const destination = destinations[i];

            try {
              const result = await new Promise((resolve, reject) => {
                directionsService.route(
                  {
                    origin,
                    destination: { lat: destination.lat, lng: destination.lng },
                    travelMode: window.google.maps.TravelMode.DRIVING,
                  },
                  (result, status) => {
                    if (status === window.google.maps.DirectionsStatus.OK) {
                      resolve(result);
                    } else {
                      reject(`Error fetching directions: ${status}`);
                    }
                  }
                );
              });

              results.push(result);
              totalDist += result.routes[0].legs[0].distance.value;
            } catch (error) {
              console.error('Error computing routes:', error);
              // Handle error gracefully, possibly by resetting state or showing an error message
            }
          }
        }

        setDirectionsList(results);
        setTotalDistance(totalDist);

        const distances = results.map(result => result.routes[0].legs[0].distance.value);
        setDistanceMatrix(distances);
      };

      computeRoutes();
    }
  }, [isLoaded, coordinates, destinations]);

  const onLoad = (map) => {
    mapRef.current = map;
    map.setCenter(coordinates); // Set the map center to the coordinates
    map.setZoom(20); // Set the initial zoom level to 20
  };

  const animateMarker = async (path, pathIndex) => {
    if (!path || path.length === 0) {
      console.error('Path is empty or undefined');
      return;
    }
    

    const numSteps = 100; // Number of steps for the animation
    const timePerStep = 100; // Time between steps in milliseconds
    const stepSize = path.length / numSteps; // Size of each animation step

    let step = 0;

    const animate = () => {
      const point1 = path[Math.floor(step)];
      const point2 = path[Math.ceil(step)];

      if (!point1 || !point2) {
        console.error('Undefined points in path', { point1, point2 });
        return;
      }

      const position = {
        lat: point1.lat + (point2.lat - point1.lat) * (step - Math.floor(step)),
        lng: point1.lng + (point2.lng - point1.lng) * (step - Math.floor(step)),
      };
      const point1LatLng = new window.google.maps.LatLng(point1.lat, point1.lng)
      const point2LatLng = new window.google.maps.LatLng(point2.lat, point2.lng)

      // Calculate rotation angle based on direction between point1 and point2
      const angle = window.google.maps.geometry.spherical.computeHeading(point1LatLng, point2LatLng);
      const actualAngle = angle - 90

      setAnimationMarker(position);
      setMarkerRotation(actualAngle); // Set marker rotation based on angle
        step += stepSize;
        if (step <= path.length) {
          setTimeout(animate, timePerStep);
        } else {
          // Animation completed
          setAnimationMarker(null);
          setMarkerRotation(0);
          setAwaitingUserAction(true); // Set state to await user action after animation
        }
      };

      animate();
    };


    const startAnimation = () => {
      if (directionsList.length > 0 && directionsList[0].routes[0].overview_path) {
        const path = directionsList[0].routes[0].overview_path.map((point) => ({
          lat: point.lat(),
          lng: point.lng(),
        }));

        if (path && path.length > 0) {
          animateMarker(path, 0);
        } else {
          console.error('No valid path found to start animation');
        }
      }
    };

    const continueAnimation = () => {
      const nextPathIndex = currentPathIndex + 1;

      if (nextPathIndex < directionsList.length && directionsList[nextPathIndex].routes[0].overview_path) {
        const path = directionsList[nextPathIndex].routes[0].overview_path.map((point) => ({
          lat: point.lat(),
          lng: point.lng(),
        }));

        if (path && path.length > 0) {
          setCurrentPathIndex(nextPathIndex);
          setAwaitingUserAction(false);
          animateMarker(path, nextPathIndex);
        } else {
          console.error('No valid path found to continue animation');
        }
      }
    };


    const moveDestination = (dragIndex, hoverIndex) => {
      const dragDestination = destinations[dragIndex];
      const newDestinations = [...destinations];
      newDestinations.splice(dragIndex, 1);
      newDestinations.splice(hoverIndex, 0, dragDestination);
      setDestinations(newDestinations);

      // Update the Autocomplete refs array after reordering
      const newAutocompleteRefs = [...autocompleteRefs.current];
      const movedAutocompleteRef = newAutocompleteRefs.splice(dragIndex, 1)[0];
      newAutocompleteRefs.splice(hoverIndex, 0, movedAutocompleteRef);
      autocompleteRefs.current = newAutocompleteRefs;
    };

    const handleDragStart = (index) => (event) => {
      event.dataTransfer.setData('index', index.toString());
    };

    const handleDragOver = (index) => (event) => {
      event.preventDefault();
    };

    const handleDrop = (index) => (event) => {
      event.preventDefault();
      const dragIndex = parseInt(event.dataTransfer.getData('index'));
      moveDestination(dragIndex, index);
    };

    const handlePlaceChanged = (index) => {
      const place = autocompleteRefs.current[index].getPlace();
      if (place.geometry) {
        const destination = {
          name: place.name,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };

        setDestinations((prevDestinations) => {
          const newDestinations = [...prevDestinations];
          newDestinations[index] = destination;

          // Add a new input box if this is the last input box
          if (index === prevDestinations.length - 1) {
            newDestinations.push(null);
          }

          return newDestinations;
        });
      } else {
        console.error("No details available for input: '" + place.name + "'");
      }
    };

    if (loadError) return 'Error loading maps';
    if (!isLoaded) return 'Loading Maps';

    return (
      <div>
        <div className='m-3'>
          <Navbar />
        </div>
        <div className='m-3'>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            zoom={20}  // Set initial zoom level to 20
            center={coordinates}  // Set initial center to the start coordinates
            options={options}
            onLoad={onLoad}
          >
            {animationMarker && (
              <Marker
                position={animationMarker}
                icon={{
                  url: 'https://images.vexels.com/media/users/3/154573/isolated/preview/bd08e000a449288c914d851cb9dae110-hatchback-car-top-view-silhouette-by-vexels.png',
                  scaledSize: new window.google.maps.Size(50, 50), // Adjust size as needed
                  anchor: new window.google.maps.Point(25, 25), // Center the icon
                  rotation: markerRotation, // Rotate the icon based on markerRotation state
                }}
              />
            )}
            {directionsList.map((directions, index) => (
              <DirectionsRenderer key={index} directions={directions} />
            ))}
            {destinations.map((destination, index) => (
              destination && (
                <Marker
                  key={index}
                  position={{ lat: destination.lat, lng: destination.lng }}
                  onClick={() => setSelectedMarker(destination)}
                />
              )
            ))}
            {selectedMarker && (
              <InfoWindow
                position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
                onCloseClick={() => setSelectedMarker(null)}
              >
                <div>
                  <h2>Location Info</h2>
                  <p>Lat: {selectedMarker.lat}</p>
                  <p>Lng: {selectedMarker.lng}</p>
                </div>
              </InfoWindow>
            )}
            {destinations.map((_, index) => (
              <Autocomplete
                key={index} // Ensure each Autocomplete has a unique key
                onLoad={(autocomplete) => autocompleteRefs.current[index] = autocomplete}
                onPlaceChanged={() => handlePlaceChanged(index)}
              >
                <input
                  type="text"
                  placeholder={`Enter destination ${index + 1}`}
                  style={{
                    boxSizing: `border-box`,
                    border: `1px solid transparent`,
                    width: `240px`,
                    height: `32px`,
                    padding: `0 12px`,
                    borderRadius: `3px`,
                    boxShadow: `0 2px 6px rgba(0, 0, 0, 0.3)`,
                    fontSize: `14px`,
                    outline: `none`,
                    textOverflow: `ellipses`,
                    position: "absolute",
                    left: "85%",
                    marginLeft: "-120px",
                    marginTop: `${10 + index * 40}px`,
                  }}
                  draggable
                  onDragStart={handleDragStart(index)}
                  onDragOver={handleDragOver(index)}
                  onDrop={handleDrop(index)}
                />
              </Autocomplete>
            ))}
          </GoogleMap>
          {totalDistance && (
            <div style={{ marginTop: '20px', fontSize: '18px' }}>
              Total Distance: {(totalDistance / 1000).toFixed(2)} km
            </div>
          )}
          {!awaitingUserAction && (
            <button onClick={startAnimation} style={{ marginTop: '16px' }}>
              Start Animation
            </button>
          )}
          {awaitingUserAction && (
            <button onClick={continueAnimation} style={{ marginTop: '16px' }}>
              Continue to Next Destination
            </button>
          )}
          {currentTripDistance !== null && (
            <div style={{ marginTop: '20px', fontSize: '14px' }}>
              Current Trip Distance: {(currentTripDistance / 1000).toFixed(2)} km
            </div>
          )}
          {distanceMatrix.length > 0 && (
            <table style={{ marginTop: '20px', border: '1px solid black', width: '100%', textAlign: 'center' }}>
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Distance (km)</th>
                </tr>
              </thead>
              <tbody>
                {distanceMatrix.map((distance, index) => (
                  <tr key={index}>
                    <td>{index === 0 ? 'Start' : destinations[index - 1]?.name}</td>
                    <td>{destinations[index]?.name}</td>
                    <td>{(distance / 1000).toFixed(2)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan="2"><strong>Total Distance</strong></td>
                  <td><strong>{(totalDistance / 1000).toFixed(2)} km</strong></td>
                </tr>
              </tbody>
            </table>
          )}
          <div style={{ marginTop: '20px' }}>
          </div>
        </div>
        <div className='m-3'>
          <Footer />
        </div>
      </div>
    );
  }
