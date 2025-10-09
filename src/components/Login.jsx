import React, { useEffect, useState } from "react";
import { auth } from "../config/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import {  Lock, Eye, EyeClosed } from "lucide-react";
import capstoneLogo from "../assets/capstoneLogo_nn.png";
import loginBg from "../assets/loginPanel.png";
import { loginSuccessful, loginFailed, incompleteForm } from "../js/login.js";
import { useNavigate, Link } from "react-router-dom";
import { Mail } from "lucide-react";
import Swal from "sweetalert2";

const Login = ({ setRole }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const Navigate = useNavigate();

  useEffect(() => {
    const storedRole = localStorage.getItem("role");
    const adminRoles = [
      "Admin",
      "MIS Admin",
      "CSD Admin",
      "MIS Asst. Admin",
      "CSD Asst. Admin",
      "IT Support Specialist",
    ];
    if (adminRoles.includes(storedRole)) Navigate("/admin");
    else if (storedRole === "Property Custodian") Navigate("/custodian");
    else if (storedRole) Navigate("/user");
  }, [Navigate]);

  const togglePasswordVisibility = () => setShowPassword((s) => !s);

  const signIn = async () => {
    if (loading) return;
    if (!email || !password) { incompleteForm(); return; }

    try {
      setLoading(true);
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      localStorage.setItem("uid", user.uid);

      const blockedSnap = await getDoc(doc(db, "blockedUsers", user.uid));
      if (blockedSnap.exists()) {
        Swal.fire(
          "Blocked!",
          "Your account has been blocked from DCT SupportLink. Please contact or visit the MIS Office of DCT",
          "error"
        );
        await auth.signOut();
        localStorage.clear();
        return;
      }

      const userDocSnap = await getDoc(doc(db, "users", user.uid));
      if (!userDocSnap.exists()) { loginFailed(); return; }

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
      if (userData.role === "Admin") Navigate("/admin");
      else if (userData.role === "Property Custodian") Navigate("/custodian");
      else Navigate("/user");
    } catch (error) {
      console.error("Error signing in:", error);
      loginFailed();
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") signIn();
  };

  return (
    <div className="min-h-screen w-full bg-[whitesmoke] flex items-center justify-center px-4 py-10">
      {/* Card / Panel */}
      <div className="w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden bg-white grid grid-cols-1 md:grid-cols-2">
        {/* LEFT: image + headline (desktop). On mobile it appears AFTER the form */}
        <div className="relative order-1 md:order-2 flex items-start justify-center bg-gray-200">
          {/* Image (cover on desktop for a full, polished fill; contain on mobile) */}
          <img
            src={loginBg}
            alt="Campus"
            className="absolute inset-0 h-full w-full object-contain object-cover"
          />

          {/* Dark gradient scrim for readability */}
          <div className="absolute inset-0 bg-gradient-to-tr from-black/10 via-black/15 to-transparent" />

          {/* Text block higher + glass card */}
          <div className="relative z-10 w-full max-w-sm px-6 md:px-10 pt-10 md:pt-14 pb-8">
            <div className="inline-block rounded-xl bg-black/30 backdrop-blur-md px-4 py-3 h-fit w-full">
              <h3 className="text-white text-2xl md:text-3xl font-extrabold drop-shadow-[0_3px_8px_rgba(0,0,0,0.8)]">
                Reporting Issue is<br />made easy
              </h3>
              <p className="mt-1 text-white/90 font-semibold text-sm md:text-base drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]">
                Welcome to DCT SupportLink.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT: form (desktop). On mobile it appears FIRST for efficiency */}
        <div className="order-1 md:order-2 p-8 md:p-10">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-4">
            Login
          </h2>

          {/* Pink Logo centered & bigger */}
          <div className="mb-2 flex justify-center">
            <img
              src={capstoneLogo}
              alt="Capstone Logo"
              className="block object-contain h-24 w-24 md:h-28 md:w-28"
            />
          </div>

          {/* Email */}
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <div className="mb-4 flex items-center rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm">
            <Mail className="mr-2 h-4 w-4 text-gray-700" />
            <input
              type="email"
              
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={loading}
              autoComplete="username"
              className="w-full bg-transparent text-sm outline-none placeholder:text-gray-500"
            />
          </div>

          {/* Password */}
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <div className="flex items-center rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm">
            <Lock className="mr-2 h-4 w-4 text-gray-700" />
            <input
              type={showPassword ? "text" : "password"}
              
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={loading}
              autoComplete="current-password"
              className="w-full bg-transparent text-sm outline-none placeholder:text-gray-500"
            />
            <button
              type="button"
              onClick={togglePasswordVisibility}
              disabled={loading}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="ml-2 inline-flex items-center justify-center text-gray-700"
            >
              {showPassword ? <EyeClosed className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Login */}
          <button
            onClick={signIn}
            disabled={loading}
            className={`mt-5 flex h-11 w-full items-center justify-center rounded-xl bg-gray-900 text-white font-semibold tracking-wide transition hover:bg-black ${
              loading ? "cursor-not-allowed opacity-70" : "cursor-pointer"
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                Logging in...
              </span>
            ) : (
              "Login"
            )}
          </button>

          {/* Divider + forgot */}
          <div className="mx-auto mt-5 h-0.5 w-2/3 bg-black/80" />
          <div className="mt-3 text-center">
            <Link to="/forgot-password" className="text-sm font-medium text-gray-800 underline">
              Forgot Password
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
