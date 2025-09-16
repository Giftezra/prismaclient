import {
  ServiceTypeProps,
  ValetTypeProps,
  AddOnsProps,
} from "./BookingInterfaces";
import DetailerProfileProps from "./OtherInterfaces";
import { MyVehiclesProps } from "./GarageInterface";
import { MyAddressProps } from "./ProfileInterfaces";

export default interface UpcomingAppointmentProps {
  appointment_id: string;
  detailer: DetailerProfileProps;
  vehicle: MyVehiclesProps;
  address: MyAddressProps;
  service_type: ServiceTypeProps;
  valet_type: ValetTypeProps;
  booking_date: string;
  total_amount: number;
  estimated_duration: string;
  special_instructions?: string;
  status?: string;
  start_time?: string;
  end_time?: string;
  add_ons: AddOnsProps[];
}

export interface RecentServicesProps {
  date: string;
  vehicle_name: string;
  status: string;
  cost: number;
  detailer: DetailerProfileProps;
  valet_type: string;
  service_type: string;
  tip: number;
  rating: number;
  is_reviewed: boolean;
  booking_reference: string;
}

export interface StatCard {
  icon: string;
  value: string | number;
  label: string;
  color: string;
}
export interface UserStatsResponse {
  services_this_month: number;
  services_this_year: number;
}
