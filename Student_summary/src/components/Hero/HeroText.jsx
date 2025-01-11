import React, { useState, useEffect } from 'react';
import './Hero.css'; // Ensure the CSS file is linked.

const TypewriterHeader = () => {
  const phrases = [
    'תפסיק לבזבז שעות על כתיבת סיכומים😊',
    'פה לומדים רק את התכלס',
    'למה שתסכם לבד אם יש היום AI?',
    'חלאס לסופ"שים של השלמות חומר'
  ];

  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopIndex, setLoopIndex] = useState(0);
  const [typingSpeed, setTypingSpeed] = useState(150);

  useEffect(() => {
    const handleTyping = () => {
      const currentPhrase = phrases[loopIndex % phrases.length];
      if (!isDeleting) {
        setCurrentText((prev) => currentPhrase.substring(0, prev.length + 1));
        if (currentText === currentPhrase) {
          setTimeout(() => setIsDeleting(true), 2000); // Pause before deleting
        }
      } else {
        setCurrentText((prev) => currentPhrase.substring(0, prev.length - 1));
        if (currentText === '') {
          setIsDeleting(false);
          setLoopIndex((prev) => prev + 1);
        }
      }
    };

    const timer = setTimeout(handleTyping, typingSpeed);

    return () => clearTimeout(timer);
  }, [currentText, isDeleting, loopIndex, phrases, typingSpeed]);

  useEffect(() => {
    setTypingSpeed(isDeleting ? 50 : 100);
  }, [isDeleting]);

  return (
    <div className="typewriter-hero">
      <header className="typewriter-header">
        <h1 className="text-4xl font-bold mb-6 text-indigo-600">
          {currentText}
          <span className="cursor-static">|</span> {/* Static cursor */}
        </h1>
      </header>
      <p className="hero-subtitle">
        סטודנטים - סוף סוף בשנת 2025 הגיע הזמן שלכם להפסיק לקרוע את התחת, ולהתחיל להספיק לעשות את הדברים שאתם באמת רוצים.
      </p>
      <button className="hero-button">
        הירשם בחינם/התחבר ←
      </button>
    </div>
  );
};

export default TypewriterHeader;