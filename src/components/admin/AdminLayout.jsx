import React, { useState, useEffect } from "react";

import capstoneLogo from "../../assets/capstoneLogo.png";
import {
  AlignJustify,
  X,
  Users,
  FileText,
  Send,
  Clock,
  CheckCircle,
  Package,
  History,
  Lock,
  LogOut,
  ChevronDown,
  BotMessageSquare,
} from "lucide-react";

import ChatSettings from "./ChatSettings";
import UserManagement from "./UserManagement";
import SentReports from "./SentReports";
import OnProcess from "./OnProcess";
import ResolvedReports from "./ResolvedReports";
import AssetRequest from "./AssetRequest";
import RequestHistory from "./RequestHistory";
import ChangePassword from "../user/ChangePassword";

import { auth } from "../../config/firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../config/firebase";

const SIDEBAR_W = "w-64";
const HEADER_H = "h-20";

const AdminLayout = ({ setRole }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState("users");
  const [openDropdown, setOpenDropdown] = useState(null);
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
      setRole(null);
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const navigateTo = (view) => {
    setCurrentView(view);
    setIsSidebarOpen(false);
  };

  const toggleDropdown = (menu) => {
    setOpenDropdown(openDropdown === menu ? null : menu);
  };

  const renderContent = () => {
    switch (currentView) {
      case "users":
        return <UserManagement />;
      case "sent":
        return <SentReports />;
      case "onprocess":
        return <OnProcess />;
      case "resolved":
        return <ResolvedReports />;
      case "asset-request":
        return <AssetRequest />;
      case "asset-history":
        return <RequestHistory />;
      case "password":
        return <ChangePassword />;
      case "chat-settings":
        return <ChatSettings />;
      default:
        return <UserManagement />;
    }
  };

  // Pink fill (hover + active persist)
  const navLinkClass = (active) =>
    [
      "relative z-0 block w-full text-left px-4 py-2 rounded-md",
      "flex items-center gap-2",
      "text-gray-900 transition-colors duration-200",
      "hover:text-white",
      active ? "text-white" : "",
      "before:content-[''] before:absolute before:inset-0 before:rounded-md",
      "before:bg-[#eb58b5] before:origin-left before:scale-x-0",
      "before:transition-transform before:duration-300 before:ease-out",
      "hover:before:scale-x-100",
      active ? "before:scale-x-100" : "",
      "before:-z-10",
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#eb58b5]/40",
    ].join(" ");

  // Red fill for Logout
  const logoutLinkClass = [
    "relative z-0 block w-full text-left px-4 py-2 rounded-md",
    "flex items-center gap-2 justify-center",
    "text-red-700 transition-colors duration-200 hover:text-white",
    "before:content-[''] before:absolute before:inset-0 before:rounded-md",
    "before:bg-red-600 before:origin-left before:scale-x-0",
    "before:transition-transform before:duration-300 before:ease-out",
    "hover:before:scale-x-100 before:-z-10",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300",
  ].join(" ");

  return (
    <div className="relative min-h-screen bg-white">
      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 ${SIDEBAR_W} bg-[whitesmoke] text-gray-800
          transform transition-transform duration-300 ease-in-out z-50
          h-[100dvh]                 /* <- full dynamic viewport height on mobile */
          lg:translate-x-0 lg:static lg:block
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Right-edge border (stops at header height on lg) */}
        <div
          className="pointer-events-none hidden lg:block absolute right-0 w-px bg-gray-200 top-20 bottom-0"
          style={{ boxShadow: "1px 0 6px rgba(0,0,0,0.06)" }}
        />
        {/* Full-height edge for mobile drawer */}
        <div
          className="pointer-events-none lg:hidden absolute right-0 top-0 bottom-0 w-px bg-gray-200"
          style={{ boxShadow: "1px 0 6px rgba(0,0,0,0.08)" }}
        />

        {/* Full-height column */}
        <div className="flex h-full flex-col">
          {/* Top: Logo + close (mobile) */}
          <div className="flex items-center justify-center relative px-4 pt-4 pb-3 flex-shrink-0">
            <img src={capstoneLogo} alt="logo" className="h-20 w-auto drop-shadow" />
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="absolute right-3 top-3 text-gray-600 hover:text-gray-800 lg:hidden"
              aria-label="Close sidebar"
            >
              <X size={22} />
            </button>
          </div>

          {/* Nav (scrolls as needed) */}
          <nav className="px-4 py-2 flex-1 overflow-y-auto">
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => navigateTo("users")}
                  className={navLinkClass(currentView === "users")}
                >
                  <Users /> <span className="text-lg font-semibold">User</span>
                </button>
              </li>

              <li>
                <button
                  onClick={() => toggleDropdown("reports")}
                  className={navLinkClass(
                    currentView === "sent" ||
                      currentView === "onprocess" ||
                      currentView === "resolved"
                  )}
                >
                  <FileText />{" "}
                  <span className="text-lg font-semibold">Reported Issues</span>
                  <ChevronDown
                    className={`ml-auto transform transition-transform duration-300 ${
                      openDropdown === "reports" ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <div
                  className={`transition-all duration-500 ease-in-out overflow-hidden bg-[whitesmoke] rounded ml-4 ${
                    openDropdown === "reports" ? "max-h-96 py-2" : "max-h-0 py-0"
                  }`}
                >
                  <button
                    onClick={() => navigateTo("sent")}
                    className={navLinkClass(currentView === "sent")}
                  >
                    <Send size={16} />{" "}
                    <span className="text-md font-semibold">Sent Reports</span>
                  </button>
                  <button
                    onClick={() => navigateTo("onprocess")}
                    className={navLinkClass(currentView === "onprocess")}
                  >
                    <Clock size={16} />{" "}
                    <span className="text-md font-semibold">On Process</span>
                  </button>
                  <button
                    onClick={() => navigateTo("resolved")}
                    className={navLinkClass(currentView === "resolved")}
                  >
                    <CheckCircle size={16} />{" "}
                    <span className="text-md font-semibold">Resolved</span>
                  </button>
                </div>
              </li>

              {(profile.role === "MIS Admin" ||
                profile.role === "IT Support Specialist") && (
                <li>
                  <button
                    onClick={() => navigateTo("chat-settings")}
                    className={navLinkClass(currentView === "chat-settings")}
                  >
                    <BotMessageSquare />{" "}
                    <span className="text-lg font-semibold">IT HelpBot Settings</span>
                  </button>
                </li>
              )}

              <li>
                <button
                  onClick={() => toggleDropdown("asset")}
                  className={navLinkClass(
                    currentView === "asset-request" ||
                      currentView === "asset-history"
                  )}
                >
                  <Package />{" "}
                  <span className="text-lg font-semibold">Asset</span>
                  <ChevronDown
                    className={`ml-auto transform transition-transform duration-300 ${
                      openDropdown === "asset" ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <div
                  className={`transition-all duration-500 ease-in-out overflow-hidden bg-[whitesmoke] rounded ml-4 ${
                    openDropdown === "asset" ? "max-h-96 py-2" : "max-h-0 py-0"
                  }`}
                >
                  <button
                    onClick={() => navigateTo("asset-request")}
                    className={navLinkClass(currentView === "asset-request")}
                  >
                    <Send size={16} />{" "}
                    <span className="text-md font-semibold">Request Asset</span>
                  </button>
                  <button
                    onClick={() => navigateTo("asset-history")}
                    className={navLinkClass(currentView === "asset-history")}
                  >
                    <History size={16} />{" "}
                    <span className="text-md font-semibold">Request History</span>
                  </button>
                </div>
              </li>

              <li>
                <button
                  onClick={() => {
                    setCurrentView("password");
                    setIsSidebarOpen(false);
                    setShowPwdModal(true);
                  }}
                  className={navLinkClass(currentView === "password")}
                >
                  <Lock />{" "}
                  <span className="text-lg font-semibold">Change Password</span>
                </button>
              </li>
            </ul>
          </nav>

          {/* Bottom (sticks to bottom, no absolute) */}
          <div className="px-4 pt-4 pb-6 bg-[whitesmoke] mt-auto">
            <div className="mx-2 h-[3px] bg-[#eb58b5] rounded-full shadow-sm" />
            <div className="mt-3 text-center">
              <div className="text-sm tracking-widest font-extrabold text-gray-900">
                {profile.name || "—"}
              </div>
              <div className="text-xs text-gray-700 font-semibold">
                {profile.role || "—"}
              </div>
            </div>
            <div className="mt-2">
              <button onClick={handleLogout} className={logoutLinkClass}>
                <LogOut /> <span className="text-sm font-semibold">LOGOUT</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Header (fixed) — no logo */}
      <header
        className={`
          fixed top-0 left-0 right-0 ${HEADER_H} bg-[whitesmoke] lg:ml-64
          border-b border-gray-200 shadow-sm
        `}
      >
        <div className="h-full w-full flex items-center justify-between px-4">
          <button
            className="text-gray-700 lg:hidden"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <AlignJustify />
          </button>

          <h1 className="text-gray-900 text-xl lg:text-2xl font-semibold">
            {currentView === "users" && "User Management"}
            {currentView === "sent" && "Sent Reports"}
            {currentView === "onprocess" && "On Process"}
            {currentView === "resolved" && "Resolved Reports"}
            {currentView === "asset-request" && "Asset Request"}
            {currentView === "asset-history" && "Request History"}
            {currentView === "chat-settings" && "IT HelpBot Settings"}
            {currentView === "password" && "Change Password"}
          </h1>

          <div className="w-6" />
        </div>
      </header>

      {/* Main content */}
      <main className="fixed left-0 right-0 top-20 bottom-0 overflow-auto lg:ml-64">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-6">
          {renderContent()}
        </div>
      </main>

      {/* Password modal */}
      <ChangePassword
        open={showPwdModal}
        setOpen={(next) => {
          setShowPwdModal(next);
          if (!next && currentView === "password") setCurrentView("users");
        }}
      />
    </div>
  );
};

export default AdminLayout;
