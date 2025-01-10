import { Navigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth";

type Props = {
  children?: React.ReactNode;
};

function ProtectedRoute ({ children }: Props) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <></>
  }

  if (!isAuthenticated) {
    return <Navigate to="/" />
  }

  return children
}

export default ProtectedRoute