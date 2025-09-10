import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Login from './components/Login';
import UserLayout from './components/user/UserLayout';
import AdminLayout from './components/admin/AdminLayout';
import CustodianLayout from './components/propertycustodian/CustodianLayout'; // 👈 import your Custodian layout

const adminRoles = [
  'Admin',
  'MIS Admin',
  'CSD Admin',
  'MIS Asst. Admin',
  'CSD Asst. Admin',
  'IT Support Specialist'
];

const App = () => {
  const [role, setRole] = useState(localStorage.getItem('role'));
  const isAdmin = adminRoles.includes(role || '');
  const isCustodian = role === 'Property Custodian'; // 👈 check for custodian

  // keep state in sync with localStorage
  useEffect(() => {
    const handleStorageChange = () => setRole(localStorage.getItem('role'));
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Landing */}
        <Route
          path="/"
          element={
            role ? (
              isAdmin ? (
                <Navigate to="/admin" replace />
              ) : isCustodian ? (
                <Navigate to="/custodian" replace />
              ) : (
                <Navigate to="/user" replace />
              )
            ) : (
              <Login setRole={setRole} />
            )
          }
        />

        {/* Admin area */}
        <Route
          path="/admin/*"
          element={
            isAdmin ? (
              <AdminLayout setRole={setRole} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        {/* Custodian area */}
        <Route
          path="/custodian/*"
          element={
            isCustodian ? (
              <CustodianLayout setRole={setRole} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        {/* User area */}
        <Route
          path="/user/*"
          element={
            role && !isAdmin && !isCustodian ? (
              <UserLayout setRole={setRole} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
