import React from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import {
  ServiceTypeProps,
  ValetTypeProps,
  AddOnsProps,
} from "@/app/interfaces/BookingInterfaces";
import { MyVehiclesProps } from "@/app/interfaces/GarageInterface";
import { MyAddressProps } from "@/app/interfaces/ProfileInterfaces";
import StyledText from "@/app/components/helpers/StyledText";

interface BookingSummaryProps {
  vehicle: MyVehiclesProps;
  serviceType: ServiceTypeProps;
  valetType: ValetTypeProps;
  address: MyAddressProps;
  selectedDate: Date;
  specialInstructions?: string;
  isSUV: boolean;
  basePrice: number;
  suvPrice: number;
  totalPrice: number;
  selectedAddons?: AddOnsProps[];
  addonPrice?: number;
  addonDuration?: number;
  formatPrice: (price: number) => string;
}

const BookingSummary: React.FC<BookingSummaryProps> = ({
  vehicle,
  serviceType,
  valetType,
  address,
  selectedDate,
  specialInstructions,
  isSUV,
  basePrice,
  suvPrice,
  totalPrice,
  selectedAddons = [],
  addonPrice = 0,
  addonDuration = 0,
  formatPrice,
}) => {
  const cardColor = useThemeColor({}, "cards");
  const textColor = useThemeColor({}, "text");
  const primaryPurpleColor = useThemeColor({}, "primary");
  const buttonColor = useThemeColor({}, "button");

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  return (
    <View style={styles.container}>
      <StyledText
        variant="titleLarge"
        style={[styles.title, { color: textColor }]}
      >
        Booking Summary
      </StyledText>

      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Vehicle Information */}
        <View style={[styles.section, { backgroundColor: cardColor }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="car" size={24} color={primaryPurpleColor} />
            <StyledText
              variant="titleMedium"
              style={[styles.sectionTitle, { color: textColor }]}
            >
              Vehicle
            </StyledText>
          </View>
          <View style={styles.sectionContent}>
            <StyledText
              variant="titleMedium"
              style={[styles.vehicleName, { color: textColor }]}
            >
              {vehicle.make} {vehicle.model}
            </StyledText>
            <StyledText
              variant="bodyMedium"
              style={[styles.vehicleDetails, { color: textColor }]}
            >
              {vehicle.year} • {vehicle.color} • {vehicle.licence}
            </StyledText>
          </View>
        </View>

        {/* Service Details */}
        <View style={[styles.section, { backgroundColor: cardColor }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="construct" size={24} color={primaryPurpleColor} />
            <StyledText
              variant="titleMedium"
              style={[styles.sectionTitle, { color: textColor }]}
            >
              Service Details
            </StyledText>
          </View>
          <View style={styles.sectionContent}>
            <View style={styles.serviceRow}>
              <StyledText
                variant="bodyMedium"
                style={[styles.serviceLabel, { color: textColor }]}
              >
                Service Type:
              </StyledText>
              <StyledText
                variant="bodyMedium"
                style={[styles.serviceValue, { color: textColor }]}
              >
                {serviceType.name}
              </StyledText>
            </View>
            <View style={styles.serviceRow}>
              <StyledText
                variant="bodyMedium"
                style={[styles.serviceLabel, { color: textColor }]}
              >
                Valet Type:
              </StyledText>
              <StyledText
                variant="bodyMedium"
                style={[styles.serviceValue, { color: textColor }]}
              >
                {valetType.name}
              </StyledText>
            </View>
            <View style={styles.serviceRow}>
              <StyledText
                variant="bodyMedium"
                style={[styles.serviceLabel, { color: textColor }]}
              >
                {selectedAddons.length > 0 ? "Service Duration:" : "Duration:"}
              </StyledText>
              <StyledText
                variant="bodyMedium"
                style={[styles.serviceValue, { color: textColor }]}
              >
                {serviceType.duration} minutes
              </StyledText>
            </View>
            {selectedAddons.length > 0 && (
              <View style={styles.serviceRow}>
                <StyledText
                  variant="bodyMedium"
                  style={[styles.serviceLabel, { color: textColor }]}
                >
                  Total Duration:
                </StyledText>
                <StyledText
                  variant="bodyMedium"
                  style={[styles.serviceValue, { color: textColor }]}
                >
                  {serviceType.duration + addonDuration} minutes
                </StyledText>
              </View>
            )}
            {selectedAddons.length > 0 && (
              <View style={styles.serviceRow}>
                <StyledText
                  variant="bodyMedium"
                  style={[styles.serviceLabel, { color: textColor }]}
                >
                  Add-ons:
                </StyledText>
                <StyledText
                  variant="bodyMedium"
                  style={[styles.serviceValue, { color: textColor }]}
                >
                  {selectedAddons.length} selected
                </StyledText>
              </View>
            )}
          </View>
        </View>

        {/* Date & Time */}
        <View style={[styles.section, { backgroundColor: cardColor }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar" size={24} color={primaryPurpleColor} />
            <StyledText
              variant="titleMedium"
              style={[styles.sectionTitle, { color: textColor }]}
            >
              Date & Time
            </StyledText>
          </View>
          <View style={styles.sectionContent}>
            <StyledText
              variant="bodyMedium"
              style={[styles.dateTimeText, { color: textColor }]}
            >
              {formatDate(selectedDate)}
            </StyledText>
            <View style={styles.timeRow}>
              <StyledText
                variant="bodyMedium"
                style={[styles.timeLabel, { color: textColor }]}
              >
                Start:
              </StyledText>
              <StyledText
                variant="bodyMedium"
                style={[styles.dateTimeText, { color: textColor }]}
              >
                {formatTime(selectedDate)}
              </StyledText>
            </View>
            <View style={styles.timeRow}>
              <StyledText
                variant="bodyMedium"
                style={[styles.timeLabel, { color: textColor }]}
              >
                End:
              </StyledText>
              <StyledText
                variant="bodyMedium"
                style={[styles.dateTimeText, { color: textColor }]}
              >
                {formatTime(
                  new Date(
                    selectedDate.getTime() +
                      (serviceType.duration + addonDuration) * 60000
                  )
                )}
              </StyledText>
            </View>
          </View>
        </View>

        {/* Location */}
        <View style={[styles.section, { backgroundColor: cardColor }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location" size={24} color={primaryPurpleColor} />
            <StyledText
              variant="titleMedium"
              style={[styles.sectionTitle, { color: textColor }]}
            >
              Service Location
            </StyledText>
          </View>
          <View style={styles.sectionContent}>
            <StyledText
              variant="bodyMedium"
              style={[styles.addressText, { color: textColor }]}
            >
              {address.address}
            </StyledText>
            <StyledText
              variant="bodyMedium"
              style={[styles.addressText, { color: textColor }]}
            >
              {address.city}, {address.post_code}
            </StyledText>
            <StyledText
              variant="bodyMedium"
              style={[styles.addressText, { color: textColor }]}
            >
              {address.country}
            </StyledText>
          </View>
        </View>

        {/* Special Instructions */}
        {specialInstructions && (
          <View style={[styles.section, { backgroundColor: cardColor }]}>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="information-circle"
                size={24}
                color={primaryPurpleColor}
              />
              <StyledText
                variant="titleMedium"
                style={[styles.sectionTitle, { color: textColor }]}
              >
                Special Instructions
              </StyledText>
            </View>
            <View style={styles.sectionContent}>
              <StyledText
                variant="bodyMedium"
                style={[styles.instructionsText, { color: textColor }]}
              >
                {specialInstructions}
              </StyledText>
            </View>
          </View>
        )}

        {/* Price Summary */}
        <View style={[styles.section, { backgroundColor: cardColor }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="card" size={24} color={primaryPurpleColor} />
            <StyledText
              variant="titleMedium"
              style={[styles.sectionTitle, { color: textColor }]}
            >
              Price Summary
            </StyledText>
          </View>
          <View style={styles.sectionContent}>
            <View style={styles.priceRow}>
              <StyledText
                variant="bodyMedium"
                style={[styles.priceLabel, { color: textColor }]}
              >
                Service Cost:
              </StyledText>
              <StyledText
                variant="bodyMedium"
                style={[styles.priceValue, { color: textColor }]}
              >
                {formatPrice(basePrice)}
              </StyledText>
            </View>
            {isSUV && (
              <View style={styles.priceRow}>
                <StyledText
                  variant="bodyMedium"
                  style={[styles.priceLabel, { color: textColor }]}
                >
                  SUV Surcharge:
                </StyledText>
                <StyledText
                  variant="bodyMedium"
                  style={[styles.priceValue, { color: textColor }]}
                >
                  {formatPrice(suvPrice)}
                </StyledText>
              </View>
            )}
            {addonPrice > 0 && (
              <View style={styles.priceRow}>
                <StyledText
                  variant="bodyMedium"
                  style={[styles.priceLabel, { color: textColor }]}
                >
                  Add-ons:
                </StyledText>
                <StyledText
                  variant="bodyMedium"
                  style={[styles.priceValue, { color: textColor }]}
                >
                  {formatPrice(addonPrice)}
                </StyledText>
              </View>
            )}
            <View style={styles.totalRow}>
              <StyledText
                variant="titleMedium"
                style={[styles.totalLabel, { color: textColor }]}
              >
                Total Amount:
              </StyledText>
              <StyledText
                variant="titleLarge"
                style={[styles.totalValue, { color: buttonColor }]}
              >
                {formatPrice(totalPrice)}
              </StyledText>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default BookingSummary;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  scrollContainer: {
    flex: 1,
  },
  section: {
    borderRadius: 3,
    padding: 12,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    marginLeft: 12,
    fontWeight: "600",
  },
  sectionContent: {
    gap: 8,
  },
  vehicleName: {
    fontWeight: "600",
  },
  vehicleDetails: {
    opacity: 0.8,
  },
  serviceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  serviceLabel: {
    fontWeight: "500",
  },
  serviceValue: {
    fontWeight: "600",
  },
  dateTimeText: {
    fontWeight: "500",
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeLabel: {
    fontWeight: "500",
  },
  addressText: {
    fontWeight: "500",
  },
  instructionsText: {
    lineHeight: 20,
    fontStyle: "italic",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  priceLabel: {
    fontWeight: "500",
  },
  priceValue: {
    fontWeight: "600",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
    marginTop: 8,
  },
  totalLabel: {
    fontWeight: "600",
  },
  totalValue: {
    fontWeight: "bold",
  },
});
