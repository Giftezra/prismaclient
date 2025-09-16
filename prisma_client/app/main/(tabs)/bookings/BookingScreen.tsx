import React, { useState } from "react";
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import { router } from "expo-router";
import { Stack } from "expo-router";

// Import booking components
import VehicleSelector from "@/app/components/booking/VehicleSelector";
import ServiceTypeCard from "@/app/components/booking/ServiceTypeCard";
import ValetTypeCard from "@/app/components/booking/ValetTypeCard";
import AddressSelector from "@/app/components/booking/AddressSelector";
import TimeSlotPicker from "@/app/components/booking/TimeSlotPicker";
import BookingSummary from "@/app/components/booking/BookingSummary";
import AddonSelection from "@/app/components/booking/AddonSelection";

// Import helpers
import StyledText from "@/app/components/helpers/StyledText";
import StyledButton from "@/app/components/helpers/StyledButton";

// Import hook
import useBooking from "@/app/app-hooks/useBooking";

// Import modal
import AddAddressModal from "@/app/components/profile/AddAddressModal";
import { MyAddressProps } from "@/app/interfaces/ProfileInterfaces";
import StyledTextInput from "@/app/components/helpers/StyledTextInput";
import { useAddresses } from "@/app/app-hooks/useAddresses";
import useVehicles from "@/app/app-hooks/useVehicles";
import ModalServices from "@/app/utils/ModalServices";
import PromotionsCardComponent from "@/app/components/booking/PromotionsCard";
import { PromotionsProps } from "@/app/interfaces/GarageInterface";


