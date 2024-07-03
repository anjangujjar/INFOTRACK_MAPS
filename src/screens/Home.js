import React, { useEffect, useState, useRef } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  GoogleMap,
  useLoadScript,
  Marker,
  Autocomplete,
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

const iconOptions = [
  { label: "Motorcycle", url: "https://clipground.com/images/moto-vector-png-3.png" },
  { label: "Blue Dot", url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" },
  { label: "Car", url: "https://www.google.com/url?sa=i&url=https%3A%2F%2Fwww.pngegg.com%2Fen%2Fpng-bkiud&psig=AOvVaw2AKinA8_YB854iZGmhuHAw&ust=1719991460269000&source=images&cd=vfe&opi=89978449&ved=0CBQQjRxqFwoTCKD2rdLph4cDFQAAAAAdAAAAABAI" },
  { label: "Cycle", url: "https://img.icons8.com/emoji/48/000000/bicycle-emoji.png" }
];

export default function Home() {
  const [coordinates, setCoordinates] = useState({ lat: 0, lng: 0 }); // Default coordinates
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
  const [selectedIcon, setSelectedIcon] = useState(iconOptions[0].url); // State for selected icon
  const mapRef = useRef(null); // Reference for Google Map
  const [markerRotation, setMarkerRotation] = useState(0); // State for marker rotation

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: 'AIzaSyDegNkC-GwWieiu1tjffn8e0JZt9ikMyvc', // Add your Google Maps API key here
    libraries,
  });

  useEffect(() => {
    const storedLocation = localStorage.getItem('location');
    if (storedLocation) {
      const [lat, long] = storedLocation.replace('Lat: ', '').replace('Long: ', '').split(', ');
      setCoordinates({ lat: parseFloat(lat), lng: parseFloat(long) });
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
  };

  const startAnimation = () => {
    if (directionsList.length > 0) {
      setAnimationMarker(coordinates);
      setCurrentPathIndex(0);
      setAwaitingUserAction(false);
      animateMarker(directionsList[0].routes[0].overview_path, 0);
    }
  };

  const continueAnimation = () => {
    if (currentPathIndex < directionsList.length) {
      setAwaitingUserAction(false);
      animateMarker(directionsList[currentPathIndex].routes[0].overview_path, currentPathIndex);
    }
  };

  const animateMarker = (path, pathIndex) => {
    let step = 0;
    const numSteps = 2000; // Number of steps for the animation
    const timePerStep = 80; // Time between steps in milliseconds

    // Fit map to bounds of the current path
    const bounds = new window.google.maps.LatLngBounds();
    path.forEach((point) => {
      bounds.extend(point);
    });
    mapRef.current.fitBounds(bounds);

    const nextStep = () => {
      if (step >= numSteps || step >= path.length - 1) {
        if (pathIndex < directionsList.length - 1) {
          setCurrentPathIndex(pathIndex + 1);
          setAwaitingUserAction(true);
        } else {
          console.log('Animation complete');
        }
        return;
      }

      const start = path[step];
      const end = path[step + 1];
      const heading = window.google.maps.geometry.spherical.computeHeading(start, end);

      // Interpolate the position
      const fraction = (1 / numSteps) * step;
      const position = window.google.maps.geometry.spherical.interpolate(start, end, fraction);

      setAnimationMarker({
        lat: position.lat(),
        lng: position.lng()
      });

      // Update the map's heading and center for 3D effect
      mapRef.current.setHeading(heading);
      mapRef.current.setCenter(position);

      // Update marker rotation
      setMarkerRotation(heading);

      // Update current trip distance
      const tripDistance = window.google.maps.geometry.spherical.computeDistanceBetween(
        path[0],
        position
      );
      setCurrentTripDistance(tripDistance);

      step += 1;
      setTimeout(nextStep, timePerStep);
    };
    nextStep();
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
          zoom={8}
          center={coordinates}
          options={options}
          onLoad={onLoad}
        >
          {animationMarker && (
            <Marker
              position={animationMarker}
              icon={{
                url: selectedIcon,
                scaledSize: new window.google.maps.Size(32, 32),
              }}
              rotation={markerRotation}
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
          <label htmlFor="icon-select">Select Animation Icon:</label>
          <select
            id="icon-select"
            value={selectedIcon}
            onChange={(e) => setSelectedIcon(e.target.value)}
            style={{ marginLeft: '10px' }}
          >
            {iconOptions.map((option) => (
              <option key={option.url} value={option.url}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className='m-3'>
        <Footer />
      </div>
    </div>
  );
}
