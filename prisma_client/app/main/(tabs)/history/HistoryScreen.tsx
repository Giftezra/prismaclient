import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  StyleSheet,
  Text,
  View,
  SectionList,
  Animated,
  RefreshControl,
} from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledText from "@/app/components/helpers/StyledText";
import { Ionicons } from "@expo/vector-icons";
import useServiceHistory from "@/app/app-hooks/useServiceHistory";
import ServiceHistoryComponent from "@/app/components/profile/ServiceHistoryComponent";
import StyledButton from "@/app/components/helpers/StyledButton";
import LinearGradientComponent from "@/app/components/helpers/LinearGradientComponent";
import { router } from "expo-router";
import ModalServices from "@/app/utils/ModalServices";
import ReviewComponent from "@/app/components/booking/ReviewComponent";
import { RecentServicesProps } from "@/app/interfaces/DashboardInterfaces";
import { useAppSelector, RootState } from "@/app/store/main_store";

const HistoryScreen = () => {
  const {
    serviceHistory,
    isLoadingServiceHistory,
    errorServiceHistory,
    refetchServiceHistory,
  } = useServiceHistory();

  const user = useAppSelector((state: RootState) => state.auth.user);

  /* Import the theme colors */
  const backgroundColor = useThemeColor({}, "background");
  const iconColor = useThemeColor({}, "icons");
  const borderColor = useThemeColor({}, "borders");
  const cardColor = useThemeColor({}, "cards");
  const textColor = useThemeColor({}, "text");

  /* Animation refs */
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  /* Dynamic height calculation for service history */
  const [contentHeight, setContentHeight] = useState(0);
  const [hasMeasuredHeight, setHasMeasuredHeight] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedBooking, setSelectedBooking] =
    useState<RecentServicesProps | null>(null);

  /* Get the currency symbol by getting the user's country */
  let currencySymbol = "$";
  if (user?.address?.country === "United Kingdom") {
    currencySymbol = "£";
  } else if (user?.address?.country === "Ireland") {
    currencySymbol = "€";
  }

  /**
   * Reset animation values when component unmounts
   */
  useEffect(() => {
    return () => {
      slideAnim.setValue(0);
      opacityAnim.setValue(0);
      scaleAnim.setValue(0.95);
    };
  }, [slideAnim, opacityAnim, scaleAnim]);

  /**
   * Handle pull-to-refresh functionality
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (typeof refetchServiceHistory === "function") {
        await refetchServiceHistory();
      }
    } catch (error) {
      console.error("Error refreshing service history:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchServiceHistory]);

  /**
   * Group service history by appointment date
   */
  const groupedServiceHistory = useMemo(() => {
    if (!serviceHistory || serviceHistory.length === 0) {
      return [];
    }

    // Group items by date
    const grouped = serviceHistory.reduce(
      (
        acc: Record<string, { title: string; date: Date; data: any[] }>,
        item: any
      ) => {
        const date = new Date(item.appointment_date);
        const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD format

        if (!acc[dateKey]) {
          acc[dateKey] = {
            title: dateKey,
            date: date,
            data: [],
          };
        }

        acc[dateKey].data.push(item);
        return acc;
      },
      {}
    );

    // Convert to array and sort by date (most recent first)
    return Object.values(grouped).sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );
  }, [serviceHistory]);

  /**
   * Format date for section headers
   */
  const formatSectionDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Remove time component for comparison
    const dateOnly = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );
    const todayOnly = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const yesterdayOnly = new Date(
      yesterday.getFullYear(),
      yesterday.getMonth(),
      yesterday.getDate()
    );

    if (dateOnly.getTime() === todayOnly.getTime()) {
      return "Today";
    } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
      return "Yesterday";
    } else {
      const options: Intl.DateTimeFormatOptions = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      };
      return date.toLocaleDateString(undefined, options);
    }
  };

  /**
   * Render section header
   */
  const renderSectionHeader = useCallback(
    ({ section }: { section: any }) => (
      <View style={[styles.sectionHeader, { backgroundColor }]}>
        <View
          style={[
            styles.sectionHeaderContent,
            { backgroundColor: cardColor, borderColor },
          ]}
        >
          <Ionicons
            name="calendar"
            size={20}
            color={iconColor}
            style={styles.sectionHeaderIcon}
          />
          <StyledText
            variant="titleSmall"
            children={formatSectionDate(section.title)}
            style={[styles.sectionHeaderText, { color: textColor }]}
          />
        </View>
      </View>
    ),
    [backgroundColor, cardColor, borderColor, iconColor, textColor]
  );

  /**
   * Handle service history item press - navigates to service detail screen
   */
  const handleServiceHistoryPress = useCallback(
    (item: any) => {
      router.push({
        pathname: "/main/(tabs)/history/ServiceHistoryDetailScreen",
        params: { bookingId: item.id },
      });
    },
    []
  );

  /**
   * Handle unrated service press - opens review modal
   */
  const handleUnratedPress = useCallback((item: any) => {
    // Convert service history item to RecentServicesProps format
    const bookingData: RecentServicesProps = {
      date: item.appointment_date,
      vehicle_name: item.vehicle_reg,
      status: item.status,
      cost: item.total_amount,
      detailer: item.detailer,
      valet_type: item.valet_type,
      service_type: item.service_type,
      rating: item.rating || 0,
      is_reviewed: item.is_reviewed,
      booking_reference: item.booking_reference || item.id, // Use booking_reference if available, fallback to id
    };
    setSelectedBooking(bookingData);
    setShowReviewModal(true);
  }, []);

  /**
   * Handle review submission - closes modal and refreshes data
   */
  const handleReviewSubmitted = useCallback(() => {
    setShowReviewModal(false);
    setSelectedBooking(null);
    refetchServiceHistory();
  }, [refetchServiceHistory]);

  /**
   * Render item for SectionList
   */
  const renderServiceHistoryItem = useCallback(
    ({ item }: { item: any }) => (
      <ServiceHistoryComponent
        {...item}
        onPress={() => handleServiceHistoryPress(item)}
        onUnratedPress={() => handleUnratedPress(item)}
      />
    ),
    [handleServiceHistoryPress, handleUnratedPress]
  );

  /**
   * Empty state component for when no service history exists
   */
  const EmptyStateComponent = () => (
    <LinearGradientComponent
      color1={cardColor}
      color2={borderColor}
      style={styles.emptyStateContainer}
    >
      <View style={styles.emptyStateContent}>
        <Ionicons
          name="calendar-outline"
          size={64}
          color={iconColor}
          style={styles.emptyStateIcon}
        />
        <StyledText
          variant="titleLarge"
          children="No Booking History Yet"
          style={[styles.emptyStateTitle, { color: textColor }]}
        />
        <StyledText
          variant="bodyMedium"
          children="You haven't made any bookings yet. Your service history will appear here after you complete your first booking."
          style={[styles.emptyStateDescription, { color: textColor }]}
        />
        <View style={styles.emptyStateAction}>
          <Ionicons name="refresh-outline" size={20} color={iconColor} />
          <StyledText
            variant="labelMedium"
            children="Check back after making a booking"
            style={[styles.emptyStateActionText, { color: textColor }]}
          />
        </View>
      </View>
    </LinearGradientComponent>
  );

  /**
   * List header component
   */
  const ListHeaderComponent = () => (
    <View style={styles.header}>
      <StyledText
        variant="titleMedium"
        children="Service History"
        style={[styles.headerTitle, { color: textColor }]}
      />
      <StyledText
        variant="bodyMedium"
        children="View your past bookings and service details"
        style={[styles.headerSubtitle, { color: textColor }]}
      />
    </View>
  );

  /**
   * List empty component
   */
  const ListEmptyComponent = () => {
    if (isLoadingServiceHistory) {
      return (
        <View style={styles.loadingContainer}>
          <StyledText
            children="Loading service history..."
            variant="bodyMedium"
            style={[styles.loadingText, { color: textColor }]}
          />
        </View>
      );
    }

    if (errorServiceHistory) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color="#FF6B6B"
            style={styles.errorIcon}
          />
          <StyledText
            children={`Error loading service history: ${JSON.stringify(
              errorServiceHistory
            )}`}
            variant="bodyMedium"
            style={[styles.errorText, { color: textColor }]}
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
      );
    }

    return <EmptyStateComponent />;
  };

  return (
    <>
      <View style={[styles.container, { backgroundColor }]}>
        <SectionList
          sections={groupedServiceHistory}
          renderItem={renderServiceHistoryItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item, index) => item.id || index.toString()}
          ListHeaderComponent={ListHeaderComponent}
          ListEmptyComponent={ListEmptyComponent}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={iconColor}
              colors={[iconColor]}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          stickySectionHeadersEnabled={false}
          style={styles.flatList}
        />
      </View>

      {/* Review Modal */}
      <ModalServices
        visible={showReviewModal}
        onClose={() => {
          setShowReviewModal(false);
          setSelectedBooking(null);
        }}
        component={
          <ReviewComponent
            currencySymbol={currencySymbol}
            bookingData={selectedBooking || undefined}
            onReviewSubmitted={handleReviewSubmitted}
          />
        }
        showCloseButton={true}
        animationType="slide"
        title="Review"
        modalType="fullscreen"
      />
    </>
  );
};

export default HistoryScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flatList: {
    flex:1
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 50,
    minHeight: "100%",
  },
  separator: {
    height: 10,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontWeight: "bold",
    marginBottom: 8,
  },
  headerSubtitle: {
    opacity: 0.7,
  },
  historyContainer: {
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    textAlign: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  emptyStateContainer: {
    margin: 20,
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 300,
  },
  emptyStateContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateIcon: {
    marginBottom: 20,
    opacity: 0.6,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
  },
  emptyStateDescription: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
    opacity: 0.8,
  },
  emptyStateAction: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
  },
  emptyStateActionText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500",
  },
  sectionHeader: {
    paddingTop: 10,
    paddingBottom: 5,
  },
  sectionHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 20,
    borderRadius: 15,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeaderIcon: {
    marginRight: 10,
  },
  sectionHeaderText: {
    fontWeight: "600",
    fontSize: 16,
  },
});
