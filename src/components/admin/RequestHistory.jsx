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
} from "firebase/firestore";
import Swal from "sweetalert2";

const RequestHistory = () => {
  const [isOpen, setIsOpen] = useState(null);
  const [reqList, setReqList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  // filter
  const [statusFilter, setStatusFilter] = useState("All");

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

  // we’ll derive allowed UIDs for the query
  const [allowedUids, setAllowedUids] = useState([uid]); // default to self
  const [uidsReady, setUidsReady] = useState(false);

  // Phase 1: compute allowed UID set based on role pairing
  useEffect(() => {
    const group = roleGroupFor(myRole);
    if (!group) {
      // only self
      setAllowedUids([uid]);
      setUidsReady(true);
      return;
    }

    // subscribe to users with roles in the group; collect their IDs
    const usersRef = collection(db, "users");
    const unsub = onSnapshot(
      query(usersRef, where("role", "in", group)),
      (snap) => {
        const ids = new Set();
        snap.forEach((d) => ids.add(d.id));
        if (!ids.size && uid) ids.add(uid); // fallback to self
        setAllowedUids(Array.from(ids));
        setUidsReady(true);
      },
      (err) => {
        console.error("[RequestHistory] users group load error:", err);
        // fallback to self only
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

    // Build query: if we have multiple uids, use 'in', else '=='
    let qRef;
    const baseRef = collection(db, "assetRequests");

    if (!allowedUids?.length) {
      // nothing to show
      setReqList([]);
      setLoading(false);
      return;
    }

    if (allowedUids.length === 1) {
      qRef = query(baseRef, where("uid", "==", allowedUids[0]));
    } else {
      // Firestore 'in' supports up to 10 values — our groups are 2, so fine.
      qRef = query(baseRef, where("uid", "in", allowedUids));
    }

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => {
          const ta =
            a.resolvedAt?.toMillis?.() ??
            a.processedAt?.toMillis?.() ??
            a.serverTimeStamp?.toMillis?.() ??
            0;
          const tb =
            b.resolvedAt?.toMillis?.() ??
            b.processedAt?.toMillis?.() ??
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

  const deleteRequest = async (req) => {
    try {
      const result = await Swal.fire({
        title: "Are you sure?",
        text: "This will permanently delete the asset request.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Delete",
      });
      if (!result.isConfirmed) return;

      Swal.fire({
        title: "Deleting...",
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });

      await deleteDoc(doc(db, "assetRequests", req.id));

      Swal.close();
      await Swal.fire({
        title: "Deleted!",
        text: "The asset request has been removed.",
        icon: "success",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("[RequestHistory] delete error:", error);
      Swal.close();
      Swal.fire("Error!", "Failed to delete the request.", "error");
    }
  };

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

  // ---------- EDIT (Pending + must be the owner) ----------
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editReq, setEditReq] = useState(null);

  const [assetName, setAssetName] = useState("");
  const [reason, setReason] = useState("");
  const [currentImageUrl, setCurrentImageUrl] = useState("");
  const [newImageFile, setNewImageFile] = useState(null);

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

  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "supportlink");
    try {
      const res = await fetch(
        "https://api.cloudinary.com/v1_1/dsycysb0e/image/upload",
        { method: "POST", body: formData }
      );
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

    if (!assetName.trim() || !reason.trim()) {
      await Swal.fire("Missing info", "Asset name and reason are required.", "info");
      return;
    }
    const hasImage = !!(newImageFile || currentImageUrl);
    if (!hasImage) {
      await Swal.fire("Missing image", "Please attach an image.", "info");
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

      await updateDoc(doc(db, "assetRequests", editReq.id), {
        assetName,
        reason,
        imageUrl: finalImageUrl || "",
        // we could add lastEditedAt here if you want
      });

      Swal.close();
      await Swal.fire({
        title: "Updated",
        text: "Your asset request has been updated.",
        icon: "success",
        timer: 1200,
        showConfirmButton: false,
      });

      // update UI locally
      setReqList((prev) =>
        prev.map((r) =>
          r.id === editReq.id ? { ...r, assetName, reason, imageUrl: finalImageUrl } : r
        )
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

  const canRemove = (req) => {
    const isApproved = (req.status || "").toLowerCase() === "approved";
    const isAdmin = myRole === "MIS Admin" || myRole === "CSD Admin";
    return isApproved && isAdmin;
  };

  const canEdit = (req) => {
    const isPending = (req.status || "").toLowerCase() === "pending";
    const isOwner = req.uid === uid;
    return isPending && isOwner;
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

        {/* List */}
        {!loading &&
          !error &&
          filteredList.map((req, index) => (
            <div key={req.id} className="w-full rounded overflow-hidden mb-4">
              {/* Header */}
              <div
                className="h-10 rounded flex justify-between items-center bg-[#0A1936] px-3 cursor-pointer select-none"
                onClick={() => setIsOpen(isOpen === index ? null : index)}
              >
                <div className="flex items-center gap-2">
                  <StatusChip status={req.status} />
                </div>
                <span className="text-white flex justify-center items-center gap-1">
                  {isOpen === index ? "Hide Details" : "View Details"}
                  <ArrowDown
                    className={`transform transition-transform duration-300 ${
                      isOpen === index ? "rotate-180" : ""
                    }`}
                  />
                </span>
              </div>

              {/* Panel */}
              <div
                className={`transition-all duration-500 ease-in-out overflow-hidden bg-white border rounded text-gray-800 px-4
                  ${isOpen === index ? "max-h-[1000px] py-3" : "max-h-0 py-0"}
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

                  {/* Thumbnail */}
                  <div className="bg-[#0A1936] p-2 rounded shrink-0">
                    <img
                      src={req.imageUrl || ""}
                      alt="Asset"
                      className="h-[70px] w-[100px] object-cover rounded"
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

                {/* Edit (Pending + owner only) */}
                {canEdit(req) && (
                  <div className="mt-3">
                    <button
                      onClick={() => openEdit(req)}
                      className="px-4 py-2 rounded bg-[#0A1936] text-white font-semibold hover:bg-[#122751]"
                    >
                      Edit Request
                    </button>
                  </div>
                )}

                {/* Remove (Approved + only MIS Admin / CSD Admin) */}
                {canRemove(req) && (
                  <div className="flex justify-center bg-red-600 mt-3 py-2 rounded text-white cursor-pointer hover:bg-red-700">
                    <button onClick={() => deleteRequest(req)}>Remove Request</button>
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>

      {/* EDIT MODAL */}
      {editOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeEdit} />
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-xl p-5">
            <h3 className="text-lg font-semibold mb-3">Edit Asset Request</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold mb-1">Asset Name</label>
                <input
                  type="text"
                  className="w-full border border-black rounded px-3 py-2 text-sm"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Reason</label>
                <textarea
                  rows={3}
                  className="w-full border border-black rounded px-3 py-2 text-sm"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              {/* Image */}
              <div>
                <label className="block text-sm font-semibold mb-1">Image</label>
                <div className="flex items-center gap-3">
                  <div className="bg-[#0A1936] p-2 rounded">
                    <img
                      src={newImageFile ? URL.createObjectURL(newImageFile) : (currentImageUrl || "")}
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
                    onClick={() => document.getElementById("asset-file-input")?.click()}
                    className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
                  >
                    Upload Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => document.getElementById("asset-camera-input")?.click()}
                    className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
                  >
                    Take Photo
                  </button>

                  <input
                    id="asset-file-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setNewImageFile(f);
                    }}
                  />
                  <input
                    id="asset-camera-input"
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
