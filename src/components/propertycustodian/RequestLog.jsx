import React, { useEffect, useMemo, useState } from "react";
import { Search, Download as DownloadIcon, Trash2 } from "lucide-react";
import { db } from "../../config/firebase";
import {
  collection,
  onSnapshot,
  query,
  doc,
  deleteDoc,
  getDocs,
  where,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import Swal from "sweetalert2";

// Download modal
import Download from "../admin/Download";

const RequestLog = () => {
  const [reqs, setReqs] = useState([]);
  const [statusFilter, setStatusFilter] = useState("All"); // All | Approved | Declined
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showDownload, setShowDownload] = useState(false);

  // role (passed to Download)
  const [myRole, setMyRole] = useState(localStorage.getItem("role") || "");
  useEffect(() => {
    const sync = () => setMyRole(localStorage.getItem("role") || "");
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  // uid (for Download + per-user hides)
  const uid =
    getAuth().currentUser?.uid ||
    localStorage.getItem("uid") ||
    "";

  // Per-user hide markers for asset requests
  const [hiddenSet, setHiddenSet] = useState(new Set());

  // Load my hides once
  useEffect(() => {
    const loadHides = async () => {
      try {
        if (!uid) return;
        const snap = await getDocs(
          query(collection(db, "userAssetHides"), where("uid", "==", uid))
        );
        const ids = new Set(snap.docs.map((d) => d.data().requestId));
        setHiddenSet(ids);
      } catch (e) {
        console.error("[RequestLog] load hides error:", e);
      }
    };
    loadHides();
  }, [uid]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "assetRequests")),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Only keep Approved/Declined for this view
        const approvedDeclined = rows.filter((r) => {
          const s = (r.status || "").toLowerCase();
          return s === "approved" || s === "declined";
        });

        // Hide rows that I removed (soft hide) from my log
        const visible = approvedDeclined.filter((r) => !hiddenSet.has(r.id));

        visible.sort((a, b) => {
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
        setReqs(visible);
        setLoading(false);
      },
      (err) => {
        console.error("[RequestLog] onSnapshot error:", err);
        setReqs([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [hiddenSet]);

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

  const byStatus = useMemo(() => {
    if (statusFilter === "All") return reqs;
    const wanted = statusFilter.toLowerCase();
    return reqs.filter((r) => (r.status || "").toLowerCase() === wanted);
  }, [statusFilter, reqs]);

  const filtered = useMemo(() => {
    if (!search.trim()) return byStatus;
    const q = search.toLowerCase();
    return byStatus.filter((r) =>
      (r.assetName || "").toLowerCase().includes(q) ||
      (r.reason || "").toLowerCase().includes(q)
    );
  }, [search, byStatus]);

  // Delete = remove from MY log; hard-delete only if admin already hid it
  const handleDelete = async (req) => {
    try {
      const result = await Swal.fire({
        title: "Remove from your history?",
        text: "This will remove it from your Request Log. ",
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

      // Write my hide marker
      const hideId = `${uid}_${req.id}`;
      await setDoc(doc(db, "userAssetHides", hideId), {
        uid,
        requestId: req.id,
        createdAt: serverTimestamp(),
      });

      // If admin already hid it, delete permanently
      if (req.hiddenForAdmin) {
        await deleteDoc(doc(db, "assetRequests", req.id));
      }

      Swal.close();
      await Swal.fire({
        title: req.hiddenForAdmin ? "Deleted" : "Removed",
        text: req.hiddenForAdmin
          ? "The request was deleted permanently."
          : "The request is removed from your Request Log.",
        icon: "success",
        timer: 1400,
        showConfirmButton: false,
      });

      // Update local hidden set so it disappears immediately
      setHiddenSet((prev) => {
        const next = new Set(prev);
        next.add(req.id);
        return next;
      });
    } catch (err) {
      console.error("[RequestLog] delete error:", err);
      Swal.close();
      Swal.fire("Error", "Failed to remove the request.", "error");
    }
  };

  return (
    <div>
      {/* Search Row */}
      <div className="w-full flex items-center justify-center mt-4 gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by Asset Name or Reason"
          className="flex-1 border-2 border-black rounded p-2 focus:outline-none focus:border-gray-500"
        />
        <button
          onClick={() => setSearch((s) => s)}
          className="p-2 border-2 border-black rounded hover:bg-gray-100 transition-colors"
          aria-label="Search"
        >
          <Search />
        </button>
      </div>

      {/* Filter + Download Row */}
      <div className="w-full flex justify-between items-center mt-3">
        {/* Filter dropdown */}
        <div className="flex-col items-center gap-2">
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
            <option>Approved</option>
            <option>Declined</option>
          </select>
        </div>

        {/* Download button */}
        <button
          onClick={() => setShowDownload(true)}
          className="flex justify-center items-center rounded border-2 border-black px-3 py-2 font-semibold gap-2 w-full lg:w-auto"
          title="Download printable PDF"
        >
          Download <DownloadIcon />
        </button>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <p className="text-lg font-semibold">Loading Request History...</p>
            <div className="mt-3">
              <div className="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 mt-6 overflow-y-auto pb-28">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-[#494949]">
              <tr>
                <th className="border-white border-2 p-2 text-white text-center">Asset Name</th>
                <th className="border-white border-2 p-2 text-white text-center">Reason</th>
                <th className="border-white border-2 p-2 text-white text-center">Status</th>
                <th className="border-white border-2 p-2 text-white text-center">Requested At</th>
                <th className="border-white border-2 p-2 text-white text-center">Action</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="border-white border-2 p-4 text-center text-gray-500"
                  >
                    {statusFilter !== "All" || search
                      ? "No matching requests."
                      : "No approved/declined requests yet."}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="odd:bg-[#FFE7F6] even:bg-[#C8C8C8]"
                  >
                    <td className="border-white border-2 p-2 text-center">
                      {r.assetName || "—"}
                    </td>

                    <td
                      className="border-white border-2 p-2 text-center truncate max-w-[220px]"
                      title={r.reason || ""}
                    >
                      {r.reason || "—"}
                    </td>

                    <td className="border-white border-2 p-2 text-center">
                      {r.status || "—"}
                    </td>

                    <td className="border-white border-2 p-2 text-center">
                      {formatDateTime(r.serverTimeStamp)}
                    </td>

                    <td className="border-white border-2 p-2 text-center">
                      <div className="flex justify-center items-center gap-2">
                        {(r.status || "").toLowerCase() === "declined" &&
                          (r.declineReason || "").trim() && (
                            <button
                              onClick={() =>
                                Swal.fire({
                                  title: "Decline Reason",
                                  text: r.declineReason,
                                  icon: "info",
                                })
                              }
                              className="px-3 py-2 border rounded hover:bg-gray-100 transition-colors"
                            >
                              View Message
                            </button>
                          )}

                        <button
                          onClick={() => handleDelete(r)}
                          className="flex justify-center items-center bg-red-500 px-3 py-2 rounded text-white font-semibold gap-1 hover:bg-red-600 transition-colors"
                          title="Remove from my history (or delete if admin also removed)"
                        >
                          <Trash2 /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

        </div>
      </div>

      {/* Download modal */}
      <Download
        open={showDownload}
        onClose={() => setShowDownload(false)}
        context="requests"
        role={myRole}
        uid={uid}
      />
    </div>
  );
};

export default RequestLog;
