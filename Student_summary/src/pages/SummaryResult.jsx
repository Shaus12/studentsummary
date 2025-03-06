import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';

const SummaryResult = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [summaryData, setSummaryData] = useState(location.state || {});
  
  console.log("SummaryResult component mounted");
  console.log("Location state:", location.state);
  console.log("PDF path from state:", location.state?.pdfPath);
  
  useEffect(() => {
    console.log("SummaryResult useEffect running");
    
    try {
      // Check localStorage
      const savedSummary = localStorage.getItem('lastProcessedSummary');
      console.log("Retrieved from localStorage:", savedSummary);
      
      if (savedSummary) {
        const parsedData = JSON.parse(savedSummary);
        console.log("Parsed data:", parsedData);
        setSummaryData(parsedData);
      } else if (!location.state) {
        console.log("No data in localStorage or location.state, redirecting to dashboard");
        navigate('/dashboard');
      }
    } catch (error) {
      console.error("Error in SummaryResult useEffect:", error);
    }
  }, [location.state, navigate]);
  
  const { summary, pdfPath } = summaryData;

  console.log('Summary state:', summaryData);
  console.log('PDF path:', pdfPath);

  const handleDownloadPDF = () => {
    console.log("handleDownloadPDF called");
    console.log("pdfPath:", pdfPath);
    
    if (pdfPath) {
      // Use the relative path that will be handled by the service worker
      const fullPdfUrl = pdfPath;
      console.log('Attempting to open PDF at:', fullPdfUrl);
      
      // Try a different approach
      try {
        // First try window.open
        window.open(fullPdfUrl, '_blank');
        
        // Also create a direct link as a fallback
        const link = document.createElement('a');
        link.href = fullPdfUrl;
        link.target = '_blank';
        link.download = 'summary.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error('Error opening PDF:', error);
      }
    } else {
      console.error('No PDF path available');
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