import React, { useState, useEffect, useMemo } from 'react';
import { ArrowDown } from 'lucide-react';
import { db } from '../../config/firebase';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  serverTimestamp,
  deleteDoc,
  updateDoc,           // 👈 NEW
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

  const userReportRef = collection(db, 'userReport');
  const onProcessRef = collection(db, 'onProcess');
  const resolvedReportsRef = collection(db, 'resolvedReports');

  const uid = (localStorage.getItem('uid') || '').trim();

  // image preview modal (for both original & resolution thumbnails)
  const [imgPreviewUrl, setImgPreviewUrl] = useState(null);
  const openPreview = (url) => url && setImgPreviewUrl(url);
  const closePreview = () => setImgPreviewUrl(null);

  // ---------- EDIT MODAL STATE ----------
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editReport, setEditReport] = useState(null); // original pending report being edited

  // form fields
  const SERVICE_TYPES = [
    'Facilities and Maintenance',
    'IT Support Services - Hardware',
    'IT Support Services - Software',
  ];
  const [svcType, setSvcType] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [floorLocation, setFloorLocation] = useState('');
  const [platformName, setPlatformName] = useState('');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [currentImageUrl, setCurrentImageUrl] = useState(''); // existing image in DB
  const [newImageFile, setNewImageFile] = useState(null);     // newly chosen file (if any)

  // hidden file inputs for upload/take
  const fileInputId = 'edit-file-upload';
  const cameraInputId = 'edit-file-camera';

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
          getDocs(query(onProcessRef, where('uid', '==', uid))),
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
        ts && typeof ts.toDate === 'function' ? ts.toDate()
          : ts instanceof Date ? ts
            : null;
      if (!d) return '—';
      return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  const StatusChip = ({ status, approval }) => {
    const s = (status || '').toLowerCase();              // 'pending' | 'on process' | 'resolved'
    const a = (approval || 'pending').toLowerCase();     // 'pending' | 'approved' | 'declined'

    if (s === 'resolved') {
      if (a === 'approved')
        return <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">Resolved (Approved)</span>;
      if (a === 'declined')
        return <span className="bg-red-600 text-white text-xs px-2 py-1 rounded">Not Resolved</span>;
      // pending
      return <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded">Resolved (Pending Your Approval)</span>;
    }

    if (s === 'on process')
      return <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded">On Process</span>;

    if (s === 'pending')
      return <span className="bg-gray-500 text-white text-xs px-2 py-1 rounded">Pending</span>;

    return <span className="bg-slate-500 text-white text-xs px-2 py-1 rounded">{status || '—'}</span>;
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

  // ---------- EDIT HANDLERS ----------
  const openEdit = (report) => {
    setEditReport(report);
    setSvcType(report.serviceType || '');
    setBuildingName(report.buildingName || '');
    setFloorLocation(report.floorLocation || '');
    setPlatformName(report.platformName || report.systemName || report.platform || '');
    setAdditionalDetails(report.additionalDetails || '');
    setCurrentImageUrl(report.imageUrl || '');
    setNewImageFile(null);
    setEditOpen(true);
  };

  const closeEdit = () => {
    if (saving) return;
    setEditOpen(false);
    setEditReport(null);
    setNewImageFile(null);
  };

  const validateEdit = () => {
    if (!svcType) return 'Please choose a service type.';
    const type = svcType;
    const isSW = type === 'IT Support Services - Software';
    const hasImg = !!(newImageFile || currentImageUrl);

    if (!hasImg) return 'Please attach an image.';

    if (isSW) {
      if (!platformName.trim()) return 'Please enter the Platform / System Name.';
    } else {
      if (!buildingName.trim()) return 'Please enter the Building Name.';
      if (!floorLocation.trim()) return 'Please enter the Floor / Room Location.';
    }
    return null;
  };

  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'supportlink'); // same preset you used
    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/dsycysb0e/image/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data?.secure_url) return data.secure_url;
      throw new Error('Upload failed');
    } catch (e) {
      console.error('Upload error:', e);
      return null;
    }
  };

  const saveEdit = async () => {
    if (!editReport?.id) return;
    const err = validateEdit();
    if (err) {
      await Swal.fire('Missing info', err, 'info');
      return;
    }

    try {
      setSaving(true);
      Swal.fire({
        title: 'Saving...',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });

      // image: use new if provided
      let finalImageUrl = currentImageUrl;
      if (newImageFile) {
        const uploaded = await uploadToCloudinary(newImageFile);
        if (!uploaded) {
          Swal.close();
          await Swal.fire('Upload failed', 'Could not upload the image. Try again.', 'error');
          setSaving(false);
          return;
        }
        finalImageUrl = uploaded;
      }

      const isSW = svcType === 'IT Support Services - Software';

      const updatePayload = {
        serviceType: svcType,
        additionalDetails: additionalDetails || '',
        imageUrl: finalImageUrl || '',
        lastEditedAt: serverTimestamp(),
      };

      if (isSW) {
        updatePayload.platformName = platformName || '';
        // clear FM/HW fields
        updatePayload.buildingName = null;
        updatePayload.floorLocation = null;
      } else {
        updatePayload.buildingName = buildingName || '';
        updatePayload.floorLocation = floorLocation || '';
        // clear SW field
        updatePayload.platformName = null;
      }

      // Only editable if it's still in 'userReport'
      await updateDoc(doc(db, 'userReport', editReport.id), updatePayload);

      Swal.close();
      await Swal.fire({
        title: 'Updated',
        text: 'Your report has been updated.',
        icon: 'success',
        timer: 1200,
        showConfirmButton: false,
      });

      closeEdit();

      // Refresh list in-place (optional: re-fetch; here we mutate local)
      setAllReports(prev =>
        prev.map(r =>
          r._collection === 'userReport' && r.id === editReport.id
            ? { ...r, ...updatePayload }
            : r
        )
      );
    } catch (e) {
      console.error('[ReportLog] saveEdit error:', e);
      Swal.close();
      Swal.fire('Error', 'Failed to update the report.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ---- USER APPROVAL ACTIONS (Resolved items) ----
  const approveResolution = async (report) => {
    try {
      if (uid !== report.uid) {
        await Swal.fire('Not allowed', 'Only the original reporter can approve.', 'info');
        return;
      }
      if ((report.userApprovalStatus || 'pending') === 'approved') {
        await Swal.fire('Already approved', 'This resolution is already approved.', 'info');
        return;
      }

      const ok = await Swal.fire({
        title: 'Confirm Approval',
        text: 'Confirm that the issue is resolved.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Approve',
      });
      if (!ok.isConfirmed) return;

      await updateDoc(doc(db, 'resolvedReports', report.id), {
        userApprovalStatus: 'approved',
        userApprovalAt: serverTimestamp(),
        userApprovalByUid: uid,
        userApprovalNotes: null,
      });

      await Swal.fire('Approved', 'Thanks for confirming the fix.', 'success');

      // Optimistic UI update
      setAllReports(prev =>
        prev.map(r =>
          r._collection === 'resolvedReports' && r.id === report.id
            ? { ...r, userApprovalStatus: 'approved' }
            : r
        )
      );
    } catch (e) {
      console.error('approveResolution error:', e);
      await Swal.fire('Error', 'Could not approve the resolution.', 'error');
    }
  };

  const declineResolution = async (report) => {
    try {
      if (uid !== report.uid) {
        await Swal.fire('Not allowed', 'Only the original reporter can decline.', 'info');
        return;
      }
      if ((report.userApprovalStatus || 'pending') === 'declined') {
        await Swal.fire('Already declined', 'This resolution is already declined.', 'info');
        return;
      }

      const { value: reason, isConfirmed } = await Swal.fire({
        title: 'Decline Resolution',
        input: 'textarea',
        inputLabel: 'Tell us what is still wrong',
        inputPlaceholder: 'Optional notes...',
        inputAttributes: { 'aria-label': 'Decline reason' },
        showCancelButton: true,
        confirmButtonText: 'Decline',
      });
      if (!isConfirmed) return;

      await updateDoc(doc(db, 'resolvedReports', report.id), {
        userApprovalStatus: 'declined',
        userApprovalAt: serverTimestamp(),
        userApprovalByUid: uid,
        userApprovalNotes: (reason || '').trim() || null,
      });

      await Swal.fire('Noted', 'We marked this as not resolved. A staff member will review.', 'success');

      // Optimistic UI update
      setAllReports(prev =>
        prev.map(r =>
          r._collection === 'resolvedReports' && r.id === report.id
            ? { ...r, userApprovalStatus: 'declined', userApprovalNotes: (reason || '').trim() || null }
            : r
        )
      );
    } catch (e) {
      console.error('declineResolution error:', e);
      await Swal.fire('Error', 'Could not decline the resolution.', 'error');
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
      <div className="mx-auto w-full max-w-lg sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl-max-w-4xl px-4 sm:px-6 lg:px-8 py-6 ">

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
          const isPending = (report.status || '').toLowerCase() === 'pending';
          const isEditable = isPending && report._collection === 'userReport'; // only pending in userReport can be edited

          return (
            <div key={`${report._collection}:${report.id}`} className="w-full rounded overflow-hidden mb-4">
              {/* Header */}
              <div
                className="h-[50px] rounded flex justify-between items-center bg-[#1C1D21] px-3 cursor-pointer select-none"
                onClick={() => setIsOpen(isOpen === index ? null : index)}
              >
                {/* Left: Status chip */}
                {/* Left: Status chip */}
                <div className="flex items-center gap-2">
                  <StatusChip status={report.status} approval={report.userApprovalStatus} />
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
                  ${isOpen === index ? 'max-h-[2200px] py-3' : 'max-h-0 py-0'}
                `}
              >
                {/* Top meta fields */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-md font-semibold">Building Name: {report.buildingName || '—'}</p>
                    <p className="text-md font-semibold">Floor Location: {report.floorLocation || '—'}</p>
                    <p className="text-md font-semibold">Service Type: {report.serviceType || '—'}</p>
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
                  </>
                )}

                {/* Edit button for Pending */}
                {isEditable && (
                  <div className="mt-4 flex justify-center">
                    <button
                      className="px-4 py-2 rounded bg-[#0A1936] text-white font-semibold hover:bg-[#122751]"
                      onClick={() => openEdit(report)}
                    >
                      Edit Report
                    </button>
                  </div>
                )}

                {/* Approval controls for the reporter when Resolved + pending */}
                {(report.status || '').toLowerCase() === 'resolved' &&
                  uid === report.uid &&
                  (report.userApprovalStatus || 'pending') === 'pending' && (
                    <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
                      <button
                        className="px-4 py-2 rounded bg-green-600 text-white font-semibold hover:bg-green-700"
                        onClick={() => approveResolution(report)}
                      >
                        Approve — Issue Resolved
                      </button>
                      <button
                        className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700"
                        onClick={() => declineResolution(report)}
                      >
                        Decline — Not Resolved
                      </button>
                    </div>
                  )}

                {/* Remove button ONLY for Resolved */}
                {(report.status || '').toLowerCase() === 'resolved' && (
                  <div className="flex justify-center bg-red-600 mt-4 py-2 rounded text-white cursor-pointer hover:bg-red-700">
                    <button onClick={() => removeFromMyLog(report)}>
                      Remove from My Log
                    </button>
                  </div>
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

      {/* ---------- EDIT MODAL ---------- */}
      {editOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeEdit} />
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-xl p-5">
            <h3 className="text-lg font-semibold mb-3">Edit Report</h3>

            {/* Service type */}
            <div className="mb-3">
              <label className="block text-sm font-semibold mb-1">Service Type</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {SERVICE_TYPES.map((t) => (
                  <label
                    key={t}
                    className={`border rounded px-3 py-2 text-sm cursor-pointer ${svcType === t ? 'border-[#0A1936] ring-1 ring-[#0A1936]' : 'border-gray-300'
                      }`}
                  >
                    <input
                      type="radio"
                      name="svcType"
                      className="mr-2"
                      checked={svcType === t}
                      onChange={() => setSvcType(t)}
                    />
                    {t}
                  </label>
                ))}
              </div>
            </div>

            {/* Conditional fields */}
            {svcType === 'IT Support Services - Software' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Platform / System Name</label>
                  <input
                    type="text"
                    value={platformName}
                    onChange={(e) => setPlatformName(e.target.value)}
                    className="w-full border border-black rounded px-3 py-2 text-sm"
                    placeholder="e.g., LMS, Library System"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Building Name</label>
                  <input
                    type="text"
                    value={buildingName}
                    onChange={(e) => setBuildingName(e.target.value)}
                    className="w-full border border-black rounded px-3 py-2 text-sm"
                    placeholder="Enter building name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Floor / Room Location</label>
                  <input
                    type="text"
                    value={floorLocation}
                    onChange={(e) => setFloorLocation(e.target.value)}
                    className="w-full border border-black rounded px-3 py-2 text-sm"
                    placeholder="Enter floor/room"
                  />
                </div>
              </div>
            )}

            {/* Image picker */}
            <div className="mt-3">
              <label className="block text-sm font-semibold mb-1">Image</label>

              {/* current or new preview (small) */}
              <div className="flex items-center gap-3">
                <div className="bg-[#0A1936] p-2 rounded">
                  <img
                    src={newImageFile ? URL.createObjectURL(newImageFile) : (currentImageUrl || '')}
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

            {/* Other details */}
            <div className="mt-3">
              <label className="block text-sm font-semibold mb-1">Other Details</label>
              <textarea
                rows={3}
                value={additionalDetails}
                onChange={(e) => setAdditionalDetails(e.target.value)}
                className="w-full border border-black rounded px-3 py-2 text-sm"
                placeholder="Describe the issue..."
              />
            </div>

            {/* Actions */}
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
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportLog;
