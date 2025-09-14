import { StyleSheet, Text, View } from "react-native";
import React from "react";
import { Stack } from "expo-router";

const DashboardLayout = () => {
  return (
    <Stack screenOptions={{
      headerShown: false,
    }}>
      <Stack.Screen name="DashboardScreen" />
      <Stack.Screen name="UpcomingBookingScreen" />
    </Stack>
  );
};

export default DashboardLayout;

const styles = StyleSheet.create({});
