import React, { useEffect, useState } from 'react';
import { UserPen, LockKeyhole, LogOut } from 'lucide-react';
import { db } from '../../config/firebase'; // ← adjust if needed
import { doc, onSnapshot } from 'firebase/firestore';
import EditProfile from './EditProfile';
import ChangePassword from './ChangePassword'; // ← keep in same folder or adjust path
import { useNavigate } from "react-router-dom";
import {auth} from "../../config/firebase";
import { signOut } from "firebase/auth";

const Profile = ({setRole}) => {
  const [open, setOpen] = useState(false);              // edit profile modal
  const [openChangePwd, setOpenChangePwd] = useState(false); // change password modal

  const navigate = useNavigate();

  const handleLogout = async () => {
  try {
    await signOut(auth);
    localStorage.removeItem("uid");
    localStorage.removeItem("role");

    if (typeof setRole === 'function') setRole(null); // 👈 guard

    navigate("/", { replace: true }); // optional replace to avoid back nav
  } catch (error) {
    console.error("Error signing out:", error);
  }
};

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({
    name: '',
    role: '',
    department: '',
    photoUrl: ''
  });

  useEffect(() => {
    const uid = localStorage.getItem('uid');
    if (!uid) {
      setLoading(false);
      return;
    }

    const ref = doc(db, 'users', uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setProfile({
            name: data.name || '',
            role: data.role || '',
            department: data.department || '',
            photoUrl: data.photoUrl || ''
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error('Profile onSnapshot error:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return (
    <div>
      {/* loading overlay */}
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-40">
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <p className="font-semibold">Loading profile...</p>
            <div className="mt-3 animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
          </div>
        </div>
      )}

      <div className='flex flex-col justify-center items-center mt-10 pb-28'>
        {/* Avatar */}
        <div className='h-40 w-40 rounded-full border-4 border-white shadow ring-2 ring-[#0A1936] overflow-hidden bg-[#0A1936] flex items-center justify-center'>
          {profile.photoUrl ? (
            <img
              src={profile.photoUrl}
              alt="Profile"
              className="h-full w-full object-cover rounded-full"
            />
          ) : (
            <span className="text-white font-bold text-2xl select-none">
              {(profile.name || 'U').trim().charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Name */}
        <h1 className='text-2xl font-bold mt-4'>
          {profile.name || '—'}
        </h1>

        {/* Role */}
        <p className='text-gray-700'>{profile.role || '—'}</p>

        {/* Department */}
        <h1 className='text-xl font-semibold'>
          {profile.department || '—'}
        </h1>

        {/* Actions */}
        <div className='w-96 bg-gray-200 h-10 mt-5 flex justify-start pl-5 items-center gap-1 rounded'>
          <UserPen />
          <button
            onClick={() => setOpen(true)}
            className='cursor-pointer font-semibold w-full flex justify-start'
          >
            Edit Profile
          </button>
        </div>

        <div className='w-96 bg-gray-200 h-10 mt-3 flex justify-start pl-5 items-center gap-1 rounded'>
          <LockKeyhole />
          <button
            onClick={() => setOpenChangePwd(true)}
            className='cursor-pointer font-semibold w-full flex justify-start'
          >
            Change Password
          </button>
        </div>

        <div className='w-96 bg-gray-200 h-10 mt-3 flex justify-start pl-5 items-center gap-1 rounded'>
          <LogOut />
          <button 
            onClick={handleLogout}
            className='cursor-pointer font-semibold w-full flex justify-start'>
            Logout
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className='bg-[#0A1936] w-screen h-20 fixed bottom-0 flex justify-center items-center text-white'>
        <h1 className='text-lg font-bold'>DCT SupportLink</h1>
      </div>

      {/* Modals */}
      <EditProfile open={open} setOpen={setOpen} />
      <ChangePassword open={openChangePwd} setOpen={setOpenChangePwd} />
    </div>
  );
};

export default Profile;
