import React from 'react';
import './HowItWorks.css';
import { FiUpload, FiStar, FiBook } from 'react-icons/fi';

const HowItWorks = () => {
  const steps = [
    {
      icon: <FiUpload />,
      title: 'העלה את החומר',
      description: 'העלה קובץ PDF, הקלטה או קישור ליוטיוב',
      number: '1'
    },
    {
      icon: <FiStar />,
      title: 'הבינה המלאכותית מעבדת',
      description: 'המערכת מנתחת את החומר ומייצרת תוכן מותאם אישית',
      number: '2'
    },
    {
      icon: <FiBook />,
      title: 'התחל ללמוד',
      description: 'קבל סיכומים, שאלות תשובות, והסברים מותאמים אישית',
      number: '3'
    }
  ];

  return (
    <section className="how-it-works">
      <h2 className="section-title">איך זה עובד?</h2>
      <p className="section-subtitle">בשלושה צעדים פשוטים תוכל להתחיל ללמוד בצורה חכמה יותר</p>
      
      <div className="steps-container">
        {steps.map((step, index) => (
          <div key={index} className="step-card">
            <div className="step-number">{step.number}</div>
            <div className="step-icon">{step.icon}</div>
            <h3 className="step-title">{step.title}</h3>
            <p className="step-description">{step.description}</p>
          </div>
        ))}
      </div>
      
      <div className="flex justify-center">
        <button className="cta-button px-6 py-3 text-base font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 w-64">
          התחל עכשיו בחינם
        </button>
      </div>
    </section>
  );
};

export default HowItWorks;