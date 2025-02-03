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

  const handleFileUpload = async (e) => {
    if (usageData?.membershipType === 'free' && usageData?.remainingUses <= 0) {
      alert('You have reached your weekly limit. Please upgrade to premium for unlimited use.');
      return;
    }

    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('audioFile', file);

      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5001/api/process-audio', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to process audio file');
      }

      const data = await response.json();
      fetchSummaries();
      fetchUsageStatus();
      alert('File processed successfully!');
    } catch (error) {
      console.error('Error:', error);
      alert('Error processing file');
    } finally {
      setLoading(false);
      setSelectedFile(null);
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
      
      console.log('Sending URL:', youtubeUrl);
      
      const response = await fetch('http://localhost:5001/api/process-youtube', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          url: youtubeUrl.trim() 
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to process video');
      }

      const data = await response.json();
      navigate('/summary-result', { 
        state: { 
          summary: data.summary,
          pdfPath: data.pdfPath
        }
      });
    } catch (error) {
      console.error('Error:', error);
      alert(error.message || 'Error processing video');
    } finally {
      setLoading(false);
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
              
              <form onSubmit={handleYouTubeSubmit} className="flex flex-col items-center space-y-4 w-full max-w-md">
                <input 
                  type="text" 
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="הדבק קישור YouTube כאן..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-sans"
                  required
                />
                <span className="text-gray-500 font-sans">- או -</span>
                
                <input
                  type="file"
                  onChange={handleFileUpload}
                  accept="audio/*"
                  className="w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100"
                />
                
                <button 
                  type="submit"
                  disabled={loading || (!youtubeUrl && !file)}
                  className={`px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full font-sans ${loading || (!youtubeUrl && !file) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loading ? 'מעבד...' : 'עבד קובץ'}
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
      </div>
    </div>
  );
};

export default StudentDashboard;