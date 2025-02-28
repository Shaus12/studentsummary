import React from 'react';
import { FiYoutube, FiLinkedin, FiTwitter, FiFacebook } from 'react-icons/fi';

const Footer = () => {
  return (
    <footer className="bg-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-bold mb-4">פתרונות</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-600">יכולות</a></li>
              <li><a href="#" className="text-gray-600">פתרונות</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold mb-4">עלינו</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-600">אודות</a></li>
              <li><a href="#" className="text-gray-600">תמחור</a></li>
              <li><a href="#" className="text-gray-600">צור קשר</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-bold mb-4">עקבו אחרינו</h3>
            <div className="flex space-x-4">
              <FiYoutube className="text-gray-600 hover:text-indigo-600" size={20} />
              <FiTwitter className="text-gray-600 hover:text-indigo-600" size={20} />
              <FiFacebook className="text-gray-600 hover:text-indigo-600" size={20} />
            </div>
          </div>
        </div>
        <div className="mt-12 text-center text-gray-600">
          <p>© 2025 TachlesAI. כל הזכויות שמורות.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;