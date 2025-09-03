import React, { useRef, useState } from 'react';
import { db } from '../../config/firebase';
import { collection, serverTimestamp, addDoc } from 'firebase/firestore';
import { incompleteForm, reportSubmitted } from '../../js/login.js';
import axios from 'axios';

const ReportModule = () => {
  const reportCollectionRef = collection(db, 'userReport');

  const [loading, setLoading] = useState(false);

  // New Report States
  const [buildingName, setBuildingName] = useState('');
  const [floorLocation, setFloorLocation] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [image, setImage] = useState(null);

  // For preview modal
  const [showFullImage, setShowFullImage] = useState(false);
  const timerRef = useRef(null);

  // ...imports unchanged
const onSubmitReport = async (e) => {
  e.preventDefault();

  const uid = localStorage.getItem('uid'); // or auth.currentUser?.uid
  if (!buildingName || !floorLocation || !serviceType || !image || !uid) {
    incompleteForm();
    return;
  }

  try {
    setLoading(true);
    const img = await handleUpload();

    await addDoc(reportCollectionRef, {
      serverTimeStamp: serverTimestamp(),
      buildingName,
      floorLocation,
      serviceType,
      additionalDetails,
      imageUrl: img,
      uid,
      status: "Pending",               // 👈 default status
    });

    // reset fields
    setBuildingName('');
    setFloorLocation('');
    setServiceType('');
    setAdditionalDetails('');
    setImage(null);

    reportSubmitted();
  } catch (err) {
    console.error('Error submitting report: ', err);
  } finally {
    setLoading(false);
  }
};


  const handleUpload = async () => {
    if (!image) return;

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

  return (
    <div className="w-full">
      {/* Centered responsive container */}
      <form
        onSubmit={onSubmitReport}
        className="mx-auto w-full max-w-lg sm:max-w-xl lg:max-w-3xl px-4 sm:px-6 lg:px-8 py-6 space-y-5"
      >
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
            FLOOR LOCATION<span className="text-red-500">*</span>
          </label>
          <input
            value={floorLocation}
            onChange={(e) => setFloorLocation(e.target.value)}
            type="text"
            placeholder="Enter floor location"
            className="w-full border border-black rounded px-3 py-2 text-sm"
          />
        </div>

        {/* SERVICE TYPE */}
        <div>
          <label className="block text-sm font-semibold mb-1">
            SERVICE TYPE<span className="text-red-500">*</span>
          </label>
          <select
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            className="w-full border border-black rounded px-3 py-2 text-sm"
          >
            <option value="">Select service</option>
            <option value="Facilities and Maintenance">Facilities and Maintenance</option>
            <option value="IT Support Services">IT Support Services</option>
          </select>
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
            placeholder="Enter additional information..."
          ></textarea>
        </div>

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

      {/* LOADING OVERLAY */}
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-[60]">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <p className="text-lg font-semibold">Submitting Report...</p>
            <div className="mt-3">
              <div className="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportModule;
