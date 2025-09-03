import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import axios from "axios";                         // 👈 add axios
import { db } from "../../config/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { profileUpdated } from '../../js/login.js';


const EditProfile = ({ open, setOpen }) => {
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // fields
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");

  // avatar
  const [photoUrl, setPhotoUrl] = useState("");     // current (persisted) URL or preview
  const [photoFile, setPhotoFile] = useState(null); // NEW chosen file to upload
  const fileInputRef = useRef(null);

  // fetch user on open
  useEffect(() => {
    const fetchUser = async () => {
      if (!open) return;
      try {
        setInitialLoading(true);
        const uid = localStorage.getItem("uid");
        if (!uid) {
          alert("No user is logged in.");
          setOpen(false);
          return;
        }
        const ref = doc(db, "users", uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          alert("User record not found.");
          setOpen(false);
          return;
        }
        const data = snap.data();
        setName(data.name || "");
        setRole(data.role || "");
        setDepartment(data.department || "");
        setPhotoUrl(data.photoUrl || "");
        setPhotoFile(null); // reset pending file
      } catch (e) {
        console.error("Failed to load profile:", e);
        alert("Failed to load profile.");
        setOpen(false);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchUser();
  }, [open, setOpen]);

  if (!open) return null;

  const onPickPhoto = () => fileInputRef.current?.click();

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    // show preview immediately
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(reader.result); // data URL preview (not saved)
    reader.readAsDataURL(f);
  };

  // === Cloudinary upload (same pattern as ReportModule) ===
  const uploadAvatarToCloudinary = async () => {
    if (!photoFile) return null; // nothing new picked
    const formData = new FormData();
    formData.append("file", photoFile);
    formData.append("upload_preset", "supportlink");

    try {
      const res = await axios.post(
        "https://api.cloudinary.com/v1_1/dsycysb0e/image/upload",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return res.data.secure_url; // 👈 use this in Firestore
    } catch (err) {
      console.error("Avatar upload error:", err);
      return null;
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const uid = localStorage.getItem("uid");
    if (!uid) return;

    if (!name.trim() || !role.trim() || !department.trim()) {
      alert("Please fill in Name, Role, and Department.");
      return;
    }

    try {
      setSaving(true);

      // 1) Upload new avatar if a new file was chosen; else keep existing url
      let finalPhotoUrl = null;
      if (photoFile) {
        finalPhotoUrl = await uploadAvatarToCloudinary();
        if (!finalPhotoUrl) {
          // If upload failed, optionally keep the existing photoUrl instead of blocking save
          finalPhotoUrl = typeof photoUrl === "string" ? photoUrl : "";
        }
      } else {
        finalPhotoUrl = typeof photoUrl === "string" ? photoUrl : "";
      }

      // 2) Update Firestore
      const ref = doc(db, "users", uid);
      await updateDoc(ref, {
        name: name.trim(),
        role: role.trim(),
        department: department.trim(),
        photoUrl: finalPhotoUrl,
        updatedAt: serverTimestamp(),
      });

      profileUpdated(); // show success alert
      setOpen(false);
    } catch (err) {
      console.error("Update error:", err);
      alert("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pt-10">
      {/* Backdrop */}
      <div
        onClick={() => !saving && setOpen(false)}
        className="absolute inset-0 bg-black opacity-50"
      />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-lg w-full max-w-sm p-6 transform transition-all duration-300 -translate-y-10 animate-slide-in"
        style={{ animation: "slideIn 0.3s ease-out forwards" }}
      >
        {/* Close */}
        <button
          onClick={() => !saving && setOpen(false)}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          disabled={saving}
        >
          <X size={20} />
        </button>

        <form onSubmit={onSubmit}>
          {/* Avatar + edit badge */}
          <div className="w-full flex justify-center">
            <div className="relative">
              <div className="bg-[#0A1936] rounded-full h-24 w-24 flex items-center justify-center overflow-hidden">
                {photoUrl ? (
                  <img src={photoUrl} alt="avatar" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <button
                type="button"
                onClick={onPickPhoto}
                className="absolute -right-1 -bottom-1 bg-white border rounded-full p-1 shadow"
                title="Change photo"
                disabled={saving}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-black" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/>
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChange}
              />
            </div>
          </div>

          {/* Fields */}
          <div className="mt-5 space-y-3">
            <div>
              <label className="block text-xs text-gray-700 mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-black rounded-lg px-3 py-2"
                placeholder="Full Name"
                required
                disabled={saving || initialLoading}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">Role</label>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full border border-black rounded-lg px-3 py-2"
                placeholder="e.g., Admin or User"
                required
                disabled={saving || initialLoading}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">Department</label>
              <input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full border border-black rounded-lg px-3 py-2"
                placeholder="College of Computer Studies"
                required
                disabled={saving || initialLoading}
              />
            </div>

            <button
              type="submit"
              className={`w-full mt-2 rounded-lg py-3 font-bold text-white ${saving ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
              style={{ backgroundColor: "#F2B611" }}
              disabled={saving || initialLoading}
            >
              {saving ? "SAVING..." : "SAVE"}
            </button>
          </div>
        </form>
      </div>

      {/* Slide animation */}
      <style>
        {`
          @keyframes slideIn {
            from { opacity: 0; transform: translateY(-50px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>

      {(initialLoading || saving) && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <p className="font-semibold">{saving ? "Saving..." : "Loading profile..."}</p>
            <div className="mt-3 animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
          </div>
        </div>
      )}
    </div>
  );
};

export default EditProfile;
