import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import React, { useCallback, useState } from "react";
import StyledText from "@/app/components/helpers/StyledText";
import MyVehicleStatsComponent from "@/app/components/garage/MyVehicleStatsComponent";
import PromotionsCardComponent from "@/app/components/booking/PromotionsCard";
import useGarage from "@/app/app-hooks/useGarage";
import GarageVehicleComponent from "@/app/components/garage/GarageVehicleComponent";
import StyledButton from "@/app/components/helpers/StyledButton";
import { MaterialIcons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import { router } from "expo-router";
import ModalServices from "@/app/utils/ModalServices";
import AddNewVehicle from "@/app/components/garage/AddNewVehicle";

const GarageScreen = () => {
  const {
    vehicleStats,
    vehicles,
    isModalVisible,
    setIsModalVisible,
    isLoadingVehicles,
    handleDeleteVehicle,
    refetchVehicles,
    handleVehicleStatsSelection,
    handleViewDetailsPress,
  } = useGarage();

  const backgroundColor = useThemeColor({}, "background");
  const iconColor = useThemeColor({}, "icons");
  const textColor = useThemeColor({}, "text");

  const [isAddVehicleModalVisible, setIsAddVehicleModalVisible] =
    useState(false);

  const vehicleStatsSelection = useCallback(
    (vehicleId: string) => {
      handleVehicleStatsSelection(vehicleId);
      setIsModalVisible(true);
    },
    [handleVehicleStatsSelection, setIsModalVisible]
  );

  return (
    <View style={[styles.maincontainer, { backgroundColor }]}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isLoadingVehicles}
            onRefresh={() => refetchVehicles()}
          />
        }
      >
        <View style={styles.headerSection}>
          <StyledText
            children="My Garage"
            variant="titleMedium"
            style={{ color: textColor }}
          />
          <StyledButton
            title="Add Vehicle"
            variant="medium"
            onPress={() => {
              setIsAddVehicleModalVisible(true);
            }}
          />
        </View>
        {/* Display the list of cars the user has added in a 2-column grid */}
        <View style={styles.myvehiclecontainer}>
          {isLoadingVehicles ? (
            <StyledText
              variant="bodyMedium"
              style={{ textAlign: "center", padding: 20 }}
            >
              Loading vehicles...
            </StyledText>
          ) : vehicles && vehicles.length > 0 ? (
            <View style={styles.vehiclesGrid}>
              {vehicles.map((vehicle, index) => (
                <GarageVehicleComponent
                  key={index}
                  vehicle={vehicle}
                  onViewDetailsPress={async () => {
                    const success = await handleViewDetailsPress(vehicle.id);
                    if (success) {
                      setIsModalVisible(true);
                    }
                  }}
                  onBookServicePress={() => {
                    router.push("/main/(tabs)/bookings/BookingScreen");
                  }}
                  onDeletePress={() => handleDeleteVehicle(vehicle.id)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyStateContainer}>
              <MaterialIcons
                name="directions-car"
                size={80}
                color={iconColor}
                style={styles.emptyStateIcon}
              />
              <StyledText
                variant="titleMedium"
                style={[styles.emptyStateTitle, { color: textColor }]}
              >
                No Vehicles Yet
              </StyledText>
              <StyledText
                variant="bodyMedium"
                style={[styles.emptyStateDescription, { color: textColor }]}
              >
                You haven't added any vehicles to your garage yet. Add your
                first vehicle to get started with our services.
              </StyledText>
            </View>
          )}
        </View>
      </ScrollView>

      {/* This component will display a mopre detailed information about the clients car and how the car has been services overtime. this is a more detailed view. */}

      <ModalServices
        visible={isAddVehicleModalVisible}
        onClose={() => setIsAddVehicleModalVisible(false)}
        component={
          <AddNewVehicle
            setIsAddVehicleModalVisible={setIsAddVehicleModalVisible}
          />
        }
        modalType="fullscreen"
        animationType="slide"
        showCloseButton={true}
        title="Add New Vehicle"
      />

      <ModalServices
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        component={
          <MyVehicleStatsComponent
            onBookWash={() => {
              router.push("/main/(tabs)/bookings/BookingScreen");
            }}
            vehicleStats={vehicleStats}
          />
        }
        modalType="sheet"
        animationType="slide"
        showCloseButton={true}
        title="More Indepth details about your vehicle"
      />
    </View>
  );
};

export default GarageScreen;

const styles = StyleSheet.create({
  maincontainer: {
    flex: 1,
  },
  headerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 5,
    paddingHorizontal: 10,
  },
  myvehiclecontainer: {
    flex: 1,
    paddingHorizontal: 10,
  },
  vehiclesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateIcon: {
    marginBottom: 20,
    opacity: 0.7,
  },
  emptyStateTitle: {
    textAlign: "center",
    marginBottom: 12,
    fontWeight: "600",
  },
  emptyStateDescription: {
    textAlign: "center",
    lineHeight: 22,
    opacity: 0.8,
  },
});
