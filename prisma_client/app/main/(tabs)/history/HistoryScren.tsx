import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Animated,
  RefreshControl,
} from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledText from "@/app/components/helpers/StyledText";
import { Ionicons } from "@expo/vector-icons";
import useProfile from "@/app/app-hooks/useProfile";
import ServiceHistoryComponent from "@/app/components/profile/ServiceHistoryComponent";
import StyledButton from "@/app/components/helpers/StyledButton";
import LinearGradientComponent from "@/app/components/helpers/LinearGradientComponent";

const HistoryScreen = () => {
  const {
    serviceHistory,
    isLoadingServiceHistory,
    errorServiceHistory,
    refetchServiceHistory,
  } = useProfile();

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
   * Render item for FlatList
   */
  const renderServiceHistoryItem = useCallback(
    ({ item }: { item: any }) => <ServiceHistoryComponent {...item} />,
    []
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
    <View style={[styles.container, { backgroundColor }]}>
      <FlatList
        data={serviceHistory && serviceHistory.length > 0 ? serviceHistory : []}
        renderItem={renderServiceHistoryItem}
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
        style={styles.flatList}
      />
    </View>
  );
};

export default HistoryScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flatList: {
    flex: 1,
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
});
