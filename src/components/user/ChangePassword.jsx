// src/components/custodian/ChangePassword.jsx
import React, { useState, useEffect } from "react";
import { Eye, EyeClosed, X } from "lucide-react";
import { auth } from "../../config/firebase";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import {
  attemptOverload,
  changePasswordFailed,
  incompleteForm,
  uniquePassword,
  loginRequires,
  passwordIncorrect,
  passwordLength,
  passwordMismatch,
  passwordUpdated
} from "../../js/login";

const ChangePassword = ({ open, setOpen }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [saving, setSaving] = useState(false);

  // 🔁 Reset fields & visibility whenever the modal opens
  useEffect(() => {
    if (open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
    }
  }, [open]);

  // Centralized close that also resets (in case you call it directly)
  const handleClose = () => {
    if (saving) return;
    setOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
  };

  if (!open) return null;

  const toggleCurrent = () => setShowCurrent((v) => !v);
  const toggleNew     = () => setShowNew((v) => !v);
  const toggleConfirm = () => setShowConfirm((v) => !v);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) return incompleteForm();
    if (newPassword !== confirmPassword) return passwordMismatch();
    if (newPassword === currentPassword) return uniquePassword();
    if (newPassword.length < 6) return passwordLength();

    try {
      setSaving(true);
      const user = auth.currentUser;
      if (!user || !user.email) {
        alert("No authenticated user found.");
        return;
      }

      // 1) Re-authenticate
      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);

      // 2) Update password
      await updatePassword(user, newPassword);

      passwordUpdated();

      // ✅ Close & reset after success
      handleClose();
    } catch (err) {
      console.error("Change password error:", err);
      const msg = String(err?.code || err?.message || err);
      if (msg.includes("auth/wrong-password"))       passwordIncorrect();
      else if (msg.includes("auth/too-many-requests")) attemptOverload();
      else if (msg.includes("auth/requires-recent-login")) loginRequires();
      else changePasswordFailed();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pt-10">
      {/* Backdrop */}
      <div onClick={handleClose} className="absolute inset-0 bg-black opacity-50" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-lg w-full max-w-sm p-6 transform transition-all duration-300 -translate-y-10 animate-slide-in"
        style={{ animation: "slideIn 0.3s ease-out forwards" }}
      >
        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          disabled={saving}
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold mb-4">Change Password</h2>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          {/* Current Password */}
          <div>
            <label className="block text-xs text-gray-700 mb-1">Current Password</label>
            <div className="flex items-center border-black border p-2 rounded-lg focus-within:ring-2 focus-within:ring-blue-400">
              <input
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                type={showCurrent ? "text" : "password"}
                placeholder="Current Password"
                className="flex-1 outline-none"
                required
                disabled={saving}
              />
              <button
                type="button"
                onClick={toggleCurrent}
                className="focus:outline-none ml-2"
                disabled={saving}
                aria-label={showCurrent ? "Hide password" : "Show password"}
              >
                {showCurrent ? <EyeClosed size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-xs text-gray-700 mb-1">New Password</label>
            <div className="flex items-center border-black border p-2 rounded-lg focus-within:ring-2 focus-within:ring-blue-400">
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type={showNew ? "text" : "password"}
                placeholder="New Password"
                className="flex-1 outline-none"
                required
                disabled={saving}
              />
              <button
                type="button"
                onClick={toggleNew}
                className="focus:outline-none ml-2"
                disabled={saving}
                aria-label={showNew ? "Hide password" : "Show password"}
              >
                {showNew ? <EyeClosed size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs text-gray-700 mb-1">Confirm Password</label>
            <div className="flex items-center border-black border p-2 rounded-lg focus-within:ring-2 focus-within:ring-blue-400">
              <input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm Password"
                className="flex-1 outline-none"
                required
                disabled={saving}
              />
              <button
                type="button"
                onClick={toggleConfirm}
                className="focus:outline-none ml-2"
                disabled={saving}
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeClosed size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={`w-full mt-2 rounded-lg py-3 font-bold text-white ${saving ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
            style={{ backgroundColor: "#F2B611" }}
            disabled={saving}
          >
            {saving ? "SAVING..." : "SAVE"}
          </button>
        </form>
      </div>

      {/* Slide animation */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-50px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Saving overlay */}
      {saving && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <p className="font-semibold">Updating password...</p>
            <div className="mt-3 animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChangePassword;
