// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Login from "./components/Login";
import UserLayout from "./components/user/UserLayout";
import AdminLayout from "./components/admin/AdminLayout";
import CustodianLayout from "./components/propertycustodian/CustodianLayout";

import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";

// ✅ Import our FCM helper
import { requestFcmToken } from "./config/firebase";

const adminRoles = [
  "Admin",
  "MIS Admin",
  "CSD Admin",
  "MIS Asst. Admin",
  "CSD Asst. Admin",
  "IT Support Specialist",
];

const App = () => {
  const [role, setRole] = useState(localStorage.getItem("role"));
  const isAdmin = adminRoles.includes(role || "");
  const isCustodian = role === "Property Custodian";

  // keep state in sync with localStorage
  useEffect(() => {
    const handleStorageChange = () => setRole(localStorage.getItem("role"));
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // ✅ Request FCM token after login (for any logged-in user)
  useEffect(() => {
    const uid = localStorage.getItem("uid");
    if (uid) {
      requestFcmToken(uid);
    }
  }, [role]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public login alias (needed for reset redirect) */}
        <Route path="/login" element={<Login setRole={setRole} />} />

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

        {/* 🔐 Password reset flow (public) */}
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

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
