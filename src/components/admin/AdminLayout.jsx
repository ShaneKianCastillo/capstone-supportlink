import React, { useState, useEffect } from "react";
import logo from "../../assets/logo.png";
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
} from "lucide-react";

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

import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../config/firebase'

const SIDEBAR_W = "w-64"; // width class for desktop sidebar

const AdminLayout = ({ setRole }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState("users");
  const [openDropdown, setOpenDropdown] = useState(null);

  const [showPwdModal, setShowPwdModal] = useState(false);

  const navigate = useNavigate();

  const [profile, setProfile] = useState({ name: '', role: '' })

  useEffect(() => {
    const uid = localStorage.getItem('uid')
    if (!uid) return
    const unsub = onSnapshot(doc(db, 'users', uid), snap => {
      if (snap.exists()) {
        const data = snap.data()
        setProfile({
          name: data.name || '',
          role: data.role || ''
        })
      }
    })
    return () => unsub()
  }, [])

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
      default:
        return <UserManagement />;
    }
  };

  return (
    <div className="relative min-h-screen bg-white">
      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full ${SIDEBAR_W} bg-[#0A1936] text-white
          transform transition-transform duration-300 ease-in-out z-50
          lg:translate-x-0 lg:static lg:block  lg:min-h-[calc(100vh)]
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
         {/* Replace logo with user info */}
        <div className="p-4 pl-8 border-b border-gray-700 flex justify-between items-center lg:justify-start">
          <div className="flex flex-col">
            <h1 className="font-bold text-lg">{profile.name || '—'}</h1>
            <h2 className="text-sm text-gray-300">{profile.role || '—'}</h2>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="text-white hover:text-gray-300 lg:hidden"
          >
            <X size={24} />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="p-4">
          <ul className="space-y-2">
            {/* USERS */}
            <li>
              <button
                onClick={() => navigateTo("users")}
                className={`block p-2 rounded flex items-center gap-2 hover:bg-blue-500 w-full text-left ${
                  currentView === "users" ? "bg-blue-500" : ""
                }`}
              >
                <Users /> Users
              </button>
            </li>

            {/* REPORT LIST DROPDOWN */}
            <li>
              <button
                onClick={() => toggleDropdown("reports")}
                className="flex items-center justify-between w-full p-2 rounded hover:bg-blue-500"
              >
                <span className="flex items-center gap-2">
                  <FileText /> Report List
                </span>
                <ChevronDown
                  className={`transform transition-transform duration-300 ${
                    openDropdown === "reports" ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div
                className={`transition-all duration-500 ease-in-out overflow-hidden bg-[#0A1936] text-white rounded ml-4 ${
                  openDropdown === "reports" ? "max-h-96 py-2" : "max-h-0 py-0"
                }`}
              >
                <button
                  onClick={() => navigateTo("sent")}
                  className={`block rounded px-4 py-2 w-full text-left hover:bg-blue-500 ${
                    currentView === "sent" ? "bg-blue-500" : ""
                  }`}
                >
                  <Send size={16} className="inline mr-2" /> Sent Reports
                </button>
                <button
                  onClick={() => navigateTo("onprocess")}
                  className={`block rounded px-4 py-2 w-full text-left hover:bg-blue-500 ${
                    currentView === "onprocess" ? "bg-blue-500" : ""
                  }`}
                >
                  <Clock size={16} className="inline mr-2" /> On Process
                </button>
                <button
                  onClick={() => navigateTo("resolved")}
                  className={`block rounded px-4 py-2 w-full text-left hover:bg-blue-500 ${
                    currentView === "resolved" ? "bg-blue-500" : ""
                  }`}
                >
                  <CheckCircle size={16} className="inline mr-2" /> Resolved
                </button>
              </div>
            </li>

            {/* ASSET DROPDOWN */}
            <li>
              <button
                onClick={() => toggleDropdown("asset")}
                className="flex items-center justify-between w-full p-2 rounded hover:bg-blue-500"
              >
                <span className="flex items-center gap-2">
                  <Package /> Asset
                </span>
                <ChevronDown
                  className={`transform transition-transform duration-300 ${
                    openDropdown === "asset" ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div
                className={`transition-all duration-500 ease-in-out overflow-hidden bg-[#0A1936] text-white rounded ml-4 ${
                  openDropdown === "asset" ? "max-h-96 py-2" : "max-h-0 py-0"
                }`}
              >
                <button
                  onClick={() => navigateTo("asset-request")}
                  className={`block rounded px-4 py-2 w-full text-left hover:bg-blue-500 ${
                    currentView === "asset-request" ? "bg-blue-500" : ""
                  }`}
                >
                  <Send size={16} className="inline mr-2" /> Request Asset
                </button>
                <button
                  onClick={() => navigateTo("asset-history")}
                  className={`block rounded px-4 py-2 w-full text-left hover:bg-blue-500 ${
                    currentView === "asset-history" ? "bg-blue-500" : ""
                  }`}
                >
                  <History size={16} className="inline mr-2" /> Request History
                </button>
              </div>
            </li>

            {/* CHANGE PASSWORD */}
            <li>
              <button
                onClick={() => {
                   setCurrentView("password");     // update header label
                   setIsSidebarOpen(false);        // close drawer on mobile
                   setShowPwdModal(true);          // 👈 open the modal
                }}
                className={`block p-2 rounded flex items-center gap-2 hover:bg-blue-500 w-full text-left ${
                  currentView === "password" ? "bg-blue-500" : ""
                }`}
              >
                <Lock /> Change Password
              </button>
            </li>

            {/* LOGOUT */}
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

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Header (fixed) */}
      <header className="fixed top-0 left-0 right-0 bg-[#0A1936] h-20 z-40 lg:ml-64">
        <div className="h-full w-full flex items-center justify-between px-4">
          {/* Toggle only on mobile/tablet */}
          <button
            className="text-white lg:hidden"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <AlignJustify />
          </button>

          <h1 className="text-white text-xl font-semibold">
            {currentView === "users" && "User Management"}
            {currentView === "sent" && "Sent Reports"}
            {currentView === "onprocess" && "On Process"}
            {currentView === "resolved" && "Resolved Reports"}
            {currentView === "asset-request" && "Asset Request"}
            {currentView === "asset-history" && "Request History"}
            {currentView === "password" && "Change Password"}
          </h1>

          <img src={logo} alt="logo" className="h-10" />
        </div>
      </header>

      {/* Main content: fixed pane beneath header, fills to bottom (no footer here) */}
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

      <footer className="fixed bottom-0 left-0 right-0 bg-[#0A1936] h-20 flex items-center justify-center text-white z-30 lg:ml-64">
        <h1 className="text-base sm:text-lg font-bold">DCT SupportLink</h1>
      </footer>

      {/* Change Password modal from user components */}
      <ChangePassword
        open={showPwdModal}
        setOpen={(next) => {
          setShowPwdModal(next);
          if (!next && currentView === "password") {
            // when closing, you can optionally return to Users or keep current view
            setCurrentView("users");
          }
        }}
      />
    </div>
  );
};

export default AdminLayout;
