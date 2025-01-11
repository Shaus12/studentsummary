import React from 'react';
import { FaRegSadTear, FaRegSmileBeam } from 'react-icons/fa';

const ComparisonTable = () => {
  return (
    <div className="bg-gradient-to-b from-blue-50 to-indigo-100 py-16">
      <div className="container mx-auto px-4 max-w-6xl text-right">
        <h2 className="text-4xl font-bold mb-12 text-indigo-600 text-center">
          2024 מול 2025
        </h2>
        <div className="overflow-hidden rounded-xl shadow-lg bg-white">
          <table className="min-w-full text-gray-800">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-500 to-indigo-700 text-white">
                <th className="py-6 px-8 text-lg font-semibold text-center">
                  <div className="flex justify-center items-center space-x-2 rtl:space-x-reverse">
                    <FaRegSadTear className="text-2xl" />
                    <span>2024</span>
                  </div>
                </th>
                <th className="py-6 px-8 text-lg font-semibold text-center">
                  <div className="flex justify-center items-center space-x-2 rtl:space-x-reverse">
                    <FaRegSmileBeam className="text-2xl" />
                    <span>2025</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b hover:bg-indigo-50 transition duration-300">
                <td className="py-6 px-8 text-lg font-light leading-relaxed">
                  אם היית מפספס שיעור, היית צריך לחכות שנופר תשלח סיכומים בקבוצה. אם
                  נופר חולה, הלך עלייך.
                </td>
                <td className="py-6 px-8 text-lg font-light leading-relaxed">
                  אתה משתמש ב-TachlesAI ומסכם את ההרצאה בלי אפילו לראות אותה.
                </td>
              </tr>
              <tr className="border-b hover:bg-indigo-50 transition duration-300">
                <td className="py-6 px-8 text-lg font-light leading-relaxed">
                  אם היית רוצה לתמלל הרצאה, בהצלחה.
                </td>
                <td className="py-6 px-8 text-lg font-light leading-relaxed">
                  TachlesAI אשכרה עושה את זה בשבילך.
                </td>
              </tr>
              <tr className="border-b hover:bg-indigo-50 transition duration-300">
                <td className="py-6 px-8 text-lg font-light leading-relaxed">
                  אם היית לא מבין משהו מקובץ PDF היית צריך לשלוח מייל למרצה ולחכות
                  שבועיים למענה.
                </td>
                <td className="py-6 px-8 text-lg font-light leading-relaxed">
                  הצ'אט החכם נותן לך מענה בשניה (ואפילו לא ינוח עד שלא תבין את
                  החומר).
                </td>
              </tr>
              <tr className="hover:bg-indigo-50 transition duration-300">
                <td className="py-6 px-8 text-lg font-light leading-relaxed">
                  לפני שהיית מתכונן למבחן, היית לומד את השאלות ממבחני עבר, וכשסיימת
                  אותם, זהו.
                </td>
                <td className="py-6 px-8 text-lg font-light leading-relaxed">
                  אתה מקבל אקסטרה שאלות שיעזרו לך לקבל את הציון הכי גבוה שתוכל
                  לקבל.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ComparisonTable;
