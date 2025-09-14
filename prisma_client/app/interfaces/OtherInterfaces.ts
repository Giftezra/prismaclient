export default interface DetailerProfileProps {
  id?: string;
  name: string;
  rating: number;
  phone?: string;
}

export interface ReturnBookingProps {
  detailer: DetailerProfileProps;
  job: {
    booking_reference: string;
    appointment_date: string;
    appointment_time: string;
    address: string;
  };
}
