import { useContext } from "react";
import { AuthContext } from "./authContextDef";

export function useAuth() {
  return useContext(AuthContext);
}
