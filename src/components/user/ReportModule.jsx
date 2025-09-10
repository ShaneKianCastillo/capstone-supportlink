import React, { useRef, useState } from 'react';
import { db } from '../../config/firebase';
import { collection, serverTimestamp, addDoc } from 'firebase/firestore';
import { incompleteForm, reportSubmitted } from '../../js/login.js';
import axios from 'axios';
import ChatBot from './ChatBot';
import { BotMessageSquare, X, Info, ChevronLeft } from 'lucide-react';
import dctLogo from '../../assets/dctLogo.png';

const SERVICE = {
  FM: 'Facilities and Maintenance',
  IT_SW: 'IT Support Services - Software',
  IT_HW: 'IT Support Services - Hardware',
};

const ReportModule = () => {
  const reportCollectionRef = collection(db, 'userReport');

  const [loading, setLoading] = useState(false);

  // Shared states
  const [serviceType, setServiceType] = useState(''); // chosen from panels

  // Facilities/Hardware states
  const [buildingName, setBuildingName] = useState('');
  const [floorLocation, setFloorLocation] = useState('');

  // Software states
  const [platformName, setPlatformName] = useState(''); // e.g., LMS / SIS / school portal

  // Common
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [image, setImage] = useState(null);

  // Preview modal
  const [showFullImage, setShowFullImage] = useState(false);
  const timerRef = useRef(null);

  // Chat panel state
  const [openChat, setOpenChat] = useState(false);

  // Help modal
  const [showHelp, setShowHelp] = useState(false);

  const resetAllFields = () => {
    setBuildingName('');
    setFloorLocation('');
    setPlatformName('');
    setAdditionalDetails('');
    setImage(null);
    setShowFullImage(false);
  };

  const handleChooseService = (type) => {
    setServiceType(type);
    resetAllFields();
  };

  const handleBackToChooser = () => {
    setServiceType('');
    resetAllFields();
  };

  const onSubmitReport = async (e) => {
    e.preventDefault();
    const uid = localStorage.getItem('uid'); // or auth.currentUser?.uid

    // Validate based on service type
    if (!serviceType || !image || !uid || !additionalDetails) {
      incompleteForm();
      return;
    }
    if (serviceType === SERVICE.IT_SW) {
      if (!platformName) {
        incompleteForm();
        return;
      }
    } else {
      // Facilities/Hardware
      if (!buildingName || !floorLocation) {
        incompleteForm();
        return;
      }
    }

    try {
      setLoading(true);
      const img = await handleUpload();
      if (!img) {
        incompleteForm();
        return;
      }

      const payload =
        serviceType === SERVICE.IT_SW
          ? {
            serverTimeStamp: serverTimestamp(),
            serviceType,
            platformName,
            additionalDetails,
            imageUrl: img,
            uid,
            status: 'Pending',
          }
          : {
            serverTimeStamp: serverTimestamp(),
            serviceType,
            buildingName,
            floorLocation,
            additionalDetails,
            imageUrl: img,
            uid,
            status: 'Pending',
          };

      await addDoc(reportCollectionRef, payload);

      // reset
      resetAllFields();
      reportSubmitted();
    } catch (err) {
      console.error('Error submitting report: ', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!image) return null;
    const formData = new FormData();
    formData.append('file', image);
    formData.append('upload_preset', 'supportlink');

    try {
      const res = await axios.post(
        'https://api.cloudinary.com/v1_1/dsycysb0e/image/upload',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return res.data.secure_url;
    } catch (err) {
      console.error('Upload error:', err);
      return null;
    }
  };

  // Hold-to-preview logic
  const handleMouseDown = () => {
    timerRef.current = setTimeout(() => setShowFullImage(true), 500);
  };
  const handleMouseUp = () => {
    clearTimeout(timerRef.current);
  };

  // Remove image
  const handleRemoveImage = () => {
    setImage(null);
    setShowFullImage(false);
  };

  // --- UI Helpers ---
  const ServiceCard = ({ title, desc, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full h-full text-left border border-gray-500 rounded-2xl p-5 bg-white overflow-hidden hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0A1936]"
    >
      {/* Background logo */}
      <img
        src={dctLogo}
        alt="Background logo"
        className="absolute inset-0 w-full h-full object-contain opacity-90 pointer-events-none"
      />

      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-white/70"></div>

      {/* Foreground content */}
      <div className="relative">
        <div className="text-base sm:text-lg font-semibold">{title}</div>
        <p className="mt-2 text-sm text-gray-700">{desc}</p>
      </div>
    </button>
  );

  return (
    <div className="w-full relative">
      {/* Top bar with Help button */}
      <div className="mx-auto w-full max-w-lg sm:max-w-xl lg:max-w-3xl px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex items-center justify-between">
          {serviceType ? (
            <button
              type="button"
              onClick={handleBackToChooser}
              className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              <ChevronLeft size={16} />
              Change service type
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="inline-flex items-center gap-2 text-sm font-semibold bg-white border rounded-lg px-3 py-2 hover:bg-gray-50"
            aria-label="Know about service types"
            title="Know about service types"
          >
            <Info size={16} />
            Know about service types
          </button>
        </div>
      </div>

      {/* Service Type Chooser */}
      {!serviceType && (
        <div className="mx-auto w-full max-w-lg sm:max-w-xl lg:max-w-3xl px-4 sm:px-6 lg:px-8 pb-2">
          <h2 className="mt-4 mb-3 text-sm font-semibold text-gray-700">
            Choose a service type for your report:
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="h-full">
              <ServiceCard
                title={SERVICE.FM}
                desc="Repairs, cleanliness, lighting, aircon, plumbing, room fixtures, etc."
                onClick={() => handleChooseService(SERVICE.FM)}
              />
            </div>
            <div className="h-full">
              <ServiceCard
                title={SERVICE.IT_SW}
                desc="Issues with school web apps/portals, DCT Schoology, logins, errors."
                onClick={() => handleChooseService(SERVICE.IT_SW)}
              />
            </div>
            <div className="h-full">
              <ServiceCard
                title={SERVICE.IT_HW}
                desc="PCs, printers, projectors, network ports, cables, keyboards, peripherals."
                onClick={() => handleChooseService(SERVICE.IT_HW)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Forms (conditional) */}
      {serviceType && (
        <form
          onSubmit={onSubmitReport}
          className="mx-auto w-full max-w-lg sm:max-w-xl lg:max-w-3xl px-4 sm:px-6 lg:px-8 py-6 space-y-5"
        >
          {/* Heading */}
          <div className="rounded-xl bg-gray-50 border px-4 py-3">
            <div className="text-xs text-gray-500">Selected service type</div>
            <div className="font-semibold">{serviceType}</div>
          </div>

          {/* FIELDS */}
          {serviceType === SERVICE.IT_SW ? (
            <>
              {/* PLATFORM / SYSTEM NAME */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  PLATFORM / SYSTEM NAME<span className="text-red-500">*</span>
                </label>
                <input
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  type="text"
                  placeholder="e.g., LMS (Moodle), Student Portal, DCT Schoology"
                  className="w-full border border-black rounded px-3 py-2 text-sm"
                />
              </div>

              
              {/* UPLOAD IMAGE */}
              <div className="w-full">
                <div className="bg-gray-200 h-40 sm:h-48 lg:h-56 w-full flex items-center justify-center rounded mb-1 overflow-hidden relative">
                  {image ? (
                    <div
                      className="h-full w-full cursor-pointer"
                      onMouseDown={handleMouseDown}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      onTouchStart={handleMouseDown}
                      onTouchEnd={handleMouseUp}
                    >
                      <img
                        src={URL.createObjectURL(image)}
                        alt="Uploaded Preview"
                        className="h-full w-full object-cover rounded"
                      />

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 text-xs rounded shadow"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 items-center justify-center">
                      {/* Upload from files */}
                      <label className="flex flex-col items-center justify-center cursor-pointer px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 text-sm font-semibold text-gray-700">
                        Upload Photo
                        <input
                          onChange={(e) => setImage(e.target.files[0])}
                          type="file"
                          accept="image/*"
                          className="hidden"
                        />
                      </label>

                      {/* Take photo with camera */}
                      <label className="flex flex-col items-center justify-center cursor-pointer px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 text-sm font-semibold text-gray-700">
                        Take Photo
                        <input
                          onChange={(e) => setImage(e.target.files[0])}
                          type="file"
                          accept="image/*"
                          capture="environment" // 👈 forces camera on mobile (rear camera)
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>


              {/* FULL IMAGE MODAL */}
              {showFullImage && image && (
                <div
                  className="fixed inset-0 bg-black/80 flex justify-center items-center z-50"
                  onClick={() => setShowFullImage(false)}
                >
                  <img
                    src={URL.createObjectURL(image)}
                    alt="Full Preview"
                    className="max-h-[90%] max-w-[90%] rounded"
                  />
                </div>
              )}

              {/* OTHER DETAILS */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">OTHER DETAILS</label>
                <textarea
                  value={additionalDetails}
                  onChange={(e) => setAdditionalDetails(e.target.value)}
                  rows="3"
                  className="w-full border border-black rounded px-3 py-2 text-sm bg-gray-100"
                  placeholder="Describe the error, steps before it happened, and any error codes…"
                ></textarea>
              </div>
            </>
          ) : (
            <>
              {/* BUILDING NAME */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  BUILDING NAME<span className="text-red-500">*</span>
                </label>
                <input
                  value={buildingName}
                  onChange={(e) => setBuildingName(e.target.value)}
                  type="text"
                  placeholder="Enter building name"
                  className="w-full border border-black rounded px-3 py-2 text-sm"
                />
              </div>

              {/* FLOOR LOCATION */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  FLOOR / ROOM LOCATION<span className="text-red-500">*</span>
                </label>
                <input
                  value={floorLocation}
                  onChange={(e) => setFloorLocation(e.target.value)}
                  type="text"
                  placeholder="e.g., 3rd Floor, Room 305"
                  className="w-full border border-black rounded px-3 py-2 text-sm"
                />
              </div>

              {/* UPLOAD IMAGE */}
              <div className="w-full">
                <div className="bg-gray-200 h-40 sm:h-48 lg:h-56 w-full flex items-center justify-center rounded mb-1 overflow-hidden relative">
                  {image ? (
                    <div
                      className="h-full w-full cursor-pointer"
                      onMouseDown={handleMouseDown}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      onTouchStart={handleMouseDown}
                      onTouchEnd={handleMouseUp}
                    >
                      <img
                        src={URL.createObjectURL(image)}
                        alt="Uploaded Preview"
                        className="h-full w-full object-cover rounded"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 text-xs rounded shadow"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center cursor-pointer h-full w-full">
                      <span className="text-sm font-semibold text-gray-700">
                        UPLOAD IMAGE
                      </span>
                      <input
                        onChange={(e) => setImage(e.target.files[0])}
                        type="file"
                        accept="image/*"
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* FULL IMAGE MODAL */}
              {showFullImage && image && (
                <div
                  className="fixed inset-0 bg-black/80 flex justify-center items-center z-50"
                  onClick={() => setShowFullImage(false)}
                >
                  <img
                    src={URL.createObjectURL(image)}
                    alt="Full Preview"
                    className="max-h-[90%] max-w-[90%] rounded"
                  />
                </div>
              )}

              {/* OTHER DETAILS */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">OTHER DETAILS</label>
                <textarea
                  value={additionalDetails}
                  onChange={(e) => setAdditionalDetails(e.target.value)}
                  rows="3"
                  className="w-full border border-black rounded px-3 py-2 text-sm bg-gray-100"
                  placeholder={`Describe the issue (e.g., for ${serviceType === SERVICE.FM ? 'lighting/aircon/leak' : 'PC/peripherals/projector/network'
                    })…`}
                ></textarea>
              </div>
            </>
          )}

          {/* SUBMIT BUTTON */}
          <div className="w-full flex">
            <button
              type="submit"
              className="w-full md:w-2/3 lg:w-1/2 mx-auto bg-[#0A1936] text-white font-semibold py-3 rounded"
            >
              SUBMIT
            </button>
          </div>
        </form>
      )}

      {/* HELP MODAL (animated) */}
      {showHelp && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center"
          aria-modal="true"
          role="dialog"
          onClick={() => setShowHelp(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"></div>

          {/* Sheet / Dialog */}
          <div
            className="relative w-full sm:w-[620px] mx-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 translate-y-0 sm:translate-y-0 animate-[slideIn_.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base sm:text-lg font-semibold">Service type guide</h3>
              <button
                className="p-1 rounded hover:bg-gray-100"
                onClick={() => setShowHelp(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-sm text-gray-700">
              <div>
                <div className="font-semibold">{SERVICE.FM}</div>
                <ul className="list-disc pl-5 text-gray-600">
                  <li>Building concerns: cleanliness, leaks, lights, air-conditioning, plumbing.</li>
                  <li>Rooms/fixtures: doors, windows, chairs, whiteboards, signage.</li>
                  <li>Provide building and floor/room location and a photo.</li>
                </ul>
              </div>

              <div>
                <div className="font-semibold">{SERVICE.IT_SW}</div>
                <ul className="list-disc pl-5 text-gray-600">
                  <li>School platforms/portals (e.g., LMS, SIS, registrar/grades, library site).</li>
                  <li>Account logins, page errors, slow pages, submission failures.</li>
                  <li>Provide the platform/system name, a screenshot, and steps to reproduce.</li>
                </ul>
              </div>

              <div>
                <div className="font-semibold">{SERVICE.IT_HW}</div>
                <ul className="list-disc pl-5 text-gray-600">
                  <li>Devices and peripherals: PCs, printers, projectors, keyboards, network ports.</li>
                  <li>Cables, connectivity, “no display,” paper jams, power issues.</li>
                  <li>Provide building and floor/room location and a photo.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* keyframes (scoped via tailwind arbitrary not available) – use utility animation name */}
          <style>{`
            @keyframes slideIn {
              from { transform: translateY(16px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* LOADING OVERLAY */}
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-[85]">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <p className="text-lg font-semibold">Submitting Report...</p>
            <div className="mt-3">
              <div className="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Chat Button */}
      {!openChat && (
        <button
          type="button"
          onClick={() => setOpenChat(true)}
          className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-[70] shadow-lg rounded-full p-4 bg-pink-600 hover:bg-pink-700 text-white"
          aria-label="Open ChatBot"
        >
          <BotMessageSquare size={24} />
        </button>
      )}

      {/* Floating Chat Panel */}
      {openChat && (
        <div
          className="
            fixed z-[75] bottom-4 right-4 sm:bottom-6 sm:right-6
            w-[95vw] max-w-[980px]
            h-[72vh] sm:h-[76vh]
            bg-white rounded-2xl shadow-2xl overflow-hidden border
            flex flex-col
          "
          role="dialog"
          aria-label="IT Self-Help Assistant"
        >
          {/* Panel header */}
          <div className="h-12 bg-[#0A1936] text-white px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 rounded-full bg-pink-600 items-center justify-center">
                <BotMessageSquare size={16} />
              </span>
              <span className="font-medium text-sm sm:text-base">IT Self-Help Assistant</span>
            </div>
            <button
              onClick={() => setOpenChat(false)}
              className="p-1 rounded hover:bg-white/10"
              aria-label="Minimize chat"
              title="Minimize"
            >
              <X size={18} />
            </button>
          </div>

          {/* Chat content (fills panel) */}
          <div className="flex-1 min-h-0">
            <ChatBot embedded onClose={() => setOpenChat(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportModule;
