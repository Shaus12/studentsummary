import React, { useState } from 'react';
import { Card, CardContent } from '../components/ui/card';

const Dashboard = () => {
  const [dragActive, setDragActive] = useState(false);
  const userName = "דניאל"; // This would come from your user state/props
  const userPlan = "Pro"; // This would come from your user state/props

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-800 rtl font-sans" dir="rtl">
      {/* Top Navigation */}
      <nav className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-4 space-x-reverse">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-xl font-sans">T</span>
          </div>
          <h1 className="text-2xl font-bold text-blue-600 font-sans tracking-tight">TachlesAI</h1>
        </div>
        
        <div className="flex items-center space-x-4 space-x-reverse">
          <button className="p-2 hover:bg-gray-100 rounded-full" title="התראות">
            🔔
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-full" title="הגדרות">
            ⚙️
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-full" title="התנתק">
            🚪
          </button>
        </div>
      </nav>

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
              
              <div className="flex flex-col items-center space-y-4 w-full max-w-md">
                <input 
                  type="text" 
                  placeholder="הדבק קישור YouTube כאן..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-sans"
                />
                <span className="text-gray-500 font-sans">- או -</span>
                <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full font-sans">
                  בחר קובץ להעלאה
                </button>
              </div>

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
            <Card className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-3 space-x-reverse">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  📄
                </div>
                <div className="font-sans">
                  <h4 className="font-medium">הרצאה בפיזיקה קוונטית</h4>
                  <p className="text-sm text-gray-500">לפני 2 ימים</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;