// src/components/custodian/RequestHistory.jsx
import React, { useEffect, useMemo, useState } from "react";
import { ArrowDown } from "lucide-react";
import { db } from "../../config/firebase";
import {
  collection,
  onSnapshot,
  doc,
  deleteDoc,
  query,
  where,
  updateDoc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import Swal from "sweetalert2";

const PAGE_SIZE = 6;

const RequestHistory = () => {
  const [isOpen, setIsOpen] = useState(null);
  const [reqList, setReqList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  // full-screen image preview
  const [imgPreviewUrl, setImgPreviewUrl] = useState(null);
  const openPreview = (url) => url && setImgPreviewUrl(url);
  const closePreview = () => setImgPreviewUrl(null);

  // EDIT MODAL state (for Pending + owner)
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editReq, setEditReq] = useState(null);
  const [assetName, setAssetName] = useState("");
  const [reason, setReason] = useState("");
  const [currentImageUrl, setCurrentImageUrl] = useState("");
  const [newImageFile, setNewImageFile] = useState(null);
  const fileInputId = "asset-edit-upload";
  const cameraInputId = "asset-edit-camera";

  // filter
  const [statusFilter, setStatusFilter] = useState("All");

  // pagination
  const [page, setPage] = useState(1);

  // who am I
  const uid    = (localStorage.getItem("uid") || "").trim();
  const myRole = (localStorage.getItem("role") || "").trim();

  // group pairing (admins <-> assistants)
  const roleGroupFor = (role) => {
    const r = role.toLowerCase();
    if (r === "mis admin" || r === "mis asst. admin") {
      return ["MIS Admin", "MIS Asst. Admin"];
    }
    if (r === "csd admin" || r === "csd asst. admin") {
      return ["CSD Admin", "CSD Asst. Admin"];
    }
    // Everyone else: only themselves
    return null;
  };

  // derive allowed UIDs for the query
  const [allowedUids, setAllowedUids] = useState([uid]); // default to self
  const [uidsReady, setUidsReady] = useState(false);

  // Phase 1: compute allowed UID set based on role pairing
  useEffect(() => {
    const group = roleGroupFor(myRole);
    if (!group) {
      setAllowedUids([uid]);
      setUidsReady(true);
      return;
    }

    const usersRef = collection(db, "users");
    const unsub = onSnapshot(
      query(usersRef, where("role", "in", group)),
      (snap) => {
        const ids = new Set();
        snap.forEach((d) => ids.add(d.id));
        if (!ids.size && uid) ids.add(uid);
        setAllowedUids(Array.from(ids));
        setUidsReady(true);
      },
      (err) => {
        console.error("[RequestHistory] users group load error:", err);
        setAllowedUids([uid]);
        setUidsReady(true);
      }
    );
    return () => unsub();
  }, [uid, myRole]);

  // Phase 2: subscribe to assetRequests with correct visibility
  useEffect(() => {
    if (!uidsReady) return;

    setLoading(true);
    setError(null);

    let qRef;
    const baseRef = collection(db, "assetRequests");

    if (!allowedUids?.length) {
      setReqList([]);
      setLoading(false);
      return;
    }

    if (allowedUids.length === 1) {
      qRef = query(baseRef, where("uid", "==", allowedUids[0]));
    } else {
      qRef = query(baseRef, where("uid", "in", allowedUids));
    }

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((r) => !r.hiddenForAdmin);

        rows.sort((a, b) => {
          const ta =
            a.resolvedAt?.toMillis?.() ??
            a.processedAt?.toMillis?.() ??
            a.approvedAt?.toMillis?.() ??
            a.declinedAt?.toMillis?.() ??
            a.serverTimeStamp?.toMillis?.() ??
            0;
          const tb =
            b.resolvedAt?.toMillis?.() ??
            b.processedAt?.toMillis?.() ??
            b.approvedAt?.toMillis?.() ??
            b.declinedAt?.toMillis?.() ??
            b.serverTimeStamp?.toMillis?.() ??
            0;
          return tb - ta;
        });
        setReqList(rows);
        setLoading(false);
      },
      (err) => {
        console.error("[RequestHistory] assetRequests onSnapshot error:", err);
        setError("Failed to load asset requests.");
        setReqList([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uidsReady, allowedUids]);

  const formatDateTime = (ts) => {
    try {
      const d =
        ts && typeof ts.toDate === "function"
          ? ts.toDate()
          : ts instanceof Date
          ? ts
          : null;
      if (!d) return "—";
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  const StatusChip = ({ status }) => {
    const s = (status || "").toLowerCase();
    const bg =
      s === "approved"    ? "bg-green-600"  :
      s === "on process"  ? "bg-yellow-500" :
      s === "declined"    ? "bg-red-600"    :
      s === "pending"     ? "bg-gray-600"   :
                            "bg-slate-500";
    return (
      <span className={`${bg} text-white text-xs px-2 py-1 rounded`}>
        {status || "—"}
      </span>
    );
  };

  // Counts
  const counts = useMemo(() => {
    let pending = 0,
      onproc = 0,
      approved = 0,
      declined = 0;
    for (const r of reqList) {
      const s = (r.status || "").toLowerCase();
      if (s === "pending") pending++;
      else if (s === "on process") onproc++;
      else if (s === "approved") approved++;
      else if (s === "declined") declined++;
    }
    return { pending, onproc, approved, declined, all: reqList.length };
  }, [reqList]);

  // Filtered
  const filteredList = useMemo(() => {
    if (statusFilter === "All") return reqList;
    const wanted = statusFilter.toLowerCase();
    return reqList.filter((r) => (r.status || "").toLowerCase() === wanted);
  }, [statusFilter, reqList]);

  // Reset to page 1 when filter or list changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter, filteredList.length]);

  // Pagination math
  const totalPages = Math.max(1, Math.ceil(filteredList.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const startIdx = (page - 1) * PAGE_SIZE;
  const pageItems = filteredList.slice(startIdx, startIdx + PAGE_SIZE);

  // ---- Remove (Admin): soft-hide first; hard-delete only if user also hid ----
  const removeAsAdmin = async (req) => {
    try {
      const result = await Swal.fire({
        title: "Remove this request?",
        text: "This will remove it from your Request History. If the requester also removed it, it will be deleted permanently.",
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Continue",
      });
      if (!result.isConfirmed) return;

      Swal.fire({
        title: "Applying...",
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });

      const hideId = `${req.uid}_${req.id}`;
      const hideRef = doc(db, "userAssetHides", hideId);
      const hideSnap = await getDoc(hideRef);

      if (hideSnap.exists()) {
        await deleteDoc(doc(db, "assetRequests", req.id));
        Swal.close();
        await Swal.fire({
          title: "Deleted",
          text: "The request was deleted permanently.",
          icon: "success",
          timer: 1400,
          showConfirmButton: false,
        });
      } else {
        await setDoc(
          doc(db, "assetRequests", req.id),
          {
            hiddenForAdmin: true,
            hiddenForAdminAt: serverTimestamp(),
          },
          { merge: true }
        );
        Swal.close();
        await Swal.fire({
          title: "Removed",
          text: "The request is removed from your Request History.",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
      }
    } catch (error) {
      console.error("[RequestHistory] removeAsAdmin error:", error);
      Swal.close();
      Swal.fire("Error!", "Failed to remove the request.", "error");
    }
  };

  // Admin may remove Approved **or Declined**
  const canRemove = (req) => {
    const s = (req.status || "").toLowerCase();
    const isApprovedOrDeclined = s === "approved" || s === "declined";
    const isAdmin = myRole === "MIS Admin" || myRole === "CSD Admin";
    return isApprovedOrDeclined && isAdmin;
  };

  // ---------- EDIT helpers ----------
  const openEdit = (req) => {
    setEditReq(req);
    setAssetName(req.assetName || "");
    setReason(req.reason || "");
    setCurrentImageUrl(req.imageUrl || "");
    setNewImageFile(null);
    setEditOpen(true);
  };

  const closeEdit = () => {
    if (saving) return;
    setEditOpen(false);
    setEditReq(null);
    setNewImageFile(null);
  };

  const validateEdit = () => {
    if (!assetName.trim()) return "Please enter the Asset Name.";
    if (!reason.trim()) return "Please enter the Reason for Using.";
    if (!(newImageFile || currentImageUrl)) return "Please attach an image.";
    return null;
  };

  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "supportlink"); // same preset you use elsewhere
    try {
      const res = await fetch("https://api.cloudinary.com/v1_1/dsycysb0e/image/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data?.secure_url) return data.secure_url;
      throw new Error("Upload failed");
    } catch (e) {
      console.error("[RequestHistory] upload error:", e);
      return null;
    }
  };

  const saveEdit = async () => {
    if (!editReq?.id) return;
    const err = validateEdit();
    if (err) {
      await Swal.fire("Missing info", err, "info");
      return;
    }

    try {
      setSaving(true);
      Swal.fire({
        title: "Saving...",
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });

      let finalImageUrl = currentImageUrl;
      if (newImageFile) {
        const uploaded = await uploadToCloudinary(newImageFile);
        if (!uploaded) {
          Swal.close();
          await Swal.fire("Upload failed", "Could not upload the image. Try again.", "error");
          setSaving(false);
          return;
        }
        finalImageUrl = uploaded;
      }

      const updatePayload = {
        assetName: assetName.trim(),
        reason: reason.trim(),
        imageUrl: finalImageUrl || "",
        lastEditedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "assetRequests", editReq.id), updatePayload);

      Swal.close();
      await Swal.fire({
        title: "Updated",
        text: "Your request has been updated.",
        icon: "success",
        timer: 1200,
        showConfirmButton: false,
      });

      // Optimistic local update
      setReqList((prev) =>
        prev.map((r) => (r.id === editReq.id ? { ...r, ...updatePayload } : r))
      );

      closeEdit();
    } catch (e) {
      console.error("[RequestHistory] saveEdit error:", e);
      Swal.close();
      Swal.fire("Error", "Failed to update the request.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full">
      {/* LOADING OVERLAY */}
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <p className="text-lg font-semibold">Loading Asset Requests...</p>
            <div className="mt-3">
              <div className="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-2xl sm:text-3xl font-semibold mb-3">Request History</h1>

      <div className="mx-auto w-full max-w-lg sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Controls: Filter + counts */}
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-4">
          <div className="flex items-center gap-2">
            <label htmlFor="statusFilter" className="text-sm font-semibold">
              Filter by status:
            </label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-black rounded px-2 py-1 text-sm bg-white"
            >
              <option>All</option>
              <option>Pending</option>
              <option>Approved</option>
              <option>Declined</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 border border-black rounded">All: {counts.all}</span>
            <span className="px-2 py-1 border border-black rounded">Pending: {counts.pending}</span>
            <span className="px-2 py-1 border border-black rounded">Approved: {counts.approved}</span>
            <span className="px-2 py-1 border border-black rounded">Declined: {counts.declined}</span>
          </div>
        </div>

        {/* Error */}
        {!loading && error && (
          <div className="text-sm text-red-600 my-6">{error}</div>
        )}

        {/* Empty */}
        {!loading && !error && filteredList.length === 0 && (
          <div className="text-sm text-gray-500 my-6">No requests found for this status.</div>
        )}

        {/* List (paginated) */}
        {!loading &&
          !error &&
          pageItems.map((req, index) => {
            const globalIndex = startIdx + index;
            const isPending = (req.status || "").toLowerCase() === "pending";
            const isOwner = req.uid === uid;
            const isEditable = isPending && isOwner;

            return (
              <div key={req.id} className="w-full rounded overflow-hidden mb-4">
                {/* Header */}
                <div
                  className="h-10 rounded flex justify-between items-center bg-[Whitesmoke] border-2 border-[#1C1D21] min-h-[64px] px-3 cursor-pointer select-none"
                  onClick={() => setIsOpen(isOpen === globalIndex ? null : globalIndex)}
                >
                  <div className="flex items-center gap-2">
                    <StatusChip status={req.status} />
                  </div>
                  <span className="text-black font-semibold flex justify-center items-center gap-1">
                    {isOpen === globalIndex ? "Hide Details" : "View Details"}
                    <ArrowDown
                      className={`transform transition-transform duration-300 ${
                        isOpen === globalIndex ? "rotate-180" : ""
                      }`}
                    />
                  </span>
                </div>

                {/* Panel */}
                <div
                  className={`transition-all duration-500 ease-in-out overflow-hidden bg-white border rounded text-gray-800 px-4
                    ${isOpen === globalIndex ? "max-h-[1000px] py-3" : "max-h-0 py-0"}
                  `}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-md font-semibold">
                        Asset Name: {req.assetName || "—"}
                      </p>
                      <p className="text-md font-semibold">
                        Reason: {req.reason || "—"}
                      </p>
                      <p className="text-sm text-gray-600">
                        Requested: {formatDateTime(req.serverTimeStamp)}
                      </p>
                    </div>

                    {/* Thumbnail (click to full preview) */}
                    <div className="bg-[#0A1936] p-2 rounded shrink-0">
                      <img
                        src={req.imageUrl || ""}
                        alt="Asset"
                        className="h-[70px] w-[100px] object-cover rounded cursor-pointer"
                        onClick={() => openPreview(req.imageUrl)}
                      />
                    </div>
                  </div>

                  {/* Declined message */}
                  {(req.status || "").toLowerCase() === "declined" &&
                    (req.declineReason || "").trim() && (
                      <div className="mt-3">
                        <button
                          onClick={() =>
                            Swal.fire({
                              title: "Decline Reason",
                              text: req.declineReason,
                              icon: "info",
                            })
                          }
                          className="px-3 py-2 border rounded hover:bg-gray-100 transition-colors"
                        >
                          View Message
                        </button>
                      </div>
                    )}

                  {/* Remove (Approved or Declined) for Admins */}
                  {canRemove(req) && (
                    <div className="flex justify-center bg-red-600 mt-3 py-2 rounded text-white cursor-pointer hover:bg-red-700">
                      <button onClick={() => removeAsAdmin(req)}>Remove Request</button>
                    </div>
                  )}

                  {/* Edit (Pending + owner) */}
                  {isEditable && (
                    <div className="mt-3 flex justify-center">
                      <button
                        className="px-4 py-2 rounded bg-[#0A1936] text-white font-semibold hover:bg-[#122751]"
                        onClick={() => openEdit(req)}
                      >
                        Edit Request
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

        {/* Pagination */}
        {!loading && filteredList.length > 0 && (
          <div className="mt-2 flex flex-wrap justify-center items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className={`px-3 py-1 border rounded transition-colors ${
                page === 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-200"
              }`}
            >
              Previous
            </button>

            <div className="flex items-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 border rounded transition-colors ${
                    p === page ? "bg-blue-500 text-white" : "hover:bg-gray-200"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className={`px-3 py-1 border rounded transition-colors ${
                page === totalPages ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-200"
              }`}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Full-screen image preview overlay */}
      {imgPreviewUrl && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center"
          onClick={closePreview}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Escape" ? closePreview() : null)}
        >
          <img
            src={imgPreviewUrl}
            alt="Preview"
            className="max-h-[90%] max-w-[90%] rounded shadow-2xl"
          />
        </div>
      )}

      {/* ---------- EDIT MODAL (Pending + owner) ---------- */}
      {editOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeEdit} />
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-xl p-5">
            <h3 className="text-lg font-semibold mb-3">Edit Request</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold mb-1">Asset Name</label>
                <input
                  type="text"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  className="w-full border border-black rounded px-3 py-2 text-sm"
                  placeholder="Enter asset name"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Reason for Using</label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full border border-black rounded px-3 py-2 text-sm"
                  placeholder="Describe why you need this asset..."
                />
              </div>

              {/* Image picker */}
              <div>
                <label className="block text-sm font-semibold mb-1">Image</label>
                <div className="flex items-center gap-3">
                  <div className="bg-[#0A1936] p-2 rounded">
                    <img
                      src={newImageFile ? URL.createObjectURL(newImageFile) : currentImageUrl || ""}
                      alt="Preview"
                      className="h-[70px] w-[100px] object-cover rounded"
                    />
                  </div>
                  {newImageFile && (
                    <button
                      type="button"
                      onClick={() => setNewImageFile(null)}
                      className="text-sm underline"
                    >
                      Remove new image
                    </button>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => document.getElementById(fileInputId)?.click()}
                    className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
                  >
                    Upload Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => document.getElementById(cameraInputId)?.click()}
                    className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
                  >
                    Take Photo
                  </button>

                  <input
                    id={fileInputId}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setNewImageFile(f);
                    }}
                  />
                  <input
                    id={cameraInputId}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setNewImageFile(f);
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded border hover:bg-gray-50"
                onClick={closeEdit}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-[#0A1936] text-white font-semibold hover:bg-[#122751] disabled:opacity-60"
                onClick={saveEdit}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestHistory;
