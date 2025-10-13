import { UserProfileProps } from "./ProfileInterfaces";

export default interface AuthState {
  user?: UserProfileProps | null;
  access?: string;
  refresh?: string;
  isAuthenticated?: boolean;
  isLoading?: boolean;
  signUpData?: SignUpScreenProps | null;
}

export interface SignUpScreenProps {
  name: string;
  email: string;
  phone: string;
  password: string;
  referred_code?: string;
<<<<<<< HEAD
=======
  isFleetOwner?: boolean;
>>>>>>> develop
}

export interface LoginScreenProps {
  email: string;
  password: string;
}
