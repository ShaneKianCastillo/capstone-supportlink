import React, { useState, useEffect } from 'react';
import logo from '../../assets/logo.png';
import { AlignJustify, X, FilePenLine, ScrollText, UserPen, LogOut } from 'lucide-react';
import ReportModule from './ReportModule';
import ReportLog from './ReportLog';
import Profile from './Profile';
import { auth } from "../../config/firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import capstoneLogo from "../../assets/capstoneLogo.png";

const SIDEBAR_W = 'w-64';
const HEADER_H = 'h-20';

const UserLayout = ({ setRole }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState('report');
  const navigate = useNavigate();

  const [profile, setProfile] = useState({ name: '', role: '' });

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
    const uid = localStorage.getItem('uid');
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'users', uid), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setProfile({
          name: data.name || '',
          role: data.role || ''
        });
      }
    });
    return () => unsub();
  }, []);

  const navigateTo = (view) => {
    setCurrentView(view);
    setIsSidebarOpen(false);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'report':     return <ReportModule />;
      case 'report-log': return <ReportLog />;
      case 'profile':    return <Profile setRole={setRole} />;
      default:           return <ReportModule />;
    }
  };

  // Pink fill (hover + active persist) for normal links
  const navLinkClass = (view) => [
    "relative z-0 block w-full text-left px-4 py-2 rounded-md",
    "flex items-center gap-2",
    "text-gray-900 transition-colors duration-200",
    "hover:text-white",
    currentView === view ? "text-white" : "",
    "before:content-[''] before:absolute before:inset-0 before:rounded-md",
    "before:bg-[#eb58b5] before:origin-left before:scale-x-0",
    "before:transition-transform before:duration-300 before:ease-out",
    "hover:before:scale-x-100",
    currentView === view ? "before:scale-x-100" : "",
    "before:-z-10",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#eb58b5]/40"
  ].join(' ');

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
          h-[100dvh]
          lg:translate-x-0 lg:static lg:block
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Right-edge border + subtle shadow (starts below header on lg) */}
        <div
          className="pointer-events-none hidden lg:block absolute right-0 w-px bg-gray-200 top-20 bottom-0"
          style={{ boxShadow: '1px 0 6px rgba(0,0,0,0.06)' }}
        />
        {/* Full-height edge for mobile drawer */}
        <div
          className="pointer-events-none lg:hidden absolute right-0 top-0 bottom-0 w-px bg-gray-200"
          style={{ boxShadow: '1px 0 6px rgba(0,0,0,0.08)' }}
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
                  onClick={() => navigateTo('report')}
                  className={navLinkClass('report')}
                >
                  <FilePenLine /> <span className='text-lg font-semibold'>Create Report</span>
                </button>
              </li>

              <li>
                <button
                  onClick={() => navigateTo('report-log')}
                  className={navLinkClass('report-log')}
                >
                  <ScrollText /> <span className='text-lg font-semibold'>Report Log</span>
                </button>
              </li>

              <li>
                <button
                  onClick={() => navigateTo('profile')}
                  className={navLinkClass('profile')}
                >
                  <UserPen /> <span className='text-lg font-semibold'>Profile</span>
                </button>
              </li>
            </ul>
          </nav>

          {/* Bottom (sticks to bottom) */}
          <div className="px-4 pt-4 pb-6 bg-[whitesmoke] mt-auto">
            <div className="mx-2 h-[3px] bg-[#eb58b5] rounded-full shadow-sm" />
            <div className="mt-3 text-center">
              <div className="text-sm tracking-widest font-extrabold text-gray-900">
                {profile.name || '—'}
              </div>
              <div className="text-xs text-gray-700 font-semibold">
                {profile.role || '—'}
              </div>
            </div>
            <div className="mt-2">
              <button onClick={handleLogout} className={logoutLinkClass}>
                <LogOut /> <span className='text-sm font-semibold'>LOGOUT</span>
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

      {/* Header (fixed) — no logo here now */}
      <header
        className={`
          fixed top-0 left-0 right-0 ${HEADER_H} bg-[whitesmoke] z-40 lg:ml-64
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

          <h1 className="text-gray-900 text-base sm:text-xl lg:text-2xl font-semibold">
            {currentView === 'report' && 'Manual Report'}
            {currentView === 'report-log' && 'Report Log'}
            {currentView === 'profile' && 'Profile'}
          </h1>

          {/* spacer so title stays visually centered */}
          <div className="w-6" />
        </div>
      </header>

      {/* Main content area */}
      <main
        className="
          fixed left-0 right-0 top-20 bottom-0 overflow-auto
          lg:ml-64
        "
      >
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default UserLayout;
