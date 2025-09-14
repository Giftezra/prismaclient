import { StyleSheet } from "react-native";
import React from "react";
import { Stack } from "expo-router";

const BokkingsLayout = () => {
  return (
    <Stack screenOptions={{
      headerShown: false,
    }}>
      <Stack.Screen name="BookingScreen" />
    </Stack>
  );
};

export default BokkingsLayout;

const styles = StyleSheet.create({});
