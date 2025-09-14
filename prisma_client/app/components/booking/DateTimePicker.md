# DateTimePicker Component Documentation

## Overview

The `CustomDateTimePicker` component provides a unified interface for selecting
both date and time across iOS and Android platforms. This component was recently
fixed to resolve a critical bug where multiple pickers were appearing
simultaneously.

## Bug Fixes Applied

### 1. Double Picker Issue (RESOLVED)

**Problem**: The component was rendering both custom modal pickers AND native
Android pickers simultaneously, causing users to see multiple picker dialogs.

**Root Cause**: The original implementation had conditional rendering that
wasn't properly platform-specific:

```typescript
// BUGGY CODE (before fix)
{
  showDatePicker && (
    <Modal>...</Modal> // iOS modal
  );
}
{
  Platform.OS === "android" && showDatePicker && (
    <DateTimePicker /> // Android native picker
  );
}
```

**Solution**: Made the modal pickers iOS-only and native pickers Android-only:

```typescript
// FIXED CODE
{
  Platform.OS === "ios" && showDatePicker && (
    <Modal>...</Modal> // iOS modal only
  );
}
{
  Platform.OS === "android" && showDatePicker && (
    <DateTimePicker /> // Android native picker only
  );
}
```

### 2. State Management Issues (RESOLVED)

**Problem**: The `tempDate` state wasn't properly synchronized with the
`selectedDate` prop, causing inconsistent behavior.

**Solution**: Added `useEffect` to sync `tempDate` with `selectedDate`:

```typescript
useEffect(() => {
  setTempDate(selectedDate);
}, [selectedDate]);
```

### 3. Platform-Specific Logic (IMPROVED)

**Problem**: Date/time change handlers had inconsistent logic between platforms.

**Solution**: Improved platform-specific handling with proper event type
checking:

```typescript
const handleDateChange = (event: any, date?: Date) => {
  if (Platform.OS === "android") {
    setShowDatePicker(false);
    if (date && event.type !== "dismissed") {
      // Handle Android selection
    }
  } else {
    // Handle iOS selection
  }
};
```

## Component Features

### Platform-Specific Behavior

- **iOS**: Uses modal pickers with Cancel/Done buttons for better UX
- **Android**: Uses native pickers that close automatically on selection

### Date and Time Selection

- Separate buttons for date and time selection
- Proper validation with minimum date constraints
- Consistent date/time formatting across platforms

### State Management

- Proper synchronization between component state and parent state
- Temporary state for iOS modal pickers
- Immediate updates for Android native pickers

## Usage

### Basic Usage

```typescript
import CustomDateTimePicker from "@/app/components/booking/DateTimePicker";

const MyComponent = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());

  return (
    <CustomDateTimePicker
      selectedDate={selectedDate}
      onDateChange={setSelectedDate}
      minimumDate={new Date()}
    />
  );
};
```

### Props Interface

```typescript
interface CustomDateTimePickerProps {
  selectedDate: Date; // Currently selected date and time
  onDateChange: (date: Date) => void; // Callback when date/time changes
  minimumDate?: Date; // Minimum allowed date (defaults to current date)
  maximumDate?: Date; // Maximum allowed date (optional)
}
```

## Integration with useBooking Hook

The DateTimePicker integrates seamlessly with the `useBooking` hook:

```typescript
// In useBooking.ts
const handleDateChange = useCallback((date: Date) => {
  setSelectedDate(date);
}, []);

// In BookingScreen.tsx
<CustomDateTimePicker
  selectedDate={selectedDate}
  onDateChange={handleDateChange}
  minimumDate={new Date()}
/>;
```

## Styling

The component uses theme-aware styling with the following key styles:

- `pickerButton`: Main selection buttons with elevation and rounded corners
- `modalOverlay`: Semi-transparent overlay for iOS modals
- `modalContent`: Modal content container with rounded top corners
- `dateTimePicker`: Picker component styling

## Validation

The component includes built-in validation:

- Date selection is restricted to future dates (minimumDate)
- Optional maximum date constraint
- Proper handling of cancelled selections

## Testing

To test the component:

1. **iOS**: Verify modal pickers appear with Cancel/Done buttons
2. **Android**: Verify native pickers appear and close automatically
3. **Date Selection**: Ensure only one picker appears at a time
4. **Time Selection**: Verify time updates correctly
5. **Validation**: Test with minimum/maximum date constraints

## Dependencies

- `@react-native-community/datetimepicker`: Core date/time picker functionality
- `@expo/vector-icons`: Icons for calendar and time buttons
- `useThemeColor`: Theme-aware color management

## Future Improvements

Potential enhancements for future versions:

- Custom date/time formatting options
- Time slot availability checking
- Recurring appointment support
- Accessibility improvements
- Dark/light theme optimizations
