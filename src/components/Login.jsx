import React, { useEffect, useState } from 'react'
import { auth } from '../config/firebase'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { User, Lock, Eye, EyeClosed } from 'lucide-react'
import '../css/login.css' 
import logo from '../assets/logo.png'
import { loginSuccessful, loginFailed, incompleteForm } from '../js/login.js'
import { useNavigate } from 'react-router-dom'
import Swal from "sweetalert2";

const Login = ({ setRole }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);            // 👈 add loading
  const Navigate = useNavigate();

  const togglePasswordVisibility = () => setShowPassword((s) => !s);

    useEffect(() => {
  const storedRole = localStorage.getItem('role');

  const adminRoles = [
    'Admin',
    'MIS Admin',
    'CSD Admin',
    'MIS Asst. Admin',
    'CSD Asst. Admin'
  ];

  if (adminRoles.includes(storedRole)) {
    Navigate('/admin');
  } else if (storedRole === 'Property Custodian') {
    Navigate('/custodian');   // 👈 redirect custodians
  } else if (storedRole) {
    Navigate('/user');
  }
}, [Navigate]);



  const signIn = async () => {
    if (loading) return;                                    // 👈 prevent double submit
    if (!email || !password) {
      incompleteForm();
      return;
    }

    try {
      setLoading(true);                                     // 👈 start loading
      // 1) Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      localStorage.setItem("uid", user.uid);

      // 2) Blocked check
      const blockedRef = doc(db, "blockedUsers", user.uid);
      const blockedSnap = await getDoc(blockedRef);
      if (blockedSnap.exists()) {
        Swal.fire("Blocked!", "Your account has been blocked from DCT SupportLink. Please contact or visit the MIS Office of DCT", "error");
        await auth.signOut();
        localStorage.clear();
        return;
      }

      // 3) User document
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        console.error("No such user document in Firestore!");
        loginFailed();
        return;
      }

      const userData = userDocSnap.data();
      if (userData.disabled) {
        Swal.fire("Blocked!", "Your account has been disabled by admin.", "error");
        await auth.signOut();
        localStorage.clear();
        return;
      }

      localStorage.setItem("role", userData.role);
      setRole(userData.role);

      loginSuccessful();
      if (userData.role === "Admin") {
        Navigate("/admin");
      } else {
        Navigate("/user");
      }
    } catch (error) {
      console.error("Error signing in:", error);
      loginFailed();
    } finally {
      setLoading(false);                                    // 👈 stop loading
    }
  };

  // Optional: allow Enter key to submit
  const onKeyDown = (e) => {
    if (e.key === 'Enter') signIn();
  };

  return (
    <div className='flex flex-col h-screen w-screen justify-center items-center login-page relative'>
      <img src={logo} alt="" className='h-30 w-40 mb-3'/>

      {/* Email Input */}
      <div
        style={{padding: '4px', marginBottom: '10px'}}
        className='flex flex-row justify-center items-center bg-white border-1 rounded-lg'
      >
        <User />
        <input
          className='w-[280px]'
          style={{ padding: '5px', outline: 'none', border: 'none' }}
          type="email"
          placeholder='Email...'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
        />
      </div>

      {/* Password Input */}
      <div
        style={{padding: '4px'}}
        className='flex flex-row justify-center items-center bg-white border-1 rounded-lg'
      >
        <Lock />
        <input
          className='w-64'
          style={{ padding: '5px', outline: 'none', border: 'none' }}
          type={showPassword ? "text" : "password"}
          placeholder='Password...'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
        />
        <button
          type="button"
          onClick={togglePasswordVisibility}
          className="focus:outline-none"
          disabled={loading}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeClosed className='cursor-pointer'/> : <Eye className='cursor-pointer'/>}
        </button>
      </div>

      {/* Login Button */}
      <button
        style={{marginTop: '15px', padding: '5px'}}
        className={`border-1 rounded-lg bg-white w-64 h-10 flex justify-center items-center font-semibold
                    ${loading ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-gray-100'}`}
        onClick={signIn}
        disabled={loading}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
            Logging in...
          </span>
        ) : (
          'Log in'
        )}
      </button>

      
    </div>
  )
}

export default Login
