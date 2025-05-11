import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  TextInput,
  Alert,
  Modal,
  Animated,
  Easing,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { MaterialIcons, FontAwesome, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";

interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface ParkingLot {
  _id: number;
  name: string;
  latitude: number;
  longitude: number;
  capacity: number;
  available: number;
  rate: number;
  ratings?: number[];
}

const INITIAL_REGION = {
  latitude: 27.4728, // Thimphu coordinates
  longitude: 89.6393,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

type MapType = "standard" | "satellite" | "hybrid" | "terrain";

export default function App() {
  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [parkingLots, setParkingLots] = useState<ParkingLot[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [mapType, setMapType] = useState<MapType>("standard");
  const [showTraffic, setShowTraffic] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedParkingLot, setSelectedParkingLot] =
    useState<ParkingLot | null>(null);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [refresh, setRefresh] = useState<boolean>(false);
  const slideAnim = useRef(new Animated.Value(300)).current;

  const fetchParkingLots = async () => {
    try {
      setLoading(true);

      const serviceStatus = await Location.hasServicesEnabledAsync();
      if (!serviceStatus) {
        setErrorMsg("Location services are disabled");
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permission to access location was denied");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      // Fetch parking lots from the backend
      const response = await fetch(
        `http://172.20.10.3:4000/api/parking/nearby?lat=${loc.coords.latitude}&lng=${loc.coords.longitude}&radius=5`
      );
      const data = await response.json();
      setParkingLots(data);

      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          1000
        );
      }
    } catch (error) {
      console.error("Error fetching parking lots:", error);
      setErrorMsg("Failed to fetch parking lots");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchParkingLots();
    }, [])
  );

  useEffect(() => {
    if (refresh) {
      fetchParkingLots();
    }
  }, [refresh]);

  useEffect(() => {
    if (selectedParkingLot) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        easing: Easing.in(Easing.exp),
        useNativeDriver: true,
      }).start();
    }
  }, [selectedParkingLot]);

  const changeMapType = () => {
    const mapTypes: MapType[] = ["standard", "satellite", "hybrid", "terrain"];
    const currentIndex = mapTypes.indexOf(mapType);
    const nextIndex = (currentIndex + 1) % mapTypes.length;
    setMapType(mapTypes[nextIndex]);
  };

  const toggleTraffic = () => {
    setShowTraffic(!showTraffic);
  };

  const toggleControls = () => {
    setShowControls(!showControls);
  };

  const focusOnUserLocation = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );
    }
  };

