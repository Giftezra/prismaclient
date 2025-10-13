import DetailerProfileProps from "./OtherInterfaces";
import { MyAddressProps } from "./ProfileInterfaces";
import { MyVehiclesProps } from "./GarageInterface";
import dayjs from "dayjs";

/* This is for the service type which is the services the app renders,
 * With a description which will detail the  services contained in each package. */
export interface ServiceTypeProps {
  id?: string;
  name: string;
  description: string[];
  price: number;
  duration: number;
}

export interface ValetTypeProps {
  id?: string;
  name: string;
  description: string;
}

export interface AddOnsProps {
  id?: string;
  name: string;
  price: number;
  description: string;
  extra_duration: number;
}

export interface BookingScreenProps {
  vehicle?: MyVehiclesProps;
  service_type: ServiceTypeProps;
  valet_type: ValetTypeProps;
  address: MyAddressProps;
}
export interface BookedAppointmentProps {
  appointment_id?: string;
  booking_reference?: string;
  booking_date?: string;
  date: string;
  vehicle: MyVehiclesProps;
  valet_type: ValetTypeProps;
  service_type: ServiceTypeProps;
  detailer?: DetailerProfileProps; 
  address: MyAddressProps;
  status?: string;
  total_amount: number;
  addons?: AddOnsProps[];
  start_time?: string;
  duration?: number;
  special_instructions?: string;
  applied_free_quick_sparkle?: boolean;
}
export default interface BookingState {
  selected_service_type: ServiceTypeProps | null;
  selected_valet_type: ValetTypeProps | null;
  selected_vehicle: MyVehiclesProps | null;
  selected_address: MyAddressProps | null;
  service_type: ServiceTypeProps[] | null;
  valet_type: ValetTypeProps[] | null;
  selected_date: Date | null;
  special_instructions: string | null;
  isSuv: boolean;
}

export interface CreateBookingProps {
  booking_reference: string;
  service_type: string;
  client_name: string;
  client_phone: string;
  vehicle_registration: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  vehicle_color: string;
  address: string;
  city: string;
  postcode: string;
  country: string;
  latitude?: number;
  longitude?: number;
  valet_type: string;
  addons?: string[];
  special_instructions?: string;
  total_amount: number;
  status: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  // Only these two fields for detailer
  loyalty_tier?: string;
  loyalty_benefits?: string[]; // Array of free services
}

/**
 * Interface for a time slot
 */
export interface TimeSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  isSelected: boolean;
}

/**
 * Interface for calendar day
 */
export interface CalendarDay {
  date: dayjs.Dayjs;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  isDisabled: boolean;
}

export interface PaymentSheetResponse {
  paymentIntent: string;
  ephemeralKey: string;
  customer: string;
}
