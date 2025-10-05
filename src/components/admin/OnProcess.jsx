import React, { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { db } from "../../config/firebase";
import {
  collection,
  onSnapshot,
  query,
  doc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import axios from "axios";

const OnProcess = () => {
  const [reports, setReports] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // who am I?
  const [myRole, setMyRole] = useState(localStorage.getItem("role") || "");
  const myUid = (localStorage.getItem("uid") || "").trim();
  useEffect(() => {
    const sync = () => setMyRole(localStorage.getItem("role") || "");
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  // view modal
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  // resolution modal
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolutionImage, setResolutionImage] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  // image hold-to-zoom
  const [showImageFull, setShowImageFull] = useState(false);
  const imgTimerRef = useRef(null);
  const holdToOpen = () => {
    imgTimerRef.current = setTimeout(() => setShowImageFull(true), 500);
  };
  const releaseHold = () => {
    clearTimeout(imgTimerRef.current);
  };

  // role → allowed service types
  const allowedTypesForRole = (role) => {
    switch (role) {
      case "CSD Admin":
      case "CSD Asst. Admin":
        return ["Facilities and Maintenance"];
      case "MIS Admin":
      case "MIS Asst. Admin":
        return ["IT Support Services - Software"];
      case "IT Support Specialist":
        return ["IT Support Services - Hardware"];
      case "Admin":
        return [
          "Facilities and Maintenance",
          "IT Support Services - Hardware",
          "IT Support Services - Software",
        ];
      default:
        return [];
    }
  };
  const allowedTypes = allowedTypesForRole(myRole);

  // users map
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "users")),
      (snap) => {
        const map = {};
        snap.forEach((d) => (map[d.id] = { id: d.id, ...d.data() }));
        setUsersById(map);
        setLoadingUsers(false);
      },
      (err) => {
        console.error("[OnProcess] users onSnapshot error:", err);
        setUsersById({});
        setLoadingUsers(false);
      }
    );
    return () => unsub();
  }, []);

  // onProcess list
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "onProcess")),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => {
          // primary: processedAt desc, fallback: serverTimeStamp desc
          const pa = a.processedAt?.toMillis?.() ?? 0;
          const pb = b.processedAt?.toMillis?.() ?? 0;
          if (pb !== pa) return pb - pa;
          const ta = a.serverTimeStamp?.toMillis?.() ?? 0;
          const tb = b.serverTimeStamp?.toMillis?.() ?? 0;
          return tb - ta;
        });
        setReports(rows);
        setLoadingReports(false);
      },
      (err) => {
        console.error("[OnProcess] list onSnapshot error:", err);
        setReports([]);
        setLoadingReports(false);
      }
    );
    return () => unsub();
  }, []);

  const loading = loadingReports || loadingUsers;

  const toDate = (ts) =>
    ts && typeof ts.toDate === "function"
      ? ts.toDate()
      : ts instanceof Date
        ? ts
        : null;

  const formatDateTime = (ts) => {
    try {
      const d = toDate(ts);
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

  const combined = useMemo(() => {
    return reports.map((r) => {
      const u = usersById[r.uid] || {};
      return {
        ...r,
        userName: u.name || "—",
        userDept: u.department || "—",
        userRole: u.role || "—",
      };
    });
  }, [reports, usersById]);

  // role-scoped
  const scoped = useMemo(() => {
    if (!allowedTypes.length) return [];
    return combined.filter((r) => allowedTypes.includes(r.serviceType || ""));
  }, [combined, allowedTypes]);

  // -------- Filters (same pattern as SentReports) --------
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState("newest");

  const resetFilters = () => {
    setQ("");
    setFrom("");
    setTo("");
    setSort("newest");
  };

  const filtered = useMemo(() => {
    let rows = [...scoped];

    if (from) {
      const fromDate = new Date(from);
      rows = rows.filter((r) => {
        const d = toDate(r.processedAt) || toDate(r.serverTimeStamp);
        return d ? d >= fromDate : false;
      });
    }
    if (to) {
      const toEdge = new Date(to);
      toEdge.setDate(toEdge.getDate() + 1); // include whole day
      rows = rows.filter((r) => {
        const d = toDate(r.processedAt) || toDate(r.serverTimeStamp);
        return d ? d < toEdge : false;
      });
    }

    if (q.trim()) {
      const needle = q.toLowerCase();
      rows = rows.filter((r) => {
        const fields = [
          r.userName,
          r.userDept,
          r.additionalDetails,
          r.platformName,
          r.systemName,
          r.platform,
          r.buildingName,
          r.floorLocation,
          r.serviceType,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return fields.includes(needle);
      });
    }

    rows.sort((a, b) => {
      if (sort === "oldest") {
        const ta =
          a.processedAt?.toMillis?.() ??
          a.serverTimeStamp?.toMillis?.() ??
          0;
        const tb =
          b.processedAt?.toMillis?.() ??
          b.serverTimeStamp?.toMillis?.() ??
          0;
        return ta - tb;
      }
      if (sort === "nameAsc" || sort === "nameDesc") {
        const na = (a.userName || "").toLowerCase();
        const nb = (b.userName || "").toLowerCase();
        const cmp = na.localeCompare(nb);
        return sort === "nameAsc" ? cmp : -cmp;
      }
      const ta =
        a.processedAt?.toMillis?.() ??
        a.serverTimeStamp?.toMillis?.() ??
        0;
      const tb =
        b.processedAt?.toMillis?.() ??
        b.serverTimeStamp?.toMillis?.() ??
        0;
      return tb - ta;
    });

    return rows;
  }, [scoped, q, from, to, sort]);

  const totalCount = scoped.length;
  const filteredCount = filtered.length;

  const hasFilters = useMemo(() => {
    return Boolean(q.trim() || from || to);
  }, [q, from, to]);

  const openModal = (report) => {
    setSelected(report);
    setOpen(true);
    setShowImageFull(false);
  };

  // -------- Resolution flow ----------
  const handleOpenResolve = () => {
    setResolutionImage(null);
    setResolutionNotes("");
    setResolveOpen(true);
  };

  const handleUploadResolution = async () => {
    if (!resolutionImage) return null;
    const formData = new FormData();
    formData.append("file", resolutionImage);
    formData.append("upload_preset", "supportlink");

    try {
      const res = await axios.post(
        "https://api.cloudinary.com/v1_1/dsycysb0e/image/upload",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return res.data.secure_url;
    } catch (err) {
      console.error("Resolution image upload error:", err);
      return null;
    }
  };

  const handleResolve = async () => {
    if (!selected?.id || resolving) return;

    // who resolved (staff/admin)
    const me = usersById[myUid] || {};
    const resolvedByName = me.name || "—";
    const resolvedByDept = me.department || "—";

    // who should approve (the original reporter)
    const reporter = usersById[selected.uid] || {};
    const reporterName = reporter.name || "User";
    const reporterUid = selected.uid || null;

    setResolving(true);
    try {
      const resolvedImageUrl = await handleUploadResolution();

      const batch = writeBatch(db);
      const fromRef = doc(db, "onProcess", selected.id);
      const toRef = doc(db, "resolvedReports", selected.id);

      const { id, ...rest } = selected;

      batch.set(
        toRef,
        {
          ...rest,
          sourceReportId: id,

          // Existing resolution fields
          status: "Resolved",
          resolvedAt: serverTimestamp(),
          resolutionNotes: (resolutionNotes || "").trim(),
          resolvedImageUrl: resolvedImageUrl || null,
          resolvedByUid: myUid || null,
          resolvedByName,
          resolvedByDept,

          // NEW: user approval flow
          userApprovalStatus: "pending",         // 'pending' | 'approved' | 'declined'
          userApprovalPendingForUid: reporterUid,
          userApprovalPendingForName: reporterName,
          userApprovalAt: null,                  // will be set when user approves/declines
          userApprovalNotes: null,               // optional; used on decline
        },
        { merge: true }
      );

      batch.delete(fromRef);
      await batch.commit();

      setResolveOpen(false);
      setOpen(false);
      setSelected(null);
      setResolutionImage(null);
      setResolutionNotes("");
    } catch (err) {
      console.error("[OnProcess] handleResolve error:", err);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="pb-6">
      {/* Header + counts */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-semibold">On Process Report List</h1>
        <div className="text-sm text-gray-600">
          Showing <span className="font-semibold">{filteredCount}</span> of{" "}
          <span className="font-semibold">{totalCount}</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="mt-4 bg-white rounded-xl border-2 border-[#1C1D21] shadow-sm p-3 sm:p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, department, details…"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          {/* From */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full border rounded px-2 py-2 text-sm"
            />
          </div>

          {/* To */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full border rounded px-2 py-2 text-sm"
            />
          </div>

          {/* Sort */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Sort</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-full border rounded px-2 py-2 text-sm bg-white"
            >
              <option value="newest">Newest → Oldest</option>
              <option value="oldest">Oldest → Newest</option>
              <option value="nameAsc">Reporter A → Z</option>
              <option value="nameDesc">Reporter Z → A</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={resetFilters}
            className="px-3 py-2 text-sm rounded border hover:bg-gray-50"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="mt-6 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <p className="font-semibold">Loading reports...</p>
            <div className="mt-3 animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
          </div>
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="mt-6 text-gray-600 text-center">
          {scoped.length === 0
            ? "No reports are currently in process."
            : hasFilters
              ? "No reports in process matched your filters."
              : "No reports are currently in process."}
        </div>
      )}

      {/* List */}
      {!loading && filtered.length > 0 && (
        <div className="mt-6 space-y-3">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="flex flex-col sm:flex-row items-center sm:items-center justify-between gap-3 bg-[whitesmoke] border-2 border-[#1C1D21] text-white px-4 py-4 min-h-[64px] rounded"
            >

              <p className="text-sm sm:text-base text-black">
                <span className="font-semibold">{r.userName}</span> — {r.userDept} —{" "}
                {formatDateTime(r.processedAt || r.serverTimeStamp)}
              </p>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => openModal(r)}
                  className="font-semibold underline underline-offset-4 text-black"
                >
                  View Report
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Modal */}
      {open && selected && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pt-10">
          {/* Backdrop */}
          <div onClick={() => setOpen(false)} className="absolute inset-0 bg-black/50" />

          {/* Panel */}
          <div
            className="relative bg-white rounded-2xl shadow-lg w-full max-w-lg p-6 transform transition-all duration-300 -translate-y-10 animate-slide-in"
            style={{ animation: "slideIn 0.3s ease-out forwards" }}
          >
            {/* Close */}
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold mb-4">Report Details</h2>

            <div className="text-sm text-gray-600 mb-4">
              <span className="font-semibold">{selected.userName}</span> •{" "}
              {selected.userDept} •{" "}
              {formatDateTime(selected.processedAt || selected.serverTimeStamp)}
            </div>

            {selected.imageUrl && (
              <div className="mb-4 rounded overflow-hidden border">
                <img
                  src={selected.imageUrl}
                  alt="Report"
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
              <div>
                <span className="font-semibold">Building Name:</span>{" "}
                {selected.buildingName || "—"}
              </div>
              <div>
                <span className="font-semibold">Floor Location:</span>{" "}
                {selected.floorLocation || "—"}
              </div>
              <div>
                <span className="font-semibold">Service Type:</span>{" "}
                {selected.serviceType || "—"}
              </div>
              <div>
                <span className="font-semibold">Platform / System Name:</span>{" "}
                {selected.platformName ||
                  selected.systemName ||
                  selected.platform ||
                  "—"}
              </div>
              <div>
                <span className="font-semibold">Other Details:</span>{" "}
                {selected.additionalDetails || "—"}
              </div>
            </div>

            <div className="pt-5">
              <button
                onClick={() => setResolveOpen(true)}
                className="bg-[#F2B611] text-white p-2 w-full rounded hover:bg-yellow-400"
              >
                Mark as Resolved
              </button>
            </div>
          </div>

          {/* Slide animation */}
          <style>{`
            @keyframes slideIn {
              from { opacity: 0; transform: translateY(-50px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {/* Full image overlay */}
          {showImageFull && selected?.imageUrl && (
            <div
              className="fixed inset-0 bg-black/80 flex justify-center items-center z-[60]"
              onClick={() => setShowImageFull(false)}
            >
              <img
                src={selected.imageUrl}
                alt="Full Preview"
                className="max-h-[90%] max-w-[90%] rounded"
              />
            </div>
          )}
        </div>
      )}

      {/* Resolution Modal */}
      {resolveOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] pt-10">
          {/* Backdrop */}
          <div onClick={() => setResolveOpen(false)} className="absolute inset-0 bg-black/50" />
          {/* Panel */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <button
              onClick={() => setResolveOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              aria-label="Close"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-bold">Resolution Details</h3>
            <p className="text-xs text-gray-500 mb-4">
              Attach an image (optional) and describe how the issue was resolved.
            </p>

            {/* Upload / Take Photo */}
            <div className="w-full">
              <div className="bg-gray-200 h-40 w-full flex items-center justify-center rounded mb-2 overflow-hidden relative">
                {resolutionImage ? (
                  <div className="h-full w-full relative">
                    <img
                      src={URL.createObjectURL(resolutionImage)}
                      alt="Resolution Preview"
                      className="h-full w-full object-cover rounded"
                    />
                    <button
                      type="button"
                      onClick={() => setResolutionImage(null)}
                      className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 text-xs rounded shadow"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2 items-center justify-center">
                    <label className="cursor-pointer px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 text-sm font-semibold text-gray-700">
                      Upload Photo
                      <input
                        onChange={(e) => setResolutionImage(e.target.files[0])}
                        type="file"
                        accept="image/*"
                        className="hidden"
                      />
                    </label>

                    <label className="cursor-pointer px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 text-sm font-semibold text-gray-700">
                      Take Photo
                      <input
                        onChange={(e) => setResolutionImage(e.target.files[0])}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="mt-3">
              <label className="block text-sm font-semibold mb-1">Resolution Summary</label>
              <textarea
                rows={4}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="w-full border border-black rounded px-3 py-2 text-sm bg-gray-50"
                placeholder="Explain the process of resolving the issue..."
              />
            </div>

            {/* Submit */}
            <div className="pt-4">
              <button
                onClick={async () => {
                  await handleResolve();
                }}
                disabled={resolving}
                className="bg-[#0A1936] text-white px-4 py-2 rounded w-full disabled:opacity-60"
              >
                {resolving ? "Saving..." : "Save & Mark as Resolved"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnProcess;
