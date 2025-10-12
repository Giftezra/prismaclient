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
  is_fleet_owner?: boolean;
  address: MyAddressProps | null;
  push_notification_token: boolean;
  email_notification_token: boolean;
  marketing_email_token: boolean;
  loyalty_tier?: string;
  loyalty_benefits?: {
    discount: number;
    free_service: string[];
  };
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
  rating: number;
  tip: number;
  is_reviewed: boolean;
}

export default interface ProfileState {
  new_address: MyAddressProps | null;
}
