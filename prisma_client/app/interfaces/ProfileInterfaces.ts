import {
  BookedAppointmentProps,
  ServiceTypeProps,
  ValetTypeProps,
} from "./BookingInterfaces";
import DetailerProfileProps from "./OtherInterfaces";

export interface UserProfileProps {
  id?: string;
  name: string;
  email: string;
  phone: string;
  address: MyAddressProps;
  latitude?: number;
  longitude?: number;
}
export interface MyAddressProps {
  id?: string;
  address: string;
  post_code: string;
  city: string;
  country: string;
}
export interface MyServiceHistoryProps {
  id: string;
  booking_date: string;
  appointment_date: string;
  service_type: string;
  valet_type: string;
  vehicle_reg: string;
  address: MyAddressProps;
  detailer: DetailerProfileProps;
  status: string;
  total_amount: number;
}

export default interface ProfileState {
  new_address: MyAddressProps | null;
}
