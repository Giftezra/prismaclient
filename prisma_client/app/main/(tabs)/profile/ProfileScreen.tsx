import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Modal,
  Pressable,
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import ProfileCard from "@/app/components/profile/ProfileCard";
import AddressCard from "@/app/components/profile/AddressCard";
import StyledText from "@/app/components/helpers/StyledText";
import { Ionicons } from "@expo/vector-icons";
import useProfile from "@/app/app-hooks/useProfile";
import ServiceHistoryComponent from "@/app/components/profile/ServiceHistoryComponent";
import StyledButton from "@/app/components/helpers/StyledButton";
import AddAddressModal from "@/app/components/profile/AddAddressModal";
import PaymentMethodsComponent from "@/app/components/profile/PaymentMethodsComponent";
import { MyAddressProps } from "@/app/interfaces/ProfileInterfaces";
import { useAuthContext } from "@/app/contexts/AuthContextProvider";
import ModalServices from "@/app/utils/ModalServices";

const ProfileScreen = () => {
  const {
    serviceHistory,
    userProfile,
    addresses,
    saveNewAddress,
    isLoadingServiceHistory,
    errorServiceHistory,
    refetchServiceHistory,
  } = useProfile();
  const { handleLogout } = useAuthContext();

  /* Import the theme colors */
  const backgroundColor = useThemeColor({}, "background");
  const iconColor = useThemeColor({}, "icons");
  const borderColor = useThemeColor({}, "borders");
  /* State management */
  const [isServiceHistoryVisible, setIsServiceHistoryVisible] = useState(false);
  const [isAddressModalVisible, setIsAddressModalVisible] = useState(false);
  const [isPaymentMethodsModalVisible, setIsPaymentMethodsModalVisible] =
    useState(false);

  /* Animation refs */
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  /* Profile card scroll animation refs */
  const profileCardTranslateY = useRef(new Animated.Value(0)).current;
  const profileCardOpacity = useRef(new Animated.Value(1)).current;

  /* Logout button scroll animation refs */
  const logoutButtonTranslateY = useRef(new Animated.Value(0)).current;
  const logoutButtonOpacity = useRef(new Animated.Value(1)).current;

  /* Scroll tracking */
  const lastScrollY = useRef(0);
  const scrollDirection = useRef<"up" | "down">("down");
  const isScrolling = useRef(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  /* Dynamic height calculation for service history */
  const [contentHeight, setContentHeight] = useState(0);
  const [hasMeasuredHeight, setHasMeasuredHeight] = useState(false);

  /**
   * Handles the service history toggle with animation
   */
  const handleServiceHistoryToggle = () => {
    const newVisible = !isServiceHistoryVisible;
    setIsServiceHistoryVisible(newVisible);

    if (newVisible) {
      // Animate in - pull down effect
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      // Animate out - pull up effect
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 400,
          useNativeDriver: false,
        }),
      ]).start();
    }
  };

  /**
   * Handle scroll events to animate profile card visibility
   */
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentScrollY = event.nativeEvent.contentOffset.y;
      const scrollDelta = currentScrollY - lastScrollY.current;

      // Mark that user has started scrolling
      if (!hasScrolled && currentScrollY > 10) {
        setHasScrolled(true);
      }

      // Only trigger animation if scroll delta is significant enough
      if (Math.abs(scrollDelta) > 5) {
        const newDirection = scrollDelta > 0 ? "up" : "down";

        // Only animate if direction changed or we're starting to scroll
        if (newDirection !== scrollDirection.current || !isScrolling.current) {
          scrollDirection.current = newDirection;
          isScrolling.current = true;

          if (newDirection === "up" && currentScrollY > 100) {
            // Hide profile card and logout button when scrolling up with significant scroll
            Animated.parallel([
              Animated.timing(profileCardTranslateY, {
                toValue: -120, // Hide above the screen
                duration: 300,
                useNativeDriver: true,
              }),
              Animated.timing(profileCardOpacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
              }),
              Animated.timing(logoutButtonTranslateY, {
                toValue: 100, // Hide below the screen
                duration: 300,
                useNativeDriver: true,
              }),
              Animated.timing(logoutButtonOpacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
              }),
            ]).start();
          } else if (newDirection === "down" || currentScrollY <= 100) {
            // Show profile card and logout button when scrolling down or when near top
            Animated.parallel([
              Animated.timing(profileCardTranslateY, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
              }),
              Animated.timing(profileCardOpacity, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
              }),
              Animated.timing(logoutButtonTranslateY, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
              }),
              Animated.timing(logoutButtonOpacity, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
              }),
            ]).start();
          }
        }
      }

      lastScrollY.current = currentScrollY;
    },
    [
      profileCardTranslateY,
      profileCardOpacity,
      logoutButtonTranslateY,
      logoutButtonOpacity,
      hasScrolled,
    ]
  );

  /**
   * Handle scroll end to reset scrolling state
   */
  const handleScrollEnd = useCallback(() => {
    isScrolling.current = false;
  }, []);

  /**
   * Reset animation values when component unmounts
   */
  useEffect(() => {
    return () => {
      slideAnim.setValue(0);
      opacityAnim.setValue(0);
      scaleAnim.setValue(0.95);
      profileCardTranslateY.setValue(0);
      profileCardOpacity.setValue(1);
      logoutButtonTranslateY.setValue(0);
      logoutButtonOpacity.setValue(1);
    };
  }, [
    profileCardTranslateY,
    profileCardOpacity,
    logoutButtonTranslateY,
    logoutButtonOpacity,
  ]);

  /**
   * Handles saving a new address
   */
  const handleSaveAddress = useCallback(async () => {
    setIsAddressModalVisible(false);
    await saveNewAddress();
  }, [saveNewAddress]);

  /**
   * Handles editing an address
   */
  const handleEditAddress = (id: string) => {
    setIsAddressModalVisible(true);
  };

  /**
   * Handles payment methods modal
   */
  const handlePaymentMethodsPress = () => {
    setIsPaymentMethodsModalVisible(true);
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
        nestedScrollEnabled={true}
        bounces={true}
        alwaysBounceVertical={false}
      >
        {/* Profile Card - Always in normal flow */}
        <ProfileCard
          profile={userProfile}
          address={addresses?.[0]}
          onPaymentMethodsPress={handlePaymentMethodsPress}
          onLogoutPress={handleLogout}
        />

        {/* Display the list of addresses that the user has added or requested from */}
        <View>
          <View style={styles.addressHeader}>
            <StyledText children="My Addresses" variant="labelLarge" />
            <StyledButton
              title="Add Address"
              onPress={() => setIsAddressModalVisible(true)}
              variant="small"
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled={true}
            bounces={false}
            decelerationRate="fast"
          >
            {addresses?.map((address, index) => (
              <AddressCard
                key={index}
                address={address}
                onEdit={handleEditAddress}
              />
            ))}
          </ScrollView>
        </View>

        {/* Display the toggle for the service history */}
        <View style={styles.dropdownContainer}>
          <Pressable
            style={[styles.downdownbutton, { borderColor: borderColor }]}
            onPress={handleServiceHistoryToggle}
          >
            <StyledText children="Service History" variant="labelLarge" />
            <Ionicons
              name={isServiceHistoryVisible ? "chevron-up" : "chevron-down"}
              size={15}
              color={iconColor}
            />
          </Pressable>

          {/* Hidden container to measure content height */}
          {!hasMeasuredHeight &&
            serviceHistory &&
            serviceHistory.length > 0 && (
              <View
                style={styles.hiddenMeasurer}
                onLayout={(event) => {
                  const { height } = event.nativeEvent.layout;
                  setContentHeight(height + 50); // Add some padding
                  setHasMeasuredHeight(true);
                }}
              >
                {serviceHistory.map((history, index) => (
                  <ServiceHistoryComponent key={index} {...history} />
                ))}
              </View>
            )}

          <Animated.View
            style={[
              styles.serviceHistoryContainer,
              {
                maxHeight: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, hasMeasuredHeight ? contentHeight : 2000],
                }),
                opacity: opacityAnim,
                transform: [
                  {
                    scale: scaleAnim,
                  },
                ],
                overflow: "hidden", // Ensure content doesn't overflow during animation
              },
            ]}
          >
            {isLoadingServiceHistory ? (
              <StyledText
                children="Loading service history..."
                variant="bodyMedium"
              />
            ) : errorServiceHistory ? (
              <View style={{ padding: 10 }}>
                <StyledText
                  children={`Error loading service history: ${JSON.stringify(
                    errorServiceHistory
                  )}`}
                  variant="bodyMedium"
                />
                <StyledButton
                  title="Retry"
                  onPress={() => {
                    if (typeof refetchServiceHistory === "function") {
                      refetchServiceHistory();
                    }
                  }}
                  variant="small"
                />
              </View>
            ) : serviceHistory && serviceHistory.length > 0 ? (
              serviceHistory.map((history, index) => (
                <ServiceHistoryComponent key={index} {...history} />
              ))
            ) : (
              <StyledText
                children="No service history found"
                variant="bodyMedium"
              />
            )}
          </Animated.View>
        </View>
      </ScrollView>

      {/* Floating Profile Card - Only visible when scrolled */}
      {hasScrolled && (
        <Animated.View
          style={[
            styles.floatingProfileCard,
            {
              transform: [{ translateY: profileCardTranslateY }],
              opacity: profileCardOpacity,
            },
          ]}
        >
          <ProfileCard
            profile={userProfile}
            address={addresses?.[0]}
            onPaymentMethodsPress={handlePaymentMethodsPress}
            onLogoutPress={handleLogout}
          />
        </Animated.View>
      )}

      {/* Add Address Modal */}
      <ModalServices
        visible={isAddressModalVisible}
        onClose={() => setIsAddressModalVisible(false)}
        modalType="sheet"
        animationType="slide"
        showCloseButton={true}
        component={
          <AddAddressModal
            isVisible={isAddressModalVisible}
            onClose={() => setIsAddressModalVisible(false)}
            onSave={handleSaveAddress}
            title="Add New Address"
          />
        }
      />

      {/* Payment Methods Modal */}
      <ModalServices
        visible={isPaymentMethodsModalVisible}
        onClose={() => setIsPaymentMethodsModalVisible(false)}
        modalType="sheet"
        animationType="slide"
        showCloseButton={true}
        component={<PaymentMethodsComponent />}
        title="Payment Methods"
      />
    </View>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  floatingProfileCard: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 1000, // For Android
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 50,
    minHeight: "100%",
  },

  settingsButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  dropdownContainer: {
    padding: 5,
    paddingHorizontal: 10,
  },
  downdownbutton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 5,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 5,
  },
  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  serviceHistoryHeaderContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  serviceHistoryContainer: {
    paddingTop: 5,
    paddingBottom: 10,
    marginTop: 5,
  },
  hiddenMeasurer: {
    position: "absolute",
    opacity: 0,
    zIndex: -1,
    top: -1000,
    left: 0,
    right: 0,
  },
  settingsContainer: {
    padding: 10,
    paddingHorizontal: 10,
    backgroundColor: "transparent",
  },
  animatedSettingsContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 1000, // For Android
    backgroundColor: "transparent",
  },
});
