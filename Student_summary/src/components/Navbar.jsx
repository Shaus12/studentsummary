import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }

    const handleStorageChange = (e) => {
      if (e.key === 'user') {
        if (e.newValue) {
          setUser(JSON.parse(e.newValue));
        } else {
          setUser(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    const interval = setInterval(() => {
      const currentUserData = localStorage.getItem('user');
      if (currentUserData) {
        const parsedUser = JSON.parse(currentUserData);
        if (JSON.stringify(parsedUser) !== JSON.stringify(user)) {
          setUser(parsedUser);
        }
      } else if (user) {
        setUser(null);
      }
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <nav className="absolute top-0 left-0 right-0 bg-white shadow-md h-16" dir="rtl">
      <div className="h-full mx-auto px-8">
        <div className="flex justify-between items-center h-full">
          {/* Right Side (Logo and Links) */}
          <div className="flex items-center gap-8">
            <Link to="/" className="text-[22px] font-bold text-indigo-600">TachelsAI</Link>
            <div className="flex gap-6">
              <Link to="/youtube-summary" className="text-gray-600 hover:text-indigo-600">סיכום סרטונים</Link>
              <Link to="#features" className="text-gray-600 hover:text-indigo-600">יכולות</Link>
              <Link to="#solutions" className="text-gray-600 hover:text-indigo-600">פתרונות</Link>
              <Link to="#pricing" className="text-gray-600 hover:text-indigo-600">תמחור</Link>
            </div>
          </div>

          {/* Left Side (User Actions) */}
          <div className="flex items-center gap-6">
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-gray-600">שלום, {user.firstName}</span>
                <button 
                  onClick={handleLogout}
                  className="text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  התנתק
                </button>
              </div>
            ) : (
              <Link to="/login">
                <button className="text-indigo-600 hover:text-indigo-700 font-medium">
                  הירשמו/התחברו
                </button>
              </Link>
            )}
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
              <span className="text-indigo-600 text-xl">⚡</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
