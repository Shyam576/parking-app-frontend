import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Modal,
  NativeSyntheticEvent,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { MaterialIcons, FontAwesome } from "@expo/vector-icons";
import MapView, { Marker } from "react-native-maps";

import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface AddParkingLotProps {
  navigation: {
    goBack: () => void;
  };
}

export default function AddParkingLot({ navigation }: AddParkingLotProps) {
  const [name, setName] = useState<string>("");
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [capacity, setCapacity] = useState<string>("");
  const [available, setAvailable] = useState<string>("");
  const [rate, setRate] = useState<string>("");
  const [mapModalVisible, setMapModalVisible] = useState<boolean>(false);
  const [selectedLocation, setSelectedLocation] = useState<Coordinates | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [loadingLocation, setLoadingLocation] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission to access location was denied");
        return;
      }

      setLoadingLocation(true);
      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      setLoadingLocation(false);
    })();
  }, []);

  const handleMapPress = (e: NativeSyntheticEvent<{ coordinate: Coordinates }>) => {
    const coordinate = e.nativeEvent.coordinate;
    setSelectedLocation(coordinate);
    setLatitude(coordinate.latitude.toString());
    setLongitude(coordinate.longitude.toString());
  };

  const useCurrentLocation = () => {
    if (currentLocation) {
      setSelectedLocation(currentLocation);
      setLatitude(currentLocation.latitude.toString());
      setLongitude(currentLocation.longitude.toString());
    }
  };

  const handleAddParkingLot = async () => {
    if (!name || !latitude || !longitude || !capacity || !available || !rate) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    try {
      const response = await fetch("http://172.20.10.3:4000/api/parking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          capacity: parseInt(capacity),
          available: parseInt(available),
          rate: parseInt(rate),
        }),
      });

      if (response.ok) {
        Alert.alert("Success", "Parking lot added successfully!", [
          {
            text: "OK",
            onPress: () => {
              setName("");
              setLatitude("");
              setLongitude("");
              setCapacity("");
              setAvailable("");
              setRate("");
            },
          },
        ]);
      } else {
        const errorData = await response.json();
        Alert.alert("Error", errorData.error || "Failed to add parking lot.");
      }
    } catch (error) {
      console.error("Error adding parking lot:", error);
      Alert.alert("Error", "An error occurred while adding the parking lot.");
    }
  };

  return (
    <LinearGradient colors={["#f5f7fa", "#e4e8f0"]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Add New Parking Lot</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Parking Lot Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter parking lot name"
            value={name}
            onChangeText={setName}
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Location</Text>
          <TouchableOpacity
            style={styles.mapInput}
            onPress={() => setMapModalVisible(true)}
          >
            <Text style={latitude ? styles.mapInputText : styles.mapInputPlaceholder}>
              {latitude ? `${latitude}, ${longitude}` : "Select location on map"}
            </Text>
            <MaterialIcons name="map" size={20} color="#3a86ff" />
          </TouchableOpacity>

          <View style={styles.row}>
            <View style={styles.column}>
              <Text style={styles.label}>Capacity</Text>
              <TextInput
                style={styles.input}
                placeholder="Total spots"
                value={capacity}
                onChangeText={setCapacity}
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
            </View>
            <View style={styles.column}>
              <Text style={styles.label}>Available</Text>
              <TextInput
                style={styles.input}
                placeholder="Available spots"
                value={available}
                onChangeText={setAvailable}
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          <Text style={styles.label}>Rate per Hour (Nu.)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter hourly rate"
            value={rate}
            onChangeText={setRate}
            keyboardType="numeric"
            placeholderTextColor="#999"
          />

          <TouchableOpacity style={styles.button} onPress={handleAddParkingLot}>
            <LinearGradient
              colors={["#3a86ff", "#2667cc"]}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>Add Parking Lot</Text>
              <MaterialIcons name="add-location" size={20} color="white" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Map Selection Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={mapModalVisible}
        onRequestClose={() => setMapModalVisible(false)}
      >
        <View style={styles.mapContainer}>
          <View style={styles.mapHeader}>
            <TouchableOpacity onPress={() => setMapModalVisible(false)}>
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.mapTitle}>Select Parking Location</Text>
            <TouchableOpacity
              onPress={useCurrentLocation}
              disabled={!currentLocation || loadingLocation}
            >
              <MaterialIcons
                name="my-location"
                size={24}
                color={currentLocation && !loadingLocation ? "#3a86ff" : "#ccc"}
              />
            </TouchableOpacity>
          </View>

          {currentLocation ? (
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              }}
              onPress={handleMapPress}
            >
              {selectedLocation && (
                <Marker coordinate={selectedLocation}>
                  <View style={styles.selectedMarker}>
                    <FontAwesome name="map-marker" size={30} color="#3a86ff" />
                  </View>
                </Marker>
              )}
            </MapView>
          ) : (
            <View style={styles.loadingMap}>
              <ActivityIndicator size="large" color="#3a86ff" />
              <Text>Loading map...</Text>
            </View>
          )}

          <View style={styles.mapFooter}>
            <Text style={styles.selectedLocationText}>
              {selectedLocation
                ? `Selected: ${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`
                : "Tap on the map to select location"}
            </Text>
            <TouchableOpacity
              style={styles.confirmLocationButton}
              onPress={() => setMapModalVisible(false)}
              disabled={!selectedLocation}
            >
              <Text style={styles.confirmLocationButtonText}>
                Confirm Location
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    marginTop:50
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
  },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
  },
  mapInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
  },
  mapInputText: {
    fontSize: 16,
    color: "#333",
  },
  mapInputPlaceholder: {
    fontSize: 16,
    color: "#999",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  column: {
    width: "48%",
  },
  button: {
    marginTop: 25,
    borderRadius: 8,
    overflow: "hidden",
  },
  buttonGradient: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 10,
  },
  mapContainer: {
    flex: 1,
  },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    marginTop:50,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  map: {
    width: "100%",
    height: height * 0.7,
  },
  loadingMap: {
    width: "100%",
    height: height * 0.7,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedMarker: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  mapFooter: {
    padding: 20,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  selectedLocationText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 15,
    textAlign: "center",
  },
  confirmLocationButton: {
    backgroundColor: "#3a86ff",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  confirmLocationButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});