// Define step interface
interface BookingStep {
  id: number;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const BookingScreen = () => {
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const cardColor = useThemeColor({}, "cards");
  const primaryPurpleColor = useThemeColor({}, "primary");
  const iconColor = useThemeColor({}, "icons");
  const borderColor = useThemeColor({}, "borders");

  const {
    // State
    selectedVehicle,
    selectedServiceType,
    selectedValetType,
    selectedAddress,
    selectedDate,
    specialInstructions,
    currentStep,
    isLoading,
    isSUV,
    promotions,

    // Addon management state
    selectedAddons,
    isAddonModalVisible,

    // Time slot management state
    availableTimeSlots,
    isLoadingSlots,
    currentMonth,
    selectedDay,

    // Data
    addOns,
    serviceTypes,
    valetTypes,
    isLoadingAddOns,
    isLoadingServiceTypes,
    isLoadingValetTypes,
    user,

    // Handlers
    handleVehicleSelection,
    handleSUVChange,
    handleServiceTypeSelection,
    handleValetTypeSelection,
    handleAddressSelection,
    handleDateChange,
    handleSpecialInstructionsChange,
    handleNextStep,
    handlePreviousStep,
    handleGoToStep,

    // Addon management handlers
    handleAddonSelection,
    handleAddonSelectionWithRefresh,
    handleCloseAddonModal,
    handleConfirmAddons,

    // Time slot management handlers
    handleTimeSlotSelect,
    handleDaySelection,
    handleMonthNavigation,
    hasSelectedTimeSlot,

    // Validation
    isStepValid,
    canProceedToNextStep,
    canProceedToSummary,

    // Booking
    createBooking,
    resetBooking,

    // Utilities
    getTotalPrice,
    getBasePrice,
    getSUVPrice,
    getAddonPrice,
    getAddonDuration,
    getEstimatedDuration,
    formatPrice,
    formatDuration,
    handleBookingConfirmation,
    isLoadingBooking,

    // Loyalty-related methods
    getOriginalPrice,
    getFinalPrice,
    getLoyaltyDiscount,
  } = useBooking();

  const { addresses } = useAddresses();
  const { vehicles } = useVehicles();

  const [showSpecialInstructions, setShowSpecialInstructions] = useState(false);
  const [isAddressModalVisible, setIsAddressModalVisible] = useState(false);

  const steps: BookingStep[] = [
    { id: 1, title: "Vehicle", icon: "car" },
    { id: 2, title: "Service", icon: "construct" },
    { id: 3, title: "Valet", icon: "water" },
    { id: 4, title: "Details", icon: "calendar" },
    { id: 5, title: "Summary", icon: "checkmark-circle" },
  ];

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {steps.map((step, index) => (
        <View key={step.id} style={styles.stepContainer}>
          <TouchableOpacity
            style={[
              styles.stepButton,
              {
                backgroundColor:
                  currentStep >= step.id ? primaryPurpleColor : cardColor,
                borderColor: textColor,
              },
            ]}
            onPress={() => handleGoToStep(step.id)}
            disabled={!isStepValid(step.id) && step.id > currentStep}
          >
            <Ionicons name={step.icon} size={20} color={iconColor} />
          </TouchableOpacity>
          <StyledText
            variant="bodySmall"
            style={[
              styles.stepTitle,
              {
                color: currentStep >= step.id ? primaryPurpleColor : textColor,
                fontWeight: currentStep === step.id ? "600" : "400",
              },
            ]}
          >
            {step.title}
          </StyledText>
          {index < steps.length - 1 && (
            <View
              style={[
                styles.stepLine,
                {
                  backgroundColor:
                    currentStep > step.id ? primaryPurpleColor : "#E5E5E5",
                },
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <VehicleSelector
            vehicles={vehicles}
            selectedVehicle={selectedVehicle}
            onSelectVehicle={handleVehicleSelection}
            onAddVehicle={() => router.push("/main/(tabs)/garage/GarageScreen")}
            isSUV={isSUV}
            onSUVChange={handleSUVChange}
          />
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <StyledText
              variant="titleMedium"
              style={[styles.stepHeader, { color: textColor }]}
            >
              Choose Service Type
            </StyledText>
            {serviceTypes?.map((service) => (
              <ServiceTypeCard
                key={service.id}
                service={service}
                isSelected={selectedServiceType?.id === service.id}
                onSelect={handleServiceTypeSelection}
              />
            ))}
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <StyledText
              variant="titleMedium"
              style={[styles.stepHeader, { color: textColor }]}
            >
              Choose Valet Type
            </StyledText>
            {valetTypes?.map((valetType) => (
              <ValetTypeCard
                key={valetType.id}
                valetType={valetType}
                isSelected={selectedValetType?.id === valetType.id}
                onSelect={handleValetTypeSelection}
              />
            ))}
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContent}>
            <AddressSelector
              addresses={addresses}
              selectedAddress={selectedAddress}
              onSelectAddress={handleAddressSelection}
              onAddAddress={() => setIsAddressModalVisible(true)}
            />

            {selectedServiceType ? (
              <TimeSlotPicker
                selectedDate={selectedDate}
                onDateChange={handleDateChange}
                minimumDate={new Date()}
                serviceDuration={getEstimatedDuration()}
                serviceTypeName={selectedServiceType.name}
                availableTimeSlots={availableTimeSlots}
                isLoadingSlots={isLoadingSlots}
                currentMonth={currentMonth}
                selectedDay={selectedDay}
                onDaySelection={handleDaySelection}
                onMonthNavigation={handleMonthNavigation}
                onTimeSlotSelect={handleTimeSlotSelect}
                hasSelectedTimeSlot={hasSelectedTimeSlot()}
              />
            ) : (
              <View style={[styles.infoCard, { backgroundColor: cardColor }]}>
                <StyledText
                  variant="bodyMedium"
                  style={[styles.infoText, { color: textColor }]}
                >
                  Please select a service type first to see available time slots
                </StyledText>
              </View>
            )}

            <View style={styles.specialInstructionsContainer}>
              <TouchableOpacity
                style={styles.specialInstructionsHeader}
                onPress={() =>
                  setShowSpecialInstructions(!showSpecialInstructions)
                }
              >
                <StyledText
                  variant="titleMedium"
                  style={[styles.stepHeader, { color: textColor }]}
                >
                  Special Instructions (Optional)
                </StyledText>
                <Ionicons
                  name={showSpecialInstructions ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={textColor}
                />
              </TouchableOpacity>

              {showSpecialInstructions && (
                <StyledTextInput
                  style={[
                    styles.specialInstructionsInput,
                    {
                      backgroundColor: cardColor,
                      borderColor: "#E5E5E5",
                    },
                  ]}
                  placeholder="Add any special instructions for the detailer..."
                  placeholderTextColor={textColor + "80"}
                  value={specialInstructions}
                  onChangeText={handleSpecialInstructionsChange}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              )}
            </View>
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContent}>
            {selectedVehicle &&
              selectedServiceType &&
              selectedValetType &&
              selectedAddress && (
                <BookingSummary
                  vehicle={selectedVehicle}
                  serviceType={selectedServiceType}
                  valetType={selectedValetType}
                  address={selectedAddress}
                  selectedDate={selectedDate}
                  specialInstructions={specialInstructions}
                  isSUV={isSUV}
                  basePrice={getBasePrice()}
                  suvPrice={getSUVPrice()}
                  totalPrice={getTotalPrice()}
                  selectedAddons={selectedAddons}
                  addonPrice={getAddonPrice()}
                  addonDuration={getAddonDuration()}
                  formatPrice={formatPrice}
                  user={user || undefined}
                  originalPrice={getOriginalPrice()}
                  finalPrice={getFinalPrice()}
                  loyaltyDiscount={getLoyaltyDiscount()}
                />
              )}
          </View>
        );

      default:
        return null;
    }
  };

  const renderNavigationButtons = () => (
    <View style={styles.navigationContainer}>
      {currentStep > 1 && (
        <TouchableOpacity
          style={[styles.navButton, styles.backButton, { borderColor }]}
          onPress={handlePreviousStep}
        >
          <Ionicons name="arrow-back" size={20} color={primaryPurpleColor} />
          <StyledText
            variant="bodyMedium"
            style={[styles.backButtonText, { color: primaryPurpleColor }]}
          >
            Back
          </StyledText>
        </TouchableOpacity>
      )}

      {currentStep < 5 ? (
        <StyledButton
          title="Next"
          variant="medium"
          onPress={handleNextStep}
          disabled={!canProceedToNextStep(currentStep)}
          style={styles.nextButton}
        />
      ) : (
        <StyledButton
          title={isLoading ? "Creating Booking..." : "Confirm Booking"}
          variant="medium"
          onPress={handleBookingConfirmation}
          disabled={!canProceedToSummary() || isLoading}
          style={styles.confirmButton}
        />
      )}
    </View>
  );

  if (isLoadingBooking) {
    return <ActivityIndicator size="large" color={primaryPurpleColor} />;
  }
  return (
    <View style={[styles.container, { backgroundColor }]}>
      {promotions  && (
        <View>
          <PromotionsCardComponent {...promotions} />
        </View>
      )}
      {renderStepIndicator()}
      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {renderStepContent()}
      </ScrollView>

      {renderNavigationButtons()}

      {/* Addon Selection Modal */}

      <ModalServices
        visible={isAddonModalVisible}
        onClose={handleCloseAddonModal}
        component={
          <AddonSelection
            onClose={handleCloseAddonModal}
            onConfirm={handleConfirmAddons}
            addons={addOns || []}
            selectedAddons={selectedAddons}
            onAddonSelect={handleAddonSelectionWithRefresh}
            totalAddonPrice={getAddonPrice()}
            totalAddonDuration={getAddonDuration()}
            formatPrice={formatPrice}
          />
        }
        title="Add-ons"
        modalType="fullscreen"
        animationType="slide"
        showCloseButton={true}
      />
    </View>
  );
};

export default BookingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
    padding: 10,
  },
  stepIndicator: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingHorizontal: 0,
  },
  stepContainer: {
    flex: 1,
    alignItems: "center",
  },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 4,
  },
  stepTitle: {
    textAlign: "center",
    fontSize: 10,
  },
  stepLine: {
    position: "absolute",
    top: 20,
    left: "50%",
    width: "100%",
    height: 2,
    zIndex: -1,
  },
  stepContent: {
    marginBottom: 20,
  },
  stepHeader: {
    fontWeight: "600",
    marginBottom: 16,
  },
  specialInstructionsContainer: {
    marginTop: 20,
  },
  specialInstructionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  specialInstructionsInput: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    minHeight: 100,
    fontSize: 16,
  },
  navigationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 5,
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
    gap: 10,
    marginHorizontal: 5,
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  backButton: {
    backgroundColor: "transparent",
  },
  backButtonText: {
    marginLeft: 8,
    fontWeight: "600",
  },
  nextButton: {
    flex: 1,
  },
  nextButtonText: {
    fontWeight: "600",
  },
  confirmButton: {
    flex: 1,
    marginLeft: 12,
  },
  confirmButtonText: {
    fontWeight: "600",
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoText: {
    textAlign: "center",
    opacity: 0.7,
  },
});
