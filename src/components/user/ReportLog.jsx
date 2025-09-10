import React, { useState, useEffect, useMemo } from 'react';
import { ArrowDown } from 'lucide-react';
import { db } from '../../config/firebase';
import {
  collection, getDocs, query, where, doc, setDoc, serverTimestamp, deleteDoc
} from 'firebase/firestore';
import Swal from 'sweetalert2';

const ReportLog = () => {
  const [isOpen, setIsOpen] = useState(null);
  const [allReports, setAllReports] = useState([]); // merged raw list
  const [hiddenSet, setHiddenSet] = useState(new Set()); // reportIds hidden by this user (resolved only)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // status filter: 'All' | 'Pending' | 'On Process' | 'Resolved'
  const [statusFilter, setStatusFilter] = useState('All');

  const userReportRef      = collection(db, 'userReport');
  const onProcessRef       = collection(db, 'onProcess');
  const resolvedReportsRef = collection(db, 'resolvedReports');

  const uid = (localStorage.getItem('uid') || '').trim();

  // image preview modal (for both original & resolution thumbnails)
  const [imgPreviewUrl, setImgPreviewUrl] = useState(null);
  const openPreview = (url) => url && setImgPreviewUrl(url);
  const closePreview = () => setImgPreviewUrl(null);

  // Load per-user hidden resolved IDs
  useEffect(() => {
    const loadHides = async () => {
      try {
        if (!uid) return;
        const snap = await getDocs(
          query(collection(db, 'userResolvedHides'), where('uid', '==', uid))
        );
        const ids = new Set(snap.docs.map(d => d.data().reportId));
        setHiddenSet(ids);
      } catch (e) {
        console.error('[ReportLog] load hides error:', e);
      }
    };
    loadHides();
  }, [uid]);

  // Load reports from all three collections (for this user)
  useEffect(() => {
    const MIN_SPINNER_MS = 500;
    const start = Date.now();

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!uid) {
          setAllReports([]);
          const elapsed = Date.now() - start;
          setTimeout(() => setLoading(false), Math.max(0, MIN_SPINNER_MS - elapsed));
          return;
        }

        const [snapUserReport, snapOnProcess, snapResolved] = await Promise.all([
          getDocs(query(userReportRef, where('uid', '==', uid))),
          getDocs(query(onProcessRef,  where('uid', '==', uid))),
          getDocs(query(resolvedReportsRef, where('uid', '==', uid))),
        ]);

        const rowsUserReport = snapUserReport.docs.map(d => ({
          id: d.id,
          ...d.data(),
          _collection: 'userReport', // Pending
        }));
        const rowsOnProcess = snapOnProcess.docs.map(d => ({
          id: d.id,
          ...d.data(),
          _collection: 'onProcess', // On Process
        }));
        const rowsResolved = snapResolved.docs.map(d => ({
          id: d.id,
          ...d.data(),
          _collection: 'resolvedReports', // Resolved
        }));

        const merged = [...rowsUserReport, ...rowsOnProcess, ...rowsResolved];
        merged.sort((a, b) => {
          const ta =
            a.resolvedAt?.toMillis?.() ??
            a.processedAt?.toMillis?.() ??
            a.serverTimeStamp?.toMillis?.() ?? 0;
          const tb =
            b.resolvedAt?.toMillis?.() ??
            b.processedAt?.toMillis?.() ??
            b.serverTimeStamp?.toMillis?.() ?? 0;
          return tb - ta; // newest first
        });

        setAllReports(merged);
      } catch (err) {
        console.error('[ReportLog] fetch error:', err);
        setError('Failed to load reports.');
      } finally {
        const elapsed = Date.now() - start;
        setTimeout(() => setLoading(false), Math.max(0, MIN_SPINNER_MS - elapsed));
      }
    };

    load();
  }, [uid]);

  // Visible list = hide resolved items this user chose to hide
  const reportList = useMemo(() => {
    if (!hiddenSet.size) return allReports;
    return allReports.filter(r => {
      const status = (r.status || '').toLowerCase();
      if (status !== 'resolved') return true;
      return !hiddenSet.has(r.id);
    });
  }, [allReports, hiddenSet]);

  const formatDateTime = (ts) => {
    try {
      const d =
        ts && typeof ts.toDate === "function" ? ts.toDate()
          : ts instanceof Date ? ts
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
    const s = (status || '').toLowerCase();
    const bg =
      s === 'resolved'   ? 'bg-green-600'  :
      s === 'on process' ? 'bg-yellow-500' :
      s === 'pending'    ? 'bg-gray-500'   :
                           'bg-slate-500';
    return (
      <span className={`${bg} text-white text-xs px-2 py-1 rounded`}>
        {status || '—'}
      </span>
    );
  };

  // Counts (visible items only)
  const counts = useMemo(() => {
    let pending = 0, onproc = 0, resolved = 0;
    for (const r of reportList) {
      const s = (r.status || '').toLowerCase();
      if (s === 'pending') pending++;
      else if (s === 'on process') onproc++;
      else if (s === 'resolved') resolved++;
    }
    return { pending, onproc, resolved, all: reportList.length };
  }, [reportList]);

  const filteredList = useMemo(() => {
    if (statusFilter === 'All') return reportList;
    const wanted = statusFilter.toLowerCase();
    return reportList.filter(r => (r.status || '').toLowerCase() === wanted);
  }, [statusFilter, reportList]);

  // Hide a resolved report for THIS user only
  const removeFromMyLog = async (report) => {
    const isResolved = (report.status || '').toLowerCase() === 'resolved';
    if (!isResolved) {
      await Swal.fire({
        title: 'Not allowed',
        text: 'You can only remove items that are already Resolved.',
        icon: 'info',
      });
      return;
    }

    try {
      const result = await Swal.fire({
        title: 'Remove from your log?',
        text: 'This action will remove this report from your Report Log.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Remove',
        cancelButtonText: 'Cancel',
      });
      if (!result.isConfirmed) return;

      Swal.fire({
        title: 'Applying...',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });

      const hideId = `${uid}_${report.id}`;
      const hideRef = doc(db, 'userResolvedHides', hideId);

      // Always write the user hide marker
      await setDoc(hideRef, {
        uid,
        reportId: report.id,
        createdAt: serverTimestamp(),
      });

      // If admin already hid it, now both removed -> HARD DELETE
      if (report.hiddenForAdmin) {
        await deleteDoc(doc(db, 'resolvedReports', report.id));
        // Optional cleanup: remove your hide marker too
        // await deleteDoc(hideRef);
      }

      Swal.close();
      await Swal.fire({
        title: report.hiddenForAdmin ? 'Deleted' : 'Removed',
        text: 'The report is successfully removed from your Report Log.',
        icon: 'success',
        timer: 1400,
        showConfirmButton: false,
      });

      // Update local UI immediately
      setHiddenSet(prev => {
        const next = new Set(prev);
        next.add(report.id);
        return next;
      });
    } catch (error) {
      console.error('Error hiding/deleting report:', error);
      Swal.close();
      Swal.fire({
        title: 'Error!',
        text: 'Failed to remove the report from your log.',
        icon: 'error',
      });
    }
  };

  return (
    <div className="w-full">
      {/* LOADING OVERLAY */}
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <p className="text-lg font-semibold">Loading Reports...</p>
            <div className="mt-3">
              <div className="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            </div>
          </div>
        </div>
      )}

      {/* Outer container */}
      <div className="mx-auto w-full max-w-lg sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl-max-w-4xl px-4 sm:px-6 lg:px-8 py-6">

        {/* Controls: Filter + counts */}
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-4">
          <div className="flex items-center gap-2">
            <label htmlFor="statusFilter" className="text-sm font-semibold">Filter by status:</label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-black rounded px-2 py-1 text-sm"
            >
              <option>All</option>
              <option>Pending</option>
              <option>On Process</option>
              <option>Resolved</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 border border-black rounded">All: {counts.all}</span>
            <span className="px-2 py-1 border border-black rounded">Pending: {counts.pending}</span>
            <span className="px-2 py-1 border border-black rounded">On Process: {counts.onproc}</span>
            <span className="px-2 py-1 border border-black rounded">Resolved: {counts.resolved}</span>
          </div>
        </div>

        {/* Error */}
        {!loading && error && (
          <div className="text-sm text-red-600 my-6">{error}</div>
        )}

        {/* Empty */}
        {!loading && !error && filteredList.length === 0 && (
          <div className="text-sm text-gray-500 my-6">No reports found for this status.</div>
        )}

        {/* List */}
        {!loading && !error && filteredList.map((report, index) => {
          const isResolved = (report.status || '').toLowerCase() === 'resolved';
          return (
            <div key={`${report._collection}:${report.id}`} className="w-full rounded overflow-hidden mb-4">
              {/* Header */}
              <div
                className="h-10 rounded flex justify-between items-center bg-[#0A1936] px-3 cursor-pointer select-none"
                onClick={() => setIsOpen(isOpen === index ? null : index)}
              >
                {/* Left: Status chip */}
                <div className="flex items-center gap-2">
                  <StatusChip status={report.status} />
                </div>

                {/* Right: text + chevron */}
                <span className="text-white flex justify-center items-center gap-1">
                  {isOpen === index ? 'Hide Details' : 'View Details'}
                  <ArrowDown
                    className={`transform transition-transform duration-300 ${isOpen === index ? 'rotate-180' : ''}`}
                  />
                </span>
              </div>

              {/* Collapsible Panel */}
              <div
                className={`transition-all duration-500 ease-in-out overflow-hidden bg-white border rounded text-gray-800 px-4
                  ${isOpen === index ? 'max-h-[2000px] py-3' : 'max-h-0 py-0'}
                `}
              >
                {/* Top meta fields */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-md font-semibold">Building Name: {report.buildingName || '—'}</p>
                    <p className="text-md font-semibold">Floor Location: {report.floorLocation || '—'}</p>
                    <p className="text-md font-semibold">Service Tpe: {report.serviceType || '—'}</p>
                    <p className="text-md font-semibold">
                      Platform / System Name: {report.platformName || report.systemName || report.platform || '—'}
                    </p>
                  </div>

                  {/* Right: original thumbnail (click to preview) */}
                  <div className="bg-[#0A1936] p-2 rounded shrink-0">
                    <img
                      src={report.imageUrl || ''}
                      alt="Report"
                      className="h-[70px] w-[100px] object-cover rounded cursor-pointer"
                      onClick={() => openPreview(report.imageUrl)}
                    />
                  </div>
                </div>

                {/* Report Details (always) */}
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-gray-600 tracking-wide">Report Details</h4>
                  <div className="mt-2 text-sm">
                    <span className="font-semibold">Other Details: </span>
                    {report.additionalDetails || '—'}
                  </div>
                  {/* ⬇️ No big original image here anymore */}
                </div>

                {/* Resolution section (only when resolved) */}
                {isResolved && (
                  <>
                    <hr className="my-5 border-gray-200" />

                    {/* Resolution header + small thumbnail on the right */}
                    <div className="flex items-start justify-between gap-4">
                      {/* Minimalist header line */}
                      <div className="text-xs sm:text-sm text-gray-700 flex flex-wrap items-center gap-x-2">
                        <span className="font-semibold">{report.resolvedByName || '—'}</span>
                        <span className="text-gray-400">•</span>
                        <span>{report.resolvedByDept || '—'}</span>
                        <span className="text-gray-400">•</span>
                        <span>{formatDateTime(report.resolvedAt)}</span>
                      </div>

                      {/* Resolution thumbnail (same style as original) */}
                      <div className="bg-[#0A1936] p-2 rounded shrink-0">
                        {report.resolvedImageUrl ? (
                          <img
                            src={report.resolvedImageUrl}
                            alt="Resolution"
                            className="h-[70px] w-[100px] object-cover rounded cursor-pointer"
                            onClick={() => openPreview(report.resolvedImageUrl)}
                          />
                        ) : (
                          <div className="h-[70px] w-[100px] rounded bg-[#0A1936] flex items-center justify-center text-[10px] text-white/70">
                            No image
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Resolution notes */}
                    <div className="mt-3 text-sm">
                      <span className="font-semibold">Resolution Summary: </span>
                      {report.resolutionNotes || '—'}
                    </div>

                    {/* Remove button ONLY for Resolved */}
                    <div className="flex justify-center bg-red-600 mt-4 py-2 rounded text-white cursor-pointer hover:bg-red-700">
                      <button onClick={() => removeFromMyLog(report)}>
                        Remove from My Log
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Full-screen image preview */}
      {imgPreviewUrl && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center"
          onClick={closePreview}
        >
          <img
            src={imgPreviewUrl}
            alt="Preview"
            className="max-h-[90%] max-w-[90%] rounded shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};

export default ReportLog;
