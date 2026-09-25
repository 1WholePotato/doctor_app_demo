import { createContext } from "react";
import { type AppUser } from "../lib/auth";

export interface AuthContextType {
  user: AppUser | null;
  isAdmin: boolean;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  loading: true,
  refreshUser: async () => {},
});
