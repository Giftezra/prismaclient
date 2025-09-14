export interface MyVehiclesProps {
  id: string;
  model: string;
  make: string;
  year: number;
  color: string;
  licence: string;
}

export interface MyVehicleStatsProps {
  vehicle: MyVehiclesProps | null;
  total_bookings: number;
  total_amount: number;
  last_cleaned: string;
  next_recommended_service: string;
}

export interface PromotionsProps {
  id: string;
  title: string;
  description: string;
  discount_percentage: number;
  valid_until: string;
  is_active: boolean;
  terms_conditions?: string;
}

export default interface GarageState {
  newVehicle: MyVehiclesProps | null;
}
