import React from 'react';

const Hero = () => {
  return (
    <div className="bg-gradient-to-br from-white via-indigo-50 to-blue-100 py-24">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="text-right order-2 md:order-1 pl-32 relative left-12">
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
            
            <div className="space-y-6">
              <button className="w-full md:w-auto bg-indigo-600 text-white px-8 py-4 rounded-xl hover:bg-indigo-700 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl font-medium text-lg">
                התחל בחינם ←
              </button>
              
              <div className="flex items-center justify-end space-x-4 space-x-reverse mt-8">
                <div className="flex -space-x-4 space-x-reverse">
                  <img className="w-10 h-10 rounded-full border-2 border-white" src="https://randomuser.me/api/portraits/men/1.jpg" alt="User" />
                  <img className="w-10 h-10 rounded-full border-2 border-white" src="https://randomuser.me/api/portraits/women/2.jpg" alt="User" />
                  <img className="w-10 h-10 rounded-full border-2 border-white" src="https://randomuser.me/api/portraits/men/3.jpg" alt="User" />
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-semibold">+1,000</span> סטודנטים כבר משתמשים
                </div>
              </div>
            </div>
          </div>
          
          <div className="order-1 md:order-2 -ml-24 transform-gpu relative">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/30 to-blue-500/30 rounded-3xl blur-2xl"></div>
              <img 
                src="public\hero_image.jpeg" 
                alt="תיאור התמונה" 
                className="relative rounded-3xl shadow-2xl transform transition-transform hover:scale-105 duration-500 ease-in-out"
              />
              
              {/* Floating Elements */}
              <div className="absolute -top-4 -right-4 bg-white p-4 rounded-xl shadow-lg">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <div className="text-green-500 text-2xl">📈</div>
                  <div className="text-sm font-medium">חסכון של 80% בזמן</div>
                </div>
              </div>
              
              <div className="absolute -bottom-4 -left-4 bg-white p-4 rounded-xl shadow-lg">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <div className="text-blue-500 text-2xl">🎯</div>
                  <div className="text-sm font-medium">דיוק של 95%</div>
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