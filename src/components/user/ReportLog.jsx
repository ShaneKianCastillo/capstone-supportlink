import React, { useState, useEffect, useMemo } from 'react';
import { ArrowDown } from 'lucide-react';
import { db } from '../../config/firebase';
import {
  collection, getDocs, query, where, deleteDoc, doc
} from 'firebase/firestore';
import Swal from 'sweetalert2';

const ReportLog = () => {
  const [isOpen, setIsOpen] = useState(null);
  const [reportList, setReportList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // NEW: status filter
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Pending' | 'On Process' | 'Resolved'

  const userReportRef      = collection(db, 'userReport');
  const onProcessRef       = collection(db, 'onProcess');
  const resolvedReportsRef = collection(db, 'resolvedReports');

  useEffect(() => {
    const MIN_SPINNER_MS = 500;
    const start = Date.now();

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const uid = (localStorage.getItem('uid') || '').trim();
        if (!uid) {
          setReportList([]);
          const elapsed = Date.now() - start;
          setTimeout(() => setLoading(false), Math.max(0, MIN_SPINNER_MS - elapsed));
          return;
        }

        // fetch from all three collections
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

        // merge and sort by resolvedAt -> processedAt -> serverTimeStamp
        const merged = [...rowsUserReport, ...rowsOnProcess, ...rowsResolved];
        merged.sort((a, b) => {
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
          return tb - ta; // newest first
        });

        setReportList(merged);
      } catch (err) {
        console.error('[ReportLog] fetch error:', err);
        setError('Failed to load reports.');
      } finally {
        const elapsed = Date.now() - start;
        setTimeout(() => setLoading(false), Math.max(0, MIN_SPINNER_MS - elapsed));
      }
    };

    load();
  }, []);

  const deleteReport = async (report) => {
    try {
      const result = await Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!',
      });
      if (!result.isConfirmed) return;

      Swal.fire({
        title: 'Deleting...',
        text: 'Please wait while we delete the report.',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });

      const colName = report._collection || 'userReport';
      await deleteDoc(doc(db, colName, report.id));

      Swal.close();
      await Swal.fire({
        title: 'Deleted!',
        text: 'Your file has been deleted.',
        icon: 'success',
        timer: 1200,
        showConfirmButton: false,
      });

      setReportList(prev => prev.filter(r => !(r.id === report.id && r._collection === colName)));
    } catch (error) {
      console.error('Error deleting report:', error);
      Swal.close();
      Swal.fire({
        title: 'Error!',
        text: 'Failed to delete the report.',
        icon: 'error',
      });
    }
  };

  // Colored status chip
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

  // NEW: compute counts & filtered list
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
        {!loading && !error && filteredList.map((report, index) => (
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
                ${isOpen === index ? 'max-h-[1000px] py-3' : 'max-h-0 py-0'}
              `}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-md font-semibold">Building Name: {report.buildingName}</p>
                  <p className="text-md font-semibold">Floor Location: {report.floorLocation}</p>
                  <p className="text-md font-semibold">Service Type: {report.serviceType}</p>
                </div>

                {/* Thumbnail */}
                <div className="bg-[#0A1936] p-2 rounded shrink-0">
                  <img
                    src={report.imageUrl || ''}
                    alt="Report"
                    className="h-[70px] w-[100px] object-cover rounded"
                  />
                </div>
              </div>

              <div className="flex justify-center bg-red-600 mt-3 py-2 rounded text-white cursor-pointer hover:bg-red-700">
                <button onClick={() => deleteReport(report)}>Remove Report</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportLog;
