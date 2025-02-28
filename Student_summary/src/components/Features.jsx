import React from 'react';
import { Zap, Clock, Brain, Target, Sparkles, Shield } from 'lucide-react';

const Features = () => {
  const features = [
    {
      icon: <Brain className="w-8 h-8 text-indigo-600" />,
      title: "למידה חכמה יותר",
      description: "הבינה המלאכותית שלנו מזהה את סגנון הלמידה שלך ומתאימה את התוכן בהתאם"
    },
    {
      icon: <Clock className="w-8 h-8 text-indigo-600" />,
      title: "חיסכון בזמן",
      description: "קבל סיכומים מדויקים תוך דקות במקום שעות של למידה מסורתית"
    },
    {
      icon: <Target className="w-8 h-8 text-indigo-600" />,
      title: "דיוק מקסימלי",
      description: "אלגוריתמים מתקדמים מבטיחים דיוק של 95% בסיכומים"
    },
    {
      icon: <Sparkles className="w-8 h-8 text-indigo-600" />,
      title: "תוכן מותאם אישית",
      description: "כל סיכום מותאם לצרכים הספציפיים שלך ולסגנון הלמידה המועדף עליך"
    },
    {
      icon: <Shield className="w-8 h-8 text-indigo-600" />,
      title: "אבטחה מתקדמת",
      description: "הנתונים שלך מאובטחים עם הצפנה מתקדמת ואמצעי אבטחה קפדניים"
    },
    {
      icon: <Zap className="w-8 h-8 text-indigo-600" />,
      title: "מהירות מרבית",
      description: "קבל תשובות ועזרה בזמן אמת, בכל שעה ומכל מקום"
    }
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="text-indigo-600 font-semibold text-sm uppercase tracking-wide">
            היתרונות שלנו
          </span>
          <h2 className="mt-4 text-4xl font-bold text-gray-900">
            למה לבחור ב-TachlesAI?
          </h2>
          <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
            הפלטפורמה שלנו משלבת טכנולוגיה מתקדמת עם חווית משתמש פשוטה כדי להפוך את הלמידה שלך ליעילה יותר
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="p-8 rounded-2xl bg-white border border-gray-100 hover:border-indigo-100 hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <div className="w-14 h-14 rounded-xl bg-indigo-50 flex items-center justify-center mb-6">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <div className="flex justify-center">
        <button className="cta-button px-6 py-3 text-base font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 w-64">
          התחל עכשיו בחינם
        </button>
      </div>
      </div>
    </section>
  );
};

export default Features;