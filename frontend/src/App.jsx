import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import NavBar               from './components/NavBar.jsx';
import MerchantPage         from './pages/MerchantPage.jsx';
import DashboardPage        from './pages/DashboardPage.jsx';
import SetupPage            from './pages/SetupPage.jsx';
import CustomerInvoicePage  from './pages/CustomerInvoicePage.jsx';
import { getMerchant }      from './services/storage.js';

// Show NavBar only on merchant-facing routes
function Layout() {
  const location = useLocation();
  const hideNav  = location.pathname === '/setup' || location.pathname === '/invoice';
  const merchant = getMerchant();

  // Redirect to setup on first launch (except invoice page)
  if (!merchant && !hideNav) {
    return <Navigate to="/setup" replace />;
  }

  return (
    <>
      <Routes>
        <Route path="/"          element={<MerchantPage />}        />
        <Route path="/dashboard" element={<DashboardPage />}       />
        <Route path="/setup"     element={<SetupPage />}           />
        <Route path="/invoice"   element={<CustomerInvoicePage />} />
        <Route path="*"          element={<Navigate to="/" />}     />
      </Routes>
      {!hideNav && <NavBar />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
