import { StyleSheet } from "react-native";
import React from "react";
import { Stack } from "expo-router";

const DashboardLayout = () => {
  return (
    <Stack screenOptions={{
      headerShown: false,
    }}>
      <Stack.Screen name="DashboardScreen" />
      <Stack.Screen name="FleetDashboardScreen" />
      <Stack.Screen name="BranchAdminDashboardScreen" />
      <Stack.Screen name="CreateBranchAdminScreen" />
      <Stack.Screen name="BranchManagementScreen" />
      <Stack.Screen name="UpcomingBookingScreen" />
    </Stack>
  );
};

export default DashboardLayout;

const styles = StyleSheet.create({});
