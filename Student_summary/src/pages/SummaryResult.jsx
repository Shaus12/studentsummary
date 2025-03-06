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
      // Extract the filename from the path
      const pathParts = pdfPath.split('/');
      const filename = pathParts[pathParts.length - 1];
      
      // Create a server-side endpoint to handle the download
      const downloadUrl = `/api/download-pdf?filename=${encodeURIComponent(filename)}`;
      console.log('Attempting to download PDF from:', downloadUrl);
      
      // Create a direct download link
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'summary.pdf'; // Suggest a filename
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      console.error('No PDF path available');
      alert('No PDF path available');
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