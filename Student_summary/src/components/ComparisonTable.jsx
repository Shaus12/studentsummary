import React from 'react';

const ComparisonTable = () => {
  const features = [
    { name: 'איכות הסיכום', with: 'סיכום מדויק ותמציתי של כל החומר', without: 'החמצה של פרטים חשובים' },
    { name: 'זמינות', with: 'זמין 24/7 לכל סיכום שתצטרכו', without: 'תלוי בסיכומים של אחרים' },
    { name: 'התאמה אישית', with: 'התאמה מושלמת לסגנון הלמידה שלכם', without: 'פורמט קבוע ולא גמיש' },
    { name: 'חווית למידה', with: 'למידה אינטראקטיבית וחכמה', without: 'למידה טכנית ומונוטונית' },
    { name: 'עזרה נוספת', with: 'בינה מלאכותית מתקדמת שעונה על כל שאלה', without: 'מוגבל לתוכן הסיכום בלבד' }
  ];

  return (
    <div className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl font-bold text-center mb-12">
          סיכום בלי TachlesAI VS סיכום עם TachlesAI
        </h2>
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-right">קריטריון</th>
                <th className="px-6 py-3 text-right text-indigo-600">עם TachlesAI</th>
                <th className="px-6 py-3 text-right text-red-500">בלי TachlesAI</th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature, index) => (
                <tr key={index} className="border-t">
                  <td className="px-6 py-4 font-medium">{feature.name}</td>
                  <td className="px-6 py-4 text-indigo-600">{feature.with}</td>
                  <td className="px-6 py-4 text-red-500">{feature.without}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ComparisonTable;