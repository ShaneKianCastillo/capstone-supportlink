import React, { useEffect, useMemo, useState } from "react";
import { ArrowDown } from "lucide-react";
import { db } from "../../config/firebase";
import {
  collection,
  onSnapshot,
  doc,
  deleteDoc,
  query,
} from "firebase/firestore";
import Swal from "sweetalert2";

const RequestHistory = () => {
  const [isOpen, setIsOpen] = useState(null);
  const [reqList, setReqList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  // Status filter: same UX as ReportLog
  const [statusFilter, setStatusFilter] = useState("All"); 
  // Possible statuses now: Pending (default), On Process (future), Approved/Declined (future)

  useEffect(() => {
    setLoading(true);
    setError(null);

    const q = query(collection(db, "assetRequests"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // sort by resolved/processed/serverTimeStamp (if those arrive later)
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
        console.error("[RequestHistory] onSnapshot error:", err);
        setError("Failed to load asset requests.");
        setReqList([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

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

  // Counters
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
    return {
      pending,
      onproc,
      approved,
      declined,
      all: reqList.length,
    };
  }, [reqList]);

  // Filtered list by status
  const filteredList = useMemo(() => {
    if (statusFilter === "All") return reqList;
    const wanted = statusFilter.toLowerCase();
    return reqList.filter((r) => (r.status || "").toLowerCase() === wanted);
  }, [statusFilter, reqList]);

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
                {/* If declined with a message, show "View Message" */}
                {(req.status || "").toLowerCase() === "declined" && (req.declineReason || "").trim() && (
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

                {/* Delete (admin history page) */}
                <div className="flex justify-center bg-red-600 mt-3 py-2 rounded text-white cursor-pointer hover:bg-red-700">
                  <button onClick={() => deleteRequest(req)}>Remove Request</button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default RequestHistory;
