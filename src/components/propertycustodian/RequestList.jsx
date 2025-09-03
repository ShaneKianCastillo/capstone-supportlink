// src/components/custodian/RequestList.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { db } from "../../config/firebase";
import {
  collection,
  onSnapshot,
  query,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import Swal from "sweetalert2";

const RequestList = () => {
  const [requests, setRequests] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [loadingReqs, setLoadingReqs] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [acting, setActing] = useState(false);

  const [showImageFull, setShowImageFull] = useState(false);
  const imgTimerRef = useRef(null);
  const holdToOpen = () => { imgTimerRef.current = setTimeout(() => setShowImageFull(true), 500); };
  const releaseHold = () => clearTimeout(imgTimerRef.current);

  const myUid  = localStorage.getItem("uid")  || "";
  const myRole = localStorage.getItem("role") || "";

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "users")),
      (snap) => {
        const map = {};
        snap.forEach((d) => (map[d.id] = { id: d.id, ...d.data() }));
        setUsersById(map);
        setLoadingUsers(false);
      },
      () => {
        setUsersById({});
        setLoadingUsers(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "assetRequests")),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => {
          const ta =
            a.approvedAt?.toMillis?.() ??
            a.declinedAt?.toMillis?.() ??
            a.serverTimeStamp?.toMillis?.() ??
            0;
        const tb =
            b.approvedAt?.toMillis?.() ??
            b.declinedAt?.toMillis?.() ??
            b.serverTimeStamp?.toMillis?.() ??
            0;
          return tb - ta;
        });
        setRequests(rows);
        setLoadingReqs(false);
      },
      () => {
        setRequests([]);
        setLoadingReqs(false);
      }
    );
    return () => unsub();
  }, []);

  const loading = loadingReqs || loadingUsers;

  const formatDateTime = (ts) => {
    try {
      const d =
        ts && typeof ts.toDate === "function" ? ts.toDate() :
        ts instanceof Date ? ts : null;
      if (!d) return "—";
      return d.toLocaleString(undefined, {
        year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return "—"; }
  };

  const combined = useMemo(() => {
    return requests.map((r) => {
      const u = usersById[r.uid] || {};
      return {
        ...r,
        userName: u.name || "—",
        userDept: u.department || "—",
        userRole: u.role || "—",
      };
    });
  }, [requests, usersById]);

  // 🟡 Only show PENDING in this page
  const pendingOnly = useMemo(
    () => combined.filter((r) => (r.status || "Pending").toLowerCase() === "pending"),
    [combined]
  );

  const openModal = (req) => { setSelected(req); setOpen(true); setShowImageFull(false); };
  const closeModal = () => { setOpen(false); setSelected(null); setShowImageFull(false); };

  const handleApprove = async (req) => {
    if (!req?.id || acting) return;
    const confirmRes = await Swal.fire({
      title: "Approve Request",
      text: "Are you sure you want to approve this asset request?",
      icon: "question", showCancelButton: true,
      confirmButtonText: "Yes, approve", cancelButtonText: "Cancel",
    });
    if (!confirmRes.isConfirmed) return;

    try {
      setActing(true);
      Swal.fire({ title: "Approving...", allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });

      await updateDoc(doc(db, "assetRequests", req.id), {
        status: "Approved",
        approvedAt: serverTimestamp(),
        processedBy: myUid || null,
        processedRole: myRole || null,
        declineReason: null,
        declinedAt: null,
      });

      Swal.close();
      await Swal.fire({ title: "Approved", text: "The asset request has been approved.", icon: "success", timer: 1200, showConfirmButton: false });
      closeModal();
    } catch (err) {
      Swal.close();
      Swal.fire("Error", "Failed to approve the request.", "error");
    } finally { setActing(false); }
  };

  const handleReject = async (req) => {
    if (!req?.id || acting) return;
    const result = await Swal.fire({
      title: "Decline Request",
      input: "textarea",
      inputLabel: "Reason for declining",
      inputPlaceholder: "Type your reason here...",
      inputAttributes: { "aria-label": "Reason" },
      inputValidator: (v) => (!v?.trim() ? "Please enter a reason for declining." : undefined),
      showCancelButton: true, confirmButtonText: "Submit", cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;

    try {
      setActing(true);
      Swal.fire({ title: "Declining...", allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });

      await updateDoc(doc(db, "assetRequests", req.id), {
        status: "Declined",
        declinedAt: serverTimestamp(),
        declineReason: result.value.trim(),
        processedBy: myUid || null,
        processedRole: myRole || null,
        approvedAt: null,
      });

      Swal.close();
      await Swal.fire({ title: "Declined", text: "The asset request has been declined.", icon: "success", timer: 1200, showConfirmButton: false });
      closeModal();
    } catch (err) {
      Swal.close();
      Swal.fire("Error", "Failed to decline the request.", "error");
    } finally { setActing(false); }
  };

  return (
    <div className="pb-6">
      <h1 className="text-2xl sm:text-3xl font-semibold">Request List</h1>

      {loading && (
        <div className="mt-6 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <p className="font-semibold">Loading requests...</p>
            <div className="mt-3 animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
          </div>
        </div>
      )}

      {!loading && pendingOnly.length === 0 && (
        <div className="mt-6 text-gray-600">No pending asset requests.</div>
      )}

      {!loading && pendingOnly.length > 0 && (
        <div className="mt-6 space-y-3">
          {pendingOnly.map((r) => (
            <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0A1936] text-white px-4 py-3 rounded">
              <p className="text-sm sm:text-base">
                <span className="font-semibold">{r.userName}</span> — {r.userDept} — {formatDateTime(r.serverTimeStamp)}
              </p>

              <div className="flex items-center gap-4">
                <button onClick={() => openModal(r)} className="font-semibold underline underline-offset-4">
                  View Request
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && selected && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pt-10">
          <div onClick={closeModal} className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-2xl shadow-lg w-full max-w-lg p-6 transform transition-all duration-300 -translate-y-10 animate-slide-in" style={{ animation: "slideIn 0.3s ease-out forwards" }}>
            <button onClick={closeModal} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"><X size={20} /></button>
            <h2 className="text-xl font-bold mb-4">Request Details</h2>

            <div className="text-sm text-gray-600 mb-4">
              <span className="font-semibold">{selected.userName}</span> • {selected.userDept} • {formatDateTime(selected.serverTimeStamp)}
            </div>

            {selected.imageUrl && (
              <div className="mb-4 rounded overflow-hidden border">
                <img
                  src={selected.imageUrl}
                  alt="Asset"
                  className="w-full h-56 object-cover select-none cursor-pointer"
                  onMouseDown={holdToOpen}
                  onMouseUp={releaseHold}
                  onMouseLeave={releaseHold}
                  onTouchStart={holdToOpen}
                  onTouchEnd={releaseHold}
                />
              </div>
            )}

            <div className="space-y-2 text-sm">
              <div><span className="font-semibold">Asset Name:</span> {selected.assetName || "—"}</div>
              <div><span className="font-semibold">Reason for Using:</span> {selected.reason || "—"}</div>
              <div><span className="font-semibold">Status:</span> {selected.status || "Pending"}</div>
            </div>

            <div className="pt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={() => handleApprove(selected)} disabled={acting} className="bg-green-600 hover:bg-green-700 text-white p-2 rounded disabled:opacity-60 disabled:cursor-not-allowed">
                {acting ? "Working..." : "Approve"}
              </button>
              <button onClick={() => handleReject(selected)} disabled={acting} className="bg-red-600 hover:bg-red-700 text-white p-2 rounded disabled:opacity-60 disabled:cursor-not-allowed">
                {acting ? "Working..." : "Decline"}
              </button>
            </div>
          </div>

          <style>{`
            @keyframes slideIn {
              from { opacity: 0; transform: translateY(-50px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {showImageFull && selected?.imageUrl && (
            <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[60]" onClick={() => setShowImageFull(false)}>
              <img src={selected.imageUrl} alt="Full Preview" className="max-h-[90%] max-w-[90%] rounded" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RequestList;
