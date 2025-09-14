import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNotification } from "../app-hooks/useNotification";
import { NotificationItem } from "../components/notification/NotificationItem";
import { Notification } from "../interfaces/NotificationInterface";
import { Colors } from "../../constants/Colors";
import StyledText from "../components/helpers/StyledText";
import { useThemeColor } from "@/hooks/useThemeColor";

const NotificationScreen = () => {
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const primaryColor = useThemeColor({}, "primary");
  const iconColor = useThemeColor({}, "icons");
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
  } = useNotification();
  const [refreshing, setRefreshing] = useState(false);

  const handleNotificationPress = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    // Here you can add navigation to specific screens based on notification type
    // For example, navigate to booking details, payment history, etc.
    Alert.alert(notification.title, notification.message, [{ text: "OK" }]);
  };

  const handleMarkAllAsRead = () => {
    if (unreadCount > 0) {
      Alert.alert(
        "Mark All as Read",
        "Are you sure you want to mark all notifications as read?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Mark All Read", onPress: markAllAsRead },
        ]
      );
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshNotifications();
    } finally {
      setRefreshing(false);
    }
  };

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor }]}>
      <View style={styles.headerContent}>
        <StyledText variant="titleLarge">Notifications</StyledText>
        {unreadCount > 0 && (
          <View style={[styles.badge, { backgroundColor: primaryColor }]}>
            <StyledText variant="bodySmall">{unreadCount}</StyledText>
          </View>
        )}
      </View>
      {unreadCount > 0 && (
        <TouchableOpacity
          style={styles.markAllButton}
          onPress={handleMarkAllAsRead}
        >
          <StyledText variant="bodySmall">Mark all read</StyledText>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-off" size={64} color={iconColor} />
      <StyledText variant="titleLarge">No notifications</StyledText>
      <StyledText variant="bodySmall">
        You're all caught up! New notifications will appear here.
      </StyledText>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {renderHeader()}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationItem
            notification={item}
            onPress={handleNotificationPress}
            onDelete={deleteNotification}
          />
        )}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[primaryColor]}
            tintColor={primaryColor}
          />
        }
        ListEmptyComponent={renderEmptyState}
      />
    </View>
  );
};

export default NotificationScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 20,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  markAllButton: {
    alignSelf: "flex-end",
  },
  markAllText: {
    fontSize: 14,
    fontWeight: "500",
  },
  listContainer: {
    paddingVertical: 8,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    marginTop: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
