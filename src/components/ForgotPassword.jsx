// src/components/auth/ForgotPassword.jsx
import React, { useState } from "react";
import { sendPasswordResetEmail, fetchSignInMethodsForEmail } from "firebase/auth";
import { auth } from "../config/firebase"; // keep your existing path
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import capstoneLogo from "../assets/capstoneLogo_nn.png";
import loginBg from "../assets/loginPanel.png";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const target = email.trim();

    try {
      // 1) Check if the email exists in Firebase Auth
      const methods = await fetchSignInMethodsForEmail(auth, target);

      if (!methods || methods.length === 0) {
        setError("No account found with that email.");
        setSubmitting(false);
        return;
      }

      // Optional: Only allow password accounts to request a reset
      if (!methods.includes("password")) {
        setError("This account doesn’t use a password. Please sign in with your provider (e.g., Google).");
        setSubmitting(false);
        return;
      }

      // 2) Send password reset
      const actionCodeSettings = {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: true,
      };
      await sendPasswordResetEmail(auth, target, actionCodeSettings);
      setDone(true);
    } catch (err) {
      console.error("sendPasswordResetEmail:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[whitesmoke] flex items-center justify-center px-4 py-10">
      {/* Panel / Card: same shell as Login */}
      <div className="w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden bg-white grid grid-cols-1 md:grid-cols-2">
        {/* LEFT: image + headline (same as Login left) */}
        <div className="relative order-1 md:order-2 flex items-start justify-center bg-gray-200">
          <img
            src={loginBg}
            alt="Campus"
            className="absolute inset-0 h-full w-full object-contain object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-black/10 via-black/15 to-transparent" />
          <div className="relative z-10 w-full max-w-sm px-6 md:px-10 pt-10 md:pt-14 pb-8">
            <div className="inline-block rounded-xl bg-black/30 backdrop-blur-md px-4 py-3">
              <h3 className="text-white text-2xl md:text-3xl font-extrabold drop-shadow-[0_3px_8px_rgba(0,0,0,0.8)]">
                Forgot your password?
              </h3>
              <p className="mt-1 text-white/90 text-sm md:text-base drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]">
                Enter the email associated with your account and we’ll send you a password reset link.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT: form side */}
        <div className="order-1 md:order-2 p-8 md:p-10">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-4">
            Reset Password
          </h2>

          {/* Pink Logo centered */}
          <div className="mb-4 flex justify-center">
            <img
              src={capstoneLogo}
              alt="Capstone Logo"
              className="block object-contain h-24 w-24 md:h-28 md:w-28"
            />
          </div>

          {!done ? (
            <form onSubmit={onSubmit} className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="flex items-center rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm">
                <Mail className="mr-2 h-4 w-4 text-gray-700" />
                <input
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-gray-500"
                />
              </div>

              {error && (
                <div className="text-red-600 text-sm pt-1">{error}</div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className={`mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-gray-900 text-white font-semibold tracking-wide transition hover:bg-black ${
                  submitting ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                }`}
              >
                {submitting ? "Sending..." : "Send reset link"}
              </button>

              <div className="mx-auto mt-5 h-0.5 w-2/3 bg-black/80" />

              <div className="mt-3 text-center">
                <Link to="/login" className="text-sm font-medium text-gray-800 underline">
                  Back to Login
                </Link>
              </div>
            </form>
          ) : (
            <div className="text-sm">
              <p className="mb-3">
                If an account exists for <span className="font-semibold">{email}</span>, a password reset email has been sent.
                Please check your inbox (and spam folder).
              </p>
              <Link
                to="/login"
                className="inline-block px-5 py-2 rounded-xl bg-gray-900 text-white hover:bg-black"
              >
                Back to Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