const handleBooking = async (id: string) => {
  try {
    // Optimistically update the UI immediately
    setParkingLots(prevLots => 
      prevLots.map(lot => 
        lot._id === Number(id) 
          ? { ...lot, available: lot.available - 1 } 
          : lot
      )
    );
    
    if (selectedParkingLot) {
      setSelectedParkingLot(prev => ({
        ...prev!,
        available: prev!.available - 1
      }));
    }

    const response = await fetch("http://172.20.10.3:4000/api/parking/book", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Revert the optimistic update if the server request fails
      setParkingLots(prevLots => 
        prevLots.map(lot => 
          lot._id === Number(id) 
            ? { ...lot, available: lot.available + 1 } 
            : lot
        )
      );
      
      if (selectedParkingLot) {
        setSelectedParkingLot(prev => ({
          ...prev!,
          available: prev!.available + 1
        }));
      }

      Alert.alert("Booking Failed", data.message || "Failed to book parking spot.");
      return;
    }

    // Final refresh to ensure complete sync with server
    fetchParkingLots();

    Alert.alert(
      "Booking Confirmed",
      `Your parking spot at ${selectedParkingLot?.name} has been booked successfully!`,
      [
        {
          text: "OK",
          onPress: () => setSelectedParkingLot(null),
        },
      ]
    );
  } catch (error) {
    console.error("Error booking parking spot:", error);
    
    // Revert the optimistic update on error
    setParkingLots(prevLots => 
      prevLots.map(lot => 
        lot._id === Number(id) 
          ? { ...lot, available: lot.available + 1 } 
          : lot
      )
    );
    
    if (selectedParkingLot) {
      setSelectedParkingLot(prev => ({
        ...prev!,
        available: prev!.available + 1
      }));
    }

    Alert.alert("Error", "An error occurred while booking the parking spot.");
  }
};


  const handleRatingSubmit = async () => {
    if (!selectedParkingLot || selectedRating === 0) return;

    try {
      const response = await fetch("http://172.20.10.3:4000/api/parking/rate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selectedParkingLot._id.toString(),
          rating: selectedRating,
        }),
      });

      const data = await response.json();

      if (response.ok) {

        const refreshResponse = await fetch(
          `http://172.20.10.3:4000/api/parking/nearby?lat=${location?.latitude}&lng=${location?.longitude}&radius=5`
        );
        const refreshedData = await refreshResponse.json();
        setParkingLots(refreshedData);
        Alert.alert(
          "Thank You!",
          "Your rating has been submitted successfully."
        );
        setRefresh((prev) => !prev);
        setRatingModalVisible(false);
        setSelectedRating(0);
        setHoverRating(0);
      } else {
        Alert.alert("Error", data.message || "Failed to submit rating.");
      }
    } catch (error) {
      console.error("Error submitting rating:", error);
      Alert.alert("Error", "An error occurred while submitting the rating.");
    }
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const estimateTime = (distance: number, speed: number = 40): number => {
    return distance / speed;
  };

  const getAverageRating = (ratings?: number[]): number => {
    if (!ratings || ratings.length === 0) return 0;
    const sum = ratings.reduce((a, b) => a + b, 0);
    return sum / ratings.length;
  };

  const filteredParkingLots = parkingLots.filter((lot) =>
    lot.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={["#4c669f", "#3b5998", "#192f6a"]}
          style={styles.gradientBackground}
        >
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Finding parking near you...</Text>
        </LinearGradient>
      </View>
    );
  }
  let markerClicked = false;

  if (errorMsg) {
    return (
      <View style={styles.errorContainer}>
        <LinearGradient
          colors={["#ff4d4d", "#ff1a1a", "#cc0000"]}
          style={styles.gradientBackground}
        >
          <MaterialIcons name="error-outline" size={48} color="white" />
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setLoading(true);
              setErrorMsg(null);
              setRefresh((prev) => !prev);
            }}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchBar}
            placeholder="Search parking lots..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={styles.searchIcon}>
            <MaterialIcons name="search" size={24} color="#4a90e2" />
          </TouchableOpacity>
        </View>

        {/* Map View */}
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={INITIAL_REGION}
          showsUserLocation={true}
          showsMyLocationButton={false}
          followsUserLocation={true}
          loadingEnabled={true}
          mapType={mapType}
          showsBuildings={true}
          showsCompass={true}
          showsIndoors={false}
          showsPointsOfInterest={true}
          onPress={() => {
            if (!markerClicked) {
              setSelectedParkingLot(null); // Reset selected parking lot only if no marker was clicked
            }
            markerClicked = false; // Reset the flag after handling the event
          }}
        >
          {filteredParkingLots.map((lot) => (
            <Marker
              key={lot._id}
              coordinate={{
                latitude: lot.latitude,
                longitude: lot.longitude,
              }}
              onPress={() => {
                markerClicked = true; 
                setSelectedParkingLot(lot); 
              }}
            >
              <View style={styles.markerContainer}>
                <View style={styles.markerPin}>
                  <Text style={styles.markerPinText}>{lot.available}</Text>
                </View>
              </View>
            </Marker>
          ))}
        </MapView>

        {/* Parking Lot Details Panel */}
        {selectedParkingLot && (
          <Animated.View
            style={[
              styles.detailsPanel,
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            <LinearGradient
              colors={["#ffffff", "#f7f7f7"]}
              style={styles.panelGradient}
            >
              <TouchableOpacity
                style={styles.closePanelButton}
                onPress={() => setSelectedParkingLot(null)}
              >
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>

              <Text style={styles.panelTitle}>{selectedParkingLot.name}</Text>

              <View style={styles.panelRow}>
                <MaterialIcons name="local-parking" size={20} color="#4a90e2" />
                <Text style={styles.panelText}>
                  {selectedParkingLot.available} / {selectedParkingLot.capacity}{" "}
                  spots available
                </Text>
              </View>

              <View style={styles.panelRow}>
                <MaterialIcons name="attach-money" size={20} color="#4CAF50" />
                <Text style={styles.panelText}>
                  Nu. {selectedParkingLot.rate} per hour
                </Text>
              </View>

              {location && (
                <View style={styles.panelRow}>
                  <MaterialIcons name="directions" size={20} color="#FF5722" />
                  <Text style={styles.panelText}>
                    {calculateDistance(
                      location.latitude,
                      location.longitude,
                      selectedParkingLot.latitude,
                      selectedParkingLot.longitude
                    ).toFixed(2)}{" "}
                    km away (~
                    {(
                      estimateTime(
                        calculateDistance(
                          location.latitude,
                          location.longitude,
                          selectedParkingLot.latitude,
                          selectedParkingLot.longitude
                        )
                      ) * 60
                    ).toFixed(0)}{" "}
                    mins)
                  </Text>
                </View>
              )}

              {selectedParkingLot.ratings &&
                selectedParkingLot.ratings.length > 0 && (
                  <View style={styles.panelRow}>
                    <FontAwesome name="star" size={20} color="#FFD700" />
                    <Text style={styles.panelText}>
                      {getAverageRating(selectedParkingLot.ratings).toFixed(1)}{" "}
                      ({selectedParkingLot.ratings.length} ratings)
                    </Text>
                  </View>
                )}

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    selectedParkingLot.available === 0 && styles.disabledButton,
                  ]}
                  onPress={() =>
                    handleBooking(selectedParkingLot._id.toString())
                  }
                  disabled={selectedParkingLot.available === 0}
                >
                  <Text style={styles.actionButtonText}>
                    {selectedParkingLot.available === 0
                      ? "FULLY BOOKED"
                      : "BOOK NOW"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.rateButton}
                  onPress={() => setRatingModalVisible(true)}
                >
                  <Text style={styles.rateButtonText}>RATE THIS LOT</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Map Controls */}
        <TouchableOpacity style={styles.menuButton} onPress={toggleControls}>
          <MaterialIcons
            name={showControls ? "close" : "menu"}
            size={24}
            color="white"
          />
        </TouchableOpacity>

        {showControls && (
          <View style={styles.controlsContainer}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={focusOnUserLocation}
            >
              <MaterialIcons name="my-location" size={24} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={changeMapType}
            >
              <MaterialIcons name="map" size={24} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={toggleTraffic}
            >
              <MaterialIcons
                name="traffic"
                size={24}
                color={showTraffic ? "#FF5252" : "white"}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Rating Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={ratingModalVisible}
          onRequestClose={() => {
            setRatingModalVisible(false);
            setSelectedRating(0);
            setHoverRating(0);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Rate This Parking Lot</Text>
              <Text style={styles.modalSubtitle}>
                {selectedParkingLot?.name}
              </Text>

              <View style={styles.starContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setSelectedRating(star)}
                    onPressIn={() => setHoverRating(star)}
                    onPressOut={() => setHoverRating(selectedRating)}
                  >
                    <FontAwesome
                      name="star"
                      size={40}
                      color={
                        star <= (hoverRating || selectedRating)
                          ? "#FFD700"
                          : "#ddd"
                      }
                      style={styles.star}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalButtonContainer}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setRatingModalVisible(false);
                    setSelectedRating(0);
                    setHoverRating(0);
                  }}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalSubmitButton,
                    selectedRating === 0 && styles.disabledButton,
                  ]}
                  onPress={handleRatingSubmit}
                  disabled={selectedRating === 0}
                >
                  <Text style={styles.modalSubmitButtonText}>Submit</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
  },
  gradientBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
  loadingContainer: {
    flex: 1,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    color: "white",
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
  },
  errorText: {
    marginTop: 20,
    fontSize: 18,
    color: "white",
    fontWeight: "500",
    textAlign: "center",
    paddingHorizontal: 30,
  },
  retryButton: {
    marginTop: 30,
    backgroundColor: "white",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: "#cc0000",
    fontSize: 16,
    fontWeight: "600",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  searchContainer: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
    width:'80%'
  },
  searchBar: {
    backgroundColor: "white",
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 16,
    paddingLeft: 50,
    color: "#333",
  },
  searchIcon: {
    position: "absolute",
    left: 15,
    top: 15,
  },
  markerContainer: {
    alignItems: "center",
  },
  selectedMarker: {
    zIndex: 100,
  },
  markerPin: {
    backgroundColor: "#4a90e2",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  markerPinFull: {
    backgroundColor: "#ff5252",
  },
  markerPinText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  markerPointer: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#4a90e2",
    transform: [{ translateY: -4 }],
  },
  detailsPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
    marginBottom: 50,
    zIndex: 100,
  },
  panelGradient: {
    borderRadius: 20,
    padding: 20,
  },
  closePanelButton: {
    position: "absolute",
    top: 15,
    right: 15,
    zIndex: 101,
  },
  panelTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#333",
    marginBottom: 15,
    marginRight: 30,
  },
  panelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  panelText: {
    fontSize: 16,
    color: "#555",
    marginLeft: 10,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  actionButton: {
    backgroundColor: "#4a90e2",
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 25,
    flex: 1,
    marginRight: 10,
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: "#cccccc",
  },
  actionButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 12,
  },
  rateButton: {
    backgroundColor: "#f8f8f8",
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#4a90e2",
    alignItems: "center",
  },
  rateButtonText: {
    color: "#4a90e2",
    fontWeight: "bold",
    fontSize: 16,
  },
  menuButton: {
    position: "absolute",
    top: 50,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1001,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  controlsContainer: {
    position: "absolute",
    top: 110,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 25,
    padding: 10,
    alignItems: "center",
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 25,
    width: "80%",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },
  starContainer: {
    flexDirection: "row",
    marginVertical: 20,
  },
  star: {
    marginHorizontal: 5,
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 20,
  },
  modalCancelButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
  },
  modalCancelButtonText: {
    color: "#666",
    fontWeight: "600",
  },
  modalSubmitButton: {
    backgroundColor: "#4a90e2",
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
  },
  modalSubmitButtonText: {
    color: "white",
    fontWeight: "600",
  },
});
