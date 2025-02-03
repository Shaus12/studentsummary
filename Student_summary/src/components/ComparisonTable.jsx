import React from 'react';
import { Check, X } from 'lucide-react';

const ComparisonTable = () => {
  const features = [
    {
      name: "זמן סיכום חומר",
      traditional: "3-4 שעות",
      tachles: "2-3 דקות",
    },
    {
      name: "דיוק בתוכן",
      traditional: "תלוי בריכוז",
      tachles: "דיוק של 95%",
    },
    {
      name: "זמינות",
      traditional: "מוגבל לשעות ערנות",
      tachles: "24/7 זמינות",
    },
    {
      name: "התאמה אישית",
      traditional: "חד-גונית",
      tachles: "מותאם לסגנון הלמידה שלך",
    },
    {
      name: "ארגון מידע",
      traditional: "ידני ומסורבל",
      tachles: "אוטומטי ומאורגן",
    }
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="text-indigo-600 font-semibold text-sm uppercase tracking-wide">
            השוואה
          </span>
          <h2 className="mt-4 text-4xl font-bold text-gray-900">
            למידה מסורתית מול TachlesAI
          </h2>
          <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
            ראה איך TachlesAI משנה את חווית הלמידה שלך לעומת השיטה המסורתית
          </p>
        </div>

        {/* Comparison Table */}
        <div className="overflow-hidden rounded-2xl shadow-lg border border-gray-100">
          <div className="grid grid-cols-3 bg-gradient-to-r from-indigo-50 to-blue-50 p-6 font-semibold text-gray-900">
            <div className="text-right">מאפיין</div>
            <div className="text-center">למידה מסורתית</div>
            <div className="text-center">TachlesAI</div>
          </div>

          {features.map((feature, index) => (
            <div 
              key={index}
              className={`grid grid-cols-3 p-6 ${
                index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
              }`}
            >
              <div className="text-right font-medium text-gray-900">
                {feature.name}
              </div>
              <div className="text-center text-gray-600 flex items-center justify-center">
                <span className="bg-red-50 text-red-700 px-4 py-1 rounded-full text-sm">
                  {feature.traditional}
                </span>
              </div>
              <div className="text-center text-gray-600 flex items-center justify-center">
                <span className="bg-green-50 text-green-700 px-4 py-1 rounded-full text-sm">
                  {feature.tachles}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-12 shadow-xl">
            <h3 className="text-3xl font-bold text-white mb-6">
              מוכן לחוות את העתיד של הלמידה?
            </h3>
            <p className="text-indigo-100 mb-8 text-lg">
              הצטרף לאלפי סטודנטים שכבר משתמשים ב-TachlesAI ומשפרים את הלמידה שלהם
            </p>
            <button className="bg-white text-indigo-600 px-8 py-4 rounded-xl hover:bg-indigo-50 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl font-medium text-lg">
              התחל להשתמש בחינם ←
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ComparisonTable;