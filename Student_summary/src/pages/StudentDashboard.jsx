import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();
  const [dragActive, setDragActive] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [summaries, setSummaries] = useState([]);
  const userName = "דניאל";
  const userPlan = "Pro";

  const fetchSummaries = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5001/api/summaries', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch summaries');
      const data = await response.json();
      setSummaries(data);
    } catch (error) {
      console.error('Error fetching summaries:', error);
    }
  };

  useEffect(() => {
    fetchSummaries();
  }, []);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleYouTubeSubmit = async (e) => {
    e.preventDefault();
    if (!youtubeUrl) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch('http://localhost:5001/api/process-youtube', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ youtubeUrl }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Server response:', errorData);
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      console.log('Received data:', data);
      
      await fetchSummaries();
      navigate('/summary-result', {
        state: {
          summary: data.summary,
          pdfPath: data.pdfPath,
          title: data.title  // Add this line
        }
      });
    } catch (error) {
      console.error('Error:', error);
      alert('Error processing video. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-800 rtl font-sans" dir="rtl">
      {/* Welcome and Plan Status */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-semibold font-sans">שלום {userName}, כיף לראות אותך שוב</h2>
          <div className="flex items-center space-x-2 space-x-reverse bg-blue-50 px-4 py-2 rounded-full">
            <span className="text-yellow-500">👑</span>
            <span className="font-medium font-sans">{userPlan === "Pro" ? "חשבון Pro" : "חשבון חינמי"}</span>
          </div>
        </div>

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
                />
                <span className="text-gray-500 font-sans">- או -</span>
                <button 
                  type="submit"
                  disabled={loading || !youtubeUrl}
                  className={`px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full font-sans ${loading || !youtubeUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loading ? 'מעבד...' : 'עבד סרטון'}
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

export default Dashboard;