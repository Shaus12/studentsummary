import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';

const SummaryResult = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Add these debug logs
  console.log("Initial location state:", location.state);
  console.log("PDF path from location:", location.state?.pdfPath);
  
  const [summaryData, setSummaryData] = useState(location.state || {});
  const [isDownloading, setIsDownloading] = useState(false);
  const [isButtonEnabled, setIsButtonEnabled] = useState(true);

  // Add a ref to get direct access to the button
  const buttonRef = useRef(null);

  useEffect(() => {
    const savedSummary = localStorage.getItem('lastProcessedSummary');
    if (savedSummary) {
      try {
        const parsedData = JSON.parse(savedSummary);
        setSummaryData(parsedData);
      } catch (error) {
        console.error('Error parsing saved summary:', error);
      }
    } else if (location.state) {
      setSummaryData(location.state);
      localStorage.setItem('lastProcessedSummary', JSON.stringify(location.state));
    }
  }, [location.state]);
  
  const { summary, pdfPath } = summaryData;
  
  // Add this debug log
  console.log("Final pdfPath being used:", pdfPath);

  console.log('Summary state:', summaryData);
  console.log('PDF path:', pdfPath);

  const handleBack = () => {
    navigate('/dashboard');
  };

  const handleDownloadPDF = (e) => {
    if (e) e.preventDefault();
    
    try {
      const savedSummary = localStorage.getItem('lastProcessedSummary');
      console.log('Using saved summary:', savedSummary);
      
      if (!savedSummary) {
        alert('No saved summary found in localStorage');
        return;
      }

      const parsedData = JSON.parse(savedSummary);
      const pdfPath = parsedData.pdfPath;
      
      if (!pdfPath) {
        alert('No PDF path found in saved data');
        return;
      }

      const pathParts = pdfPath.split('/');
      const filename = pathParts[pathParts.length - 1];
      const downloadUrl = `/api/download-pdf/${encodeURIComponent(filename)}`;
      console.log('Attempting to download from:', downloadUrl);
      window.open(downloadUrl, '_blank');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Error downloading PDF');
    }
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
                disabled={!isButtonEnabled}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                הורד PDF
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