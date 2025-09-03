import React, { useState, useEffect } from 'react'
import logo from '../../assets/logo.png';
import { AlignJustify, X, FilePenLine, BotMessageSquare, ScrollText, UserPen, LogOut } from 'lucide-react';
import ReportModule from './ReportModule';
import ChatBot from './ChatBot';
import ReportLog from './ReportLog';
import Profile from './Profile';
import {auth} from "../../config/firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../config/firebase'

const SIDEBAR_W = 'w-64'; // Tailwind width class for desktop sidebar

const UserLayout = ({ setRole }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState('report');
  const navigate = useNavigate();

  const [profile, setProfile] = useState({ name: '', role: '' })

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

  const navigateTo = (view) => {
    setCurrentView(view);
    setIsSidebarOpen(false);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'report':     return <ReportModule />;
      case 'chatbot':    return <ChatBot />;
      case 'report-log': return <ReportLog />;
      case 'profile':    return <Profile setRole={setRole} />;
      default:           return <ReportModule />;
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
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
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

        <nav className="p-4">
          <ul className="space-y-2">
            <li>
              <button
                onClick={() => navigateTo('report')}
                className={`block p-2 rounded flex items-center gap-2 hover:bg-blue-500 w-full text-left ${currentView === 'report' ? 'bg-blue-500' : ''}`}
              >
                <FilePenLine />Create Report
              </button>
            </li>
            <li>
              <button
                onClick={() => navigateTo('chatbot')}
                className={`block p-2 rounded flex items-center gap-2 hover:bg-blue-500 w-full text-left ${currentView === 'chatbot' ? 'bg-blue-500' : ''}`}
              >
                <BotMessageSquare />Chat Bot
              </button>
            </li>
            <li>
              <button
                onClick={() => navigateTo('report-log')}
                className={`block p-2 rounded flex items-center gap-2 hover:bg-blue-500 w-full text-left ${currentView === 'report-log' ? 'bg-blue-500' : ''}`}
              >
                <ScrollText />Report Log
              </button>
            </li>
            <li>
              <button
                onClick={() => navigateTo('profile')}
                className={`block p-2 rounded flex items-center gap-2 hover:bg-blue-500 w-full text-left ${currentView === 'profile' ? 'bg-blue-500' : ''}`}
              >
                <UserPen />Profile
              </button>
            </li>
            <li>
              <button
                onClick={handleLogout}
                className="block p-2 rounded flex items-center gap-2 hover:bg-blue-500 w-full text-left"
              >
                <LogOut />Logout
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
          <button
            className="text-white lg:hidden"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <AlignJustify />
          </button>

          <h1 className="text-white text-base sm:text-xl font-semibold font-medium">
            {currentView === 'report' && 'Manual Report'}
            {currentView === 'chatbot' && 'Chat Bot'}
            {currentView === 'report-log' && 'Report Log'}
            {currentView === 'profile' && 'Profile'}
          </h1>

          <img src={logo} alt="logo" className="h-10" />
        </div>
      </header>

      {/* Main content area: fixed between header and footer */}
      <main
        className="
          fixed left-0 right-0 top-20 bottom-20 overflow-auto
          lg:ml-64
        "
      >
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
          {renderContent()}
        </div>
      </main>

      {/* Footer (fixed) */}
      <footer className="fixed bottom-0 left-0 right-0 bg-[#0A1936] h-20 flex items-center justify-center text-white z-30 lg:ml-64">
        <h1 className="text-base sm:text-lg font-bold">DCT SupportLink</h1>
      </footer>
    </div>
  );
};

export default UserLayout;
