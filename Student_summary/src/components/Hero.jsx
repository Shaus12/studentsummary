import React from 'react';

const Hero = () => {
  return (
    <div className="bg-gradient-to-br from-white via-indigo-50 to-blue-100 py-24">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex flex-col items-center text-center">
          <div className="max-w-3xl mx-auto">
            <div className="mb-8">
              <span className="inline-block bg-indigo-100 text-indigo-800 px-4 py-2 rounded-full text-sm font-semibold mb-6">
                🚀 הדור הבא של למידה
              </span>
              <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                תפסיק לבזבז שעות על למידה ותתחיל לחסוך זמן
              </h1>
              <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                ב-2025 כולם כבר משתמשים בבינה מלאכותית, אבל 99% לא מנצלים את מלוא הפוטנציאל. 
                הגיע הזמן להיות ב-1% שכן.
              </p>
            </div>
            
            <div className="flex flex-col items-center space-y-6">
              <button className="w-64 bg-indigo-600 text-white px-8 py-4 rounded-xl hover:bg-indigo-700 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl font-medium text-lg">
                התחל בחינם ←
              </button>
              
              <div className="flex items-center space-x-4 space-x-reverse mt-8">
                <div className="text-sm text-gray-600">
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;