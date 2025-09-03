import React, { useEffect, useState } from "react";
import logo from "../../assets/logo.png";
import {
  AlignJustify,
  X,
  Package,
  History,
  Lock,
  LogOut,
} from "lucide-react";

import RequestList from "./RequestList";
import RequestLog from "./RequestLog";
import ChangePassword from "../user/ChangePassword";

import { auth } from "../../config/firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../config/firebase";

const SIDEBAR_W = "w-64";

const CustodianLayout = ({ setRole }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState("request-list"); // "request-list" | "request-log" | "password"
  const [showPwdModal, setShowPwdModal] = useState(false);

  const navigate = useNavigate();

  const [profile, setProfile] = useState({ name: "", role: "" });

  useEffect(() => {
    const uid = localStorage.getItem("uid");
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfile({
          name: data.name || "",
          role: data.role || "",
        });
      }
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("uid");
      localStorage.removeItem("role");
      if (typeof setRole === "function") setRole(null);
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const navigateTo = (view) => {
    setCurrentView(view);
    setIsSidebarOpen(false);
  };

  const renderContent = () => {
    switch (currentView) {
      case "request-list":
        return <RequestList />;
      case "request-log":
        return <RequestLog />;
      case "password":
        // We open modal instead of in-pane page, but keep a label in header
        return null;
      default:
        return <RequestList />;
    }
  };

  return (
    <div className="relative min-h-screen bg-white">
      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full ${SIDEBAR_W} bg-[#0A1936] text-white
          transform transition-transform duration-300 ease-in-out z-50
          lg:translate-x-0 lg:static lg:block lg:min-h-[calc(100vh)]
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* User header */}
        <div className="p-4 pl-8 border-b border-gray-700 flex justify-between items-center lg:justify-start">
          <div className="flex flex-col">
            <h1 className="font-bold text-lg">{profile.name || "—"}</h1>
            <h2 className="text-sm text-gray-300">{profile.role || "—"}</h2>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="text-white hover:text-gray-300 lg:hidden"
          >
            <X size={24} />
          </button>
        </div>

        {/* Sidebar nav */}
        <nav className="p-4">
          <ul className="space-y-2">
            {/* Request List */}
            <li>
              <button
                onClick={() => navigateTo("request-list")}
                className={`block p-2 rounded flex items-center gap-2 hover:bg-blue-500 w-full text-left ${
                  currentView === "request-list" ? "bg-blue-500" : ""
                }`}
              >
                <Package /> Request List
              </button>
            </li>

            {/* Request Log */}
            <li>
              <button
                onClick={() => navigateTo("request-log")}
                className={`block p-2 rounded flex items-center gap-2 hover:bg-blue-500 w-full text-left ${
                  currentView === "request-log" ? "bg-blue-500" : ""
                }`}
              >
                <History /> Request Log
              </button>
            </li>

            {/* Change Password (opens modal) */}
            <li>
              <button
                onClick={() => {
                  setCurrentView("password");
                  setIsSidebarOpen(false);
                  setShowPwdModal(true);
                }}
                className={`block p-2 rounded flex items-center gap-2 hover:bg-blue-500 w-full text-left ${
                  currentView === "password" ? "bg-blue-500" : ""
                }`}
              >
                <Lock /> Change Password
              </button>
            </li>

            {/* Logout */}
            <li>
              <button
                onClick={handleLogout}
                className="block p-2 rounded flex items-center gap-2 hover:bg-blue-500 w-full text-left"
              >
                <LogOut /> Logout
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Drawer overlay (mobile) */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-[#0A1936] h-20 z-40 lg:ml-64">
        <div className="h-full w-full flex items-center justify-between px-4">
          {/* Toggle (mobile/tablet) */}
          <button
            className="text-white lg:hidden"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <AlignJustify />
          </button>

          <h1 className="text-white text-xl font-semibold">
            {currentView === "request-list" && "Request List"}
            {currentView === "request-log" && "Request Log"}
            {currentView === "password" && "Change Password"}
          </h1>

          <img src={logo} alt="logo" className="h-10" />
        </div>
      </header>

      {/* Main content */}
      <main
        className="
          fixed left-0 right-0 top-20 bottom-0 overflow-auto
          lg:ml-64
        "
      >
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-6">
          {renderContent()}
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-[#0A1936] h-20 flex items-center justify-center text-white z-30 lg:ml-64">
        <h1 className="text-base sm:text-lg font-bold">DCT SupportLink</h1>
      </footer>

      {/* Change Password modal */}
      <ChangePassword
        open={showPwdModal}
        setOpen={(next) => {
          setShowPwdModal(next);
          if (!next && currentView === "password") {
            setCurrentView("request-list");
          }
        }}
      />
    </div>
  );
};

export default CustodianLayout;
