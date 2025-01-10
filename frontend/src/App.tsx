import { BrowserRouter as Router, Route, Routes } from "react-router-dom"
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import DomainsNew from "./pages/Domains";
import { AuthProvider } from "./hooks/useAuth";
import ProtectedRoute from "./utils/ProtectedRoute";
import Main from "./pages/Main";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<ProtectedRoute><Main><Dashboard /></Main></ProtectedRoute>} />
          <Route path="/domains" element={<ProtectedRoute><Main><DomainsNew /></Main></ProtectedRoute>} />
          <Route path="*" element={<p>Page Not Found</p>} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App;