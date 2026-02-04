import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  RefreshControl,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import FleetOwnerProfileCard from "@/app/components/profile/FleetOwnerProfileCard";
import SubscriptionCard from "@/app/components/profile/SubscriptionCard";
import AddressCard from "@/app/components/profile/AddressCard";
import ReferralCodeCard from "@/app/components/profile/ReferralCodeCard";
import { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import useProfile from "@/app/app-hooks/useProfile";
import PaymentMethodsComponent from "@/app/components/profile/PaymentMethodsComponent";
import { useAuthContext } from "@/app/contexts/AuthContextProvider";
import ModalServices from "@/app/utils/ModalServices";
import { useAppSelector, RootState } from "@/app/store/main_store";

const FleetOwnerProfileScreen = () => {
  const {
    userProfile,
    addresses,
    refetchUserProfile,
    refetchAddresses,
    isLoadingUserProfile,
    isLoadingAddresses,
  } = useProfile();
  const { handleLogout } = useAuthContext();
  const user = useAppSelector((state: RootState) => state.auth.user);

  /* Import the theme colors */
  const backgroundColor = useThemeColor({}, "background");
  const iconColor = useThemeColor({}, "icons");
  /* State management */
  const [isPaymentMethodsModalVisible, setIsPaymentMethodsModalVisible] =
    useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
   * Handles payment methods modal
   */
  const handlePaymentMethodsPress = () => {
    setIsPaymentMethodsModalVisible(true);
  };

  /**
   * Handle subscription management - navigate to subscription plan screen
   */
  const handleManageSubscription = () => {
    router.push("/main/(tabs)/profile/SubscriptionPlanScreen");
  };

  /**
   * Handle pull-to-refresh functionality
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Refetch all profile-related data
      await Promise.all([
        refetchUserProfile(),
        refetchAddresses(),
      ]);
    } catch (error) {
      console.error("Error refreshing profile data:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchUserProfile, refetchAddresses]);

  /**
   * Create refresh control
   */
  const refreshControl = (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      tintColor={iconColor}
      colors={[iconColor]}
      progressBackgroundColor={backgroundColor}
    />
  );

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
        refreshControl={refreshControl}
      >
        {/* Fleet Owner Profile Card - No loyalty program */}
        <FleetOwnerProfileCard
          profile={userProfile}
          address={addresses?.[0]}
          onPaymentMethodsPress={handlePaymentMethodsPress}
          onLogoutPress={handleLogout}
        />

        {/* Subscription Card - Only for fleet owners */}
        <SubscriptionCard onManageSubscription={handleManageSubscription} />

        {/* Display the list of fleet branch addresses */}
        <View>
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
                onEdit={() => {
                  // Fleet owners manage branches differently - edit functionality can be added later
                  console.log("Edit branch address - to be implemented");
                }}
              />
            ))}
          </ScrollView>
        </View>

        {/* Referral Code Card - Last item in scroll */}
        {user?.referral_code && (
          <ReferralCodeCard referral={user.referral_code} />
        )}
      </ScrollView>

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

export default FleetOwnerProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
