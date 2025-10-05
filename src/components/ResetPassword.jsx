// src/components/auth/ResetPassword.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
} from "firebase/auth";
import { auth } from "../config/firebase";
import { Eye, EyeClosed } from "lucide-react";

const ResetPassword = () => {
  const nav = useNavigate();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const mode = params.get("mode");
  const oobCode = params.get("oobCode");

  const [verifying, setVerifying] = useState(true);
  const [valid, setValid] = useState(false);
  const [email, setEmail] = useState("");

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showA, setShowA] = useState(false);
  const [showB, setShowB] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const run = async () => {
      if (mode !== "resetPassword" || !oobCode) {
        setVerifying(false);
        setValid(false);
        return;
      }
      try {
        const mail = await verifyPasswordResetCode(auth, oobCode);
        setEmail(mail || "");
        setValid(true);
      } catch (e) {
        console.error("verifyPasswordResetCode:", e);
        setValid(false);
      } finally {
        setVerifying(false);
      }
    };
    run();
  }, [mode, oobCode]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    if (pw.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    if (pw !== pw2) {
      setErr("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, pw);
      // Link is now consumed & invalid for reuse.
      nav("/login", { replace: true, state: { resetSuccess: true } });
    } catch (e) {
      console.error("confirmPasswordReset:", e);
      setErr("This reset link is invalid or expired. Please request a new one.");
    } finally {
      setSubmitting(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[whitesmoke] px-4">
        <div className="bg-white border-2 border-[#1C1D21] rounded-2xl shadow p-6">
          Verifying link…
        </div>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[whitesmoke] px-4">
        <div className="w-full max-w-md bg-white border-2 border-[#1C1D21] rounded-2xl shadow p-6 text-center">
          <h1 className="text-xl font-semibold mb-2">Invalid or Used Link</h1>
          <p className="text-sm text-gray-600 mb-4">
            This password reset link is invalid, expired, or already used.
          </p>
          <Link to="/forgot-password" className="px-4 py-2 rounded bg-[#0A1936] text-white">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[whitesmoke] px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border-2 border-[#1C1D21] shadow p-6">
        <h1 className="text-2xl font-semibold mb-2">Set a New Password</h1>
        {email && <p className="text-sm text-gray-600 mb-4">For: <span className="font-medium">{email}</span></p>}

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="flex items-center border border-black rounded px-3">
            <input
              type={showA ? "text" : "password"}
              className="flex-1 py-2 text-sm outline-none"
              placeholder="New Password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
              minLength={6}
            />
            <button type="button" onClick={() => setShowA((v) => !v)} className="ml-2">
              {showA ? <EyeClosed size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="flex items-center border border-black rounded px-3">
            <input
              type={showB ? "text" : "password"}
              className="flex-1 py-2 text-sm outline-none"
              placeholder="Confirm Password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              required
              minLength={6}
            />
            <button type="button" onClick={() => setShowB((v) => !v)} className="ml-2">
              {showB ? <EyeClosed size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {err && <div className="text-red-600 text-sm">{err}</div>}

          <div className="pt-2 flex items-center justify-between">
            <Link to="/login" className="text-sm underline text-[#494949]">Back to Login</Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded bg-[#F2B611] text-white disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
