import React from 'react';
import { FileText, Headphones, MessageSquare, HelpCircle, FileSearch } from 'lucide-react';

const Capabilities = () => {
  const capabilities = [
    {
      icon: <FileText className="w-12 h-12 text-indigo-600" />,
      title: "סיכומים מותאמים אישית",
      description: "קבל סיכומים המותאמים בדיוק לסגנון הלמידה שלך, עם דגש על הנקודות החשובות עבורך",
      features: ["זיהוי נקודות מפתח", "התאמה אישית", "פורמט נוח לקריאה"]
    },
    {
      icon: <Headphones className="w-12 h-12 text-indigo-600" />,
      title: "תמלולים מלאים להרצאות",
      description: "המרת הרצאות מוקלטות לטקסט מלא ומדויק, כולל זיהוי דוברים וסימון זמנים",
      features: ["דיוק גבוה", "תמיכה במגוון שפות", "חיפוש בתוך התמלול"]
    },
    {
      icon: <MessageSquare className="w-12 h-12 text-indigo-600" />,
      title: "בוט אינטרקטיבי חכם",
      description: "שאל שאלות וקבל תשובות מדויקות מכל מקור מידע, כולל קבצי PDF",
      features: ["תשובות בזמן אמת", "הבנת הקשר", "למידה מתקדמת"]
    },
    {
      icon: <HelpCircle className="w-12 h-12 text-indigo-600" />,
      title: "יצירת שאלות ותשובות",
      description: "הבוט יוצר שאלות ותשובות מותאמות מקבצי PDF לתרגול והבנה טובה יותר",
      features: ["שאלות ברמות קושי שונות", "משוב מיידי", "מעקב התקדמות"]
    },
    {
      icon: <FileSearch className="w-12 h-12 text-indigo-600" />,
      title: "סיכום PDF חכם",
      description: "קבל סיכום מקיף ומדויק של כל קובץ PDF, עם שמירה על המידע החשוב",
      features: ["זיהוי מבנה", "הדגשת נקודות מפתח", "ארגון היררכי"]
    }
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="text-indigo-600 font-semibold text-sm uppercase tracking-wide">
            היכולות שלנו
          </span>
          <h2 className="mt-4 text-4xl font-bold text-gray-900">
            כל מה שתקבל עם TachlesAI
          </h2>
          <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
            פלטפורמה מקיפה שנותנת לך את כל הכלים להצלחה בלימודים
          </p>
        </div>

        {/* Capabilities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {capabilities.map((capability, index) => (
            <div 
              key={index}
              className="bg-gradient-to-br from-white to-indigo-50/50 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-indigo-50"
            >
              <div className="bg-white rounded-xl p-4 shadow-sm inline-block mb-6">
                {capability.icon}
              </div>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                {capability.title}
              </h3>
              
              <p className="text-gray-600 mb-6 leading-relaxed">
                {capability.description}
              </p>

              <ul className="space-y-3">
                {capability.features.map((feature, fIndex) => (
                  <li key={fIndex} className="flex items-center text-gray-600">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full ml-2"></div>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <div className="mt-16 text-center">
          <div className="inline-block bg-indigo-50 rounded-full px-6 py-2 mb-6">
            <span className="text-indigo-600 font-medium">מתחילים בחינם</span>
          </div>
          <h3 className="text-2xl font-semibold mb-8">
            מוכן לשדרג את חווית הלמידה שלך?
          </h3>
          <button className="bg-indigo-600 text-white px-8 py-4 rounded-xl hover:bg-indigo-700 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl font-medium text-lg">
            התחל להשתמש עכשיו ←
          </button>
        </div>
      </div>
    </section>
  );
};

export default Capabilities; 