import React, { useRef, useState } from 'react';
import { db } from '../../config/firebase';
import { collection, serverTimestamp, addDoc } from 'firebase/firestore';
import { incompleteForm, reportSubmitted } from '../../js/login.js';
import axios from 'axios';

const AssetRequest = () => {
  const assetReqRef = collection(db, 'assetRequests');

  const [loading, setLoading] = useState(false);

  // Inputs
  const [assetName, setAssetName] = useState('');
  const [reason, setReason] = useState('');
  const [image, setImage] = useState(null);

  // Hold-to-preview modal
  const [showFullImage, setShowFullImage] = useState(false);
  const timerRef = useRef(null);

  const onSubmitRequest = async (e) => {
    e.preventDefault();

    const uid = localStorage.getItem('uid'); // or auth.currentUser?.uid
    if (!assetName || !reason || !image || !uid) {
      incompleteForm();
      return;
    }

    try {
      setLoading(true);
      const imgUrl = await handleUpload();

      await addDoc(assetReqRef, {
        serverTimeStamp: serverTimestamp(),
        uid,
        assetName,
        reason,
        imageUrl: imgUrl,
        status: 'Pending',
      });

      // reset
      setAssetName('');
      setReason('');
      setImage(null);

      // reuse your success toast
      reportSubmitted();
    } catch (err) {
      console.error('Error submitting asset request:', err);
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

  return (
    <div className="w-full">
      <h1 className="text-2xl sm:text-3xl font-semibold">Asset Request</h1>

      <form
        onSubmit={onSubmitRequest}
        className="mx-auto w-full max-w-lg sm:max-w-xl lg:max-w-3xl px-4 sm:px-6 lg:px-8 py-6 space-y-5"
      >
        {/* ASSET NAME */}
        <div>
          <label className="block text-sm font-semibold mb-1">
            ASSET NAME<span className="text-red-500">*</span>
          </label>
          <input
            value={assetName}
            onChange={(e) => setAssetName(e.target.value)}
            type="text"
            placeholder="Enter asset name"
            className="w-full border border-black rounded px-3 py-2 text-sm"
          />
        </div>

        {/* UPLOAD IMAGE (same UX as ReportModule) */}
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

        {/* REASON FOR USING */}
        <div className="w-full">
          <label className="block text-sm font-semibold mb-1">
            REASON FOR USING<span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows="3"
            className="w-full border border-black rounded px-3 py-2 text-sm bg-gray-100"
            placeholder="Enter additional information..."
          ></textarea>
        </div>

        {/* SUBMIT */}
        <div className="w-full flex">
          <button
            type="submit"
            className="w-full md:w-2/3 lg:w-1/2 mx-auto bg-[#494949] text-white font-semibold py-3 rounded disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </form>

      {/* LOADING OVERLAY */}
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-[60]">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <p className="text-lg font-semibold">Submitting Request...</p>
            <div className="mt-3">
              <div className="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetRequest;
