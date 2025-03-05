import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { useNavigate } from 'react-router-dom';
import UsageStatus from '../components/UsageStatus';
import Navbar from '../components/Navbar';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [dragActive, setDragActive] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [summaries, setSummaries] = useState([]);
  const [user, setUser] = useState(null);
  const userPlan = "Pro";
  const [file, setFile] = useState(null);
  const [usageData, setUsageData] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [summaryOptions, setSummaryOptions] = useState({
    style: 'detailed',
    format: 'bullets',
    language: 'he',
    maxPoints: 10
  });
  const [outputType, setOutputType] = useState('summary');
  const [isUsageLimitReached, setIsUsageLimitReached] = useState(false);
  const [processedSummary, setProcessedSummary] = useState(null);
  const [processedPdfPath, setProcessedPdfPath] = useState(null);
  const [processingComplete, setProcessingComplete] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    fetchSummaries();
    fetchUsageStatus();
    // Get user data from localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }

    const checkUsageLimit = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5001/api/usage-status', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        
        if (data.membershipType === 'free' && data.remainingUses <= 0) {
          setIsUsageLimitReached(true);
        }
      } catch (error) {
        console.error('Error checking usage limit:', error);
      }
    };

    checkUsageLimit();
  }, [navigate]);

  const fetchSummaries = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5001/api/summaries', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setSummaries(data);
    } catch (error) {
      console.error('Error fetching summaries:', error);
    }
  };

  const fetchUsageStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5001/api/usage-status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setUsageData(data);
    } catch (error) {
      console.error('Error fetching usage status:', error);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleUpgradeMembership = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5001/api/upgrade-membership', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        alert('Successfully upgraded to premium!');
        fetchUsageStatus();
      } else {
        const data = await response.json();
        alert(data.message || 'Error upgrading membership');
      }
    } catch (error) {
      console.error('Error upgrading membership:', error);
      alert('Error upgrading membership');
    }
  };

  const handleFileSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    
    setLoading(true);
    
    const formData = new FormData();
    formData.append('audioFile', file);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5001/api/process-audio', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      const data = await response.json();
      
      if (data.success && data.redirectUrl) {
        // Redirect to the summary page
        navigate(data.redirectUrl);
      } else {
        // Fallback - refresh summaries list
        fetchSummaries();
        setFile(null);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error processing file:', error);
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      
      // Automatically submit the form when a file is dropped
      const formData = new FormData();
      formData.append('audioFile', droppedFile);
      
      setLoading(true);
      setProcessingComplete(false);
      
      const token = localStorage.getItem('token');
      console.log("Sending file to server...");
      
      // Use the relative URL path that will be handled by the service worker
      fetch('/api/process-audio', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
      .then(response => {
        console.log("Received response status:", response.status);
        return response.json();
      })
      .then(data => {
        console.log("Received response data:", data);
        setLoading(false);
        
        if (data.success) {
          console.log("Success! Setting processed data:", {
            summary: data.summary,
            pdfPath: data.pdfPath
          });
          
          // Store the processed data in localStorage
          localStorage.setItem('lastProcessedSummary', JSON.stringify({
            summary: data.summary,
            pdfPath: data.pdfPath
          }));
          
          // Refresh summaries list
          fetchSummaries();
          
          // Use window.location for navigation
          if (confirm('הקובץ עובד בהצלחה! האם ברצונך לצפות בסיכום?')) {
            window.location.href = '/summary-result';
          }
        } else {
          console.log("Error in response:", data.error);
          // Fallback - refresh summaries list
          fetchSummaries();
          setFile(null);
          alert(data.error || 'Error processing file');
        }
      })
      .catch(error => {
        console.error('Error processing file:', error);
        setLoading(false);
        alert('Error processing file: ' + error.message);
      });
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      
      // Automatically submit the form when a file is selected
      const formData = new FormData();
      formData.append('audioFile', selectedFile);
      
      setLoading(true);
      setProcessingComplete(false);
      
      const token = localStorage.getItem('token');
      console.log("Sending file to server...");
      
      // Use the relative URL path that will be handled by the service worker
      fetch('/api/process-audio', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
      .then(response => {
        console.log("Received response status:", response.status);
        return response.json();
      })
      .then(data => {
        console.log("Received response data:", data);
        setLoading(false);
        
        if (data.success) {
          console.log("Success! Setting processed data:", {
            summary: data.summary,
            pdfPath: data.pdfPath
          });
          
          // Store the processed data in localStorage
          localStorage.setItem('lastProcessedSummary', JSON.stringify({
            summary: data.summary,
            pdfPath: data.pdfPath
          }));
          
          // Refresh summaries list
          fetchSummaries();
          
          // Use window.location for navigation
          if (confirm('הקובץ עובד בהצלחה! האם ברצונך לצפות בסיכום?')) {
            window.location.href = '/summary-result';
          }
        } else {
          console.log("Error in response:", data.error);
          // Fallback - refresh summaries list
          fetchSummaries();
          setFile(null);
          alert(data.error || 'Error processing file');
        }
      })
      .catch(error => {
        console.error('Error processing file:', error);
        setLoading(false);
        alert('Error processing file: ' + error.message);
      });
    }
  };

  const handleYouTubeSubmit = async (e) => {
    e.preventDefault();
    
    if (!youtubeUrl || !youtubeUrl.includes('youtube.com')) {
      alert('Please enter a valid YouTube URL');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      console.log('Sending request...'); // Debug log
      
      const response = await fetch('http://localhost:5001/api/process-youtube', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          url: youtubeUrl.trim(),
          outputType,
          summaryOptions: outputType === 'summary' ? summaryOptions : undefined
        })
      });

      const data = await response.json();
      console.log('Response status:', response.status); // Debug log
      console.log('Response data:', data); // Debug log

      if (response.status === 403 || data.status === 'USAGE_LIMIT_REACHED') {
        alert('נגמרו לך השימושים השבועיים! 🚫\n\n' +
              'שדרג לחשבון פרימיום כדי לקבל:\n' +
              '• שימוש בלתי מוגבל\n' +
              '• תכונות נוספות\n' +
              '• תמיכה בפיתוח הכלי\n\n' +
              'לחץ OK כדי לשדרג! 🌟');
        navigate('/upgrade');
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Error processing video');
      }

      navigate('/summary-result', { 
        state: { 
          summary: data.summary,
          pdfPath: data.pdfPath
        }
      });
    } catch (error) {
      console.error('Error:', error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (file) {
      // If there's a file, trigger the file upload
      const event = { target: { files: [file] } };
      handleFileChange(event);
    } else if (youtubeUrl) {
      // Handle YouTube URL submission
      handleYouTubeSubmit(e);
    }
  };

  const viewLatestSummary = () => {
    // Get the latest summary from localStorage
    const savedSummary = localStorage.getItem('lastProcessedSummary');
    if (savedSummary) {
      const summaryData = JSON.parse(savedSummary);
      // Navigate to the summary page
      window.location.href = '/summary-result';
    } else {
      alert('No summary available');
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-800 rtl font-sans" dir="rtl">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">
            {user ? `שלום, ${user.firstName}` : 'שלום, אורח'}
          </h1>
          <div className="flex items-center space-x-2 space-x-reverse bg-blue-50 px-4 py-2 rounded-full">
            <span className="text-yellow-500">👑</span>
            <span className="font-medium font-sans">
              {usageData?.membershipType === 'premium' ? "חשבון Pro" : "חשבון חינמי"}
            </span>
          </div>
        </div>

        {/* Add Usage Status Component */}
        <UsageStatus />

        {/* Show upgrade button for free users */}
        {usageData?.membershipType === 'free' && (
          <div className="mb-4">
            <button 
              onClick={handleUpgradeMembership}
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
            >
              Upgrade to Premium
            </button>
          </div>
        )}

        {/* Upload Area */}
        <Card className={`border-2 border-dashed ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'} rounded-lg`}>
          <CardContent className="p-12">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">⬆️</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-medium font-sans">העלה קובץ או הדבק קישור</h3>
                <p className="text-gray-500 font-sans">גרור לכאן קובץ או הדבק קישור ליוטיוב</p>
              </div>
              
              <form onSubmit={handleSubmit} className="flex flex-col items-center space-y-4 w-full max-w-md">
                {isUsageLimitReached && (
                  <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
                    <strong className="font-bold">שים לב! </strong>
                    <span className="block sm:inline">נגמרו לך השימושים השבועיים. שדרג לפרימיום להמשך שימוש.</span>
                  </div>
                )}
                {/* File Upload Section */}
                <div className="w-full">
                  <label 
                    htmlFor="file-upload" 
                    className="cursor-pointer flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-sans"
                  >
                    <span>בחר קובץ אודיו או וידאו</span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      className="sr-only"
                      onChange={handleFileChange}
                      accept="audio/*,video/*"
                    />
                  </label>
                  {file && (
                    <div className="mt-2 text-sm text-gray-500 font-sans">
                      {file.name}
                    </div>
                  )}
                </div>
                
                <span className="text-gray-500 font-sans">- או -</span>
                
                <input
                  type="text" 
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="הדבק קישור YouTube כאן..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-sans"
                  required
                />

                {/* Summary Options Section */}
                <div className="w-full space-y-3 mt-6 border-t pt-6">
                  <h3 className="text-lg font-medium mb-4">אפשרויות עיבוד</h3>
                  
                  <div className="flex gap-4 mb-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="outputType"
                        value="summary"
                        checked={outputType === 'summary'}
                        onChange={(e) => setOutputType(e.target.value)}
                        className="ml-2"
                      />
                      <span className="text-sm text-gray-600">סיכום</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="outputType"
                        value="transcription"
                        checked={outputType === 'transcription'}
                        onChange={(e) => setOutputType(e.target.value)}
                        className="ml-2"
                      />
                      <span className="text-sm text-gray-600">תמלול בלבד</span>
                    </label>
                  </div>

                  {/* Show summary options only if summary is selected */}
                  {outputType === 'summary' && (
                    <>
                      <h3 className="text-lg font-medium mb-4">אפשרויות סיכום</h3>
                      
                      <div className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1">סגנון סיכום</label>
                        <select 
                          value={summaryOptions.style}
                          onChange={(e) => setSummaryOptions({...summaryOptions, style: e.target.value})}
                          className="px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="detailed">מפורט</option>
                          <option value="concise">תמציתי</option>
                        </select>
                      </div>

                      <div className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1">פורמט</label>
                        <select 
                          value={summaryOptions.format}
                          onChange={(e) => setSummaryOptions({...summaryOptions, format: e.target.value})}
                          className="px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="bullets">נקודות</option>
                          <option value="paragraphs">פסקאות</option>
                        </select>
                      </div>

                      <div className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1">שפה</label>
                        <select 
                          value={summaryOptions.language}
                          onChange={(e) => setSummaryOptions({...summaryOptions, language: e.target.value})}
                          className="px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="he">עברית</option>
                          <option value="en">אנגלית</option>
                        </select>
                      </div>

                      <div className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1">מספר נקודות מקסימלי</label>
                        <input 
                          type="number"
                          min="1"
                          value={summaryOptions.maxPoints}
                          onChange={(e) => setSummaryOptions({...summaryOptions, maxPoints: parseInt(e.target.value)})}
                          className="px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </>
                  )}
                </div>

                <button 
                  type="submit"
                  disabled={loading || (!youtubeUrl && !file) || isUsageLimitReached}
                  className={`px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full font-sans 
                    ${(loading || (!youtubeUrl && !file) || isUsageLimitReached) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loading ? 'מעבד...' : isUsageLimitReached ? 'שדרג לפרימיום' : 'עבד קובץ'}
                </button>
              </form>

              {loading && (
                <div className="text-blue-600">
                  מעבד את הסרטון, אנא המתן...
                </div>
              )}

              <div className="flex items-center justify-center space-x-4 space-x-reverse text-sm text-gray-500 font-sans">
                <div className="flex items-center space-x-1 space-x-reverse">
                  📄
                  <span>PDF</span>
                </div>
                <div className="flex items-center space-x-1 space-x-reverse">
                  🎥
                  <span>YouTube</span>
                </div>
              </div>

              {/* Add this after your form */}
              {processingComplete && (
                <div className="mt-4 text-center">
                  <div className="text-green-600 mb-2">הקובץ עובד בהצלחה!</div>
                  <a 
                    href="/summary-result" 
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors inline-block w-full font-sans"
                    onClick={(e) => {
                      e.preventDefault();
                      // Store the data in sessionStorage for immediate access
                      sessionStorage.setItem('summaryData', JSON.stringify({
                        summary: processedSummary,
                        pdfPath: processedPdfPath
                      }));
                      window.location.href = '/summary-result';
                    }}
                  >
                    צפה בסיכום
                  </a>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Files Section */}
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4 font-sans">קבצים אחרונים</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summaries.map((summary) => (
              <Card 
                key={summary.id} 
                className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate('/summary-result', {
                  state: {
                    summary: summary.summary,
                    pdfPath: summary.pdf_path,
                    title: summary.title  // Add this
                  }
                })}
              >
                <div className="flex items-center space-x-3 space-x-reverse">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    📄
                  </div>
                  <div className="font-sans">
                    <h4 className="font-medium">{summary.title || 'סיכום סרטון'}</h4>
                    <p className="text-sm text-gray-500">
                      {new Date(summary.created_at).toLocaleDateString('he-IL')}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <button 
          onClick={viewLatestSummary}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          View Latest Summary
        </button>
      </div>
    </div>
  );
};

export default StudentDashboard;