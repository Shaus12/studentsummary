import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';

const SummaryResult = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { summary, pdfPath } = location.state || {};

  const handleDownloadPDF = () => {
    if (pdfPath) {
      // Add the server URL to the PDF path
      const fullPdfUrl = `http://localhost:5001${pdfPath}`;
      console.log('Attempting to open PDF at:', fullPdfUrl); // Debug log
      window.open(fullPdfUrl, '_blank');
    }
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-white pt-20" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">סיכום הסרטון</h1>
            <div className="flex gap-4">
              <button
                onClick={handleBack}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                חזור
              </button>
              <button
                onClick={handleDownloadPDF}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                disabled={!pdfPath}
              >
                <span>הורד PDF</span>
                <span>📄</span>
              </button>
            </div>
          </div>

          <div className="prose max-w-none">
            <div className="bg-gray-50 p-6 rounded-lg">
              {summary ? (
                <p className="whitespace-pre-wrap text-gray-700">{summary}</p>
              ) : (
                <p className="text-gray-500">לא נמצא סיכום</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryResult; 