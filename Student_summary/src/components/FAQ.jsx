import React, { useState } from 'react';

const FAQ = () => {
  const [activeIndex, setActiveIndex] = useState(null);

  const faqData = [
    {
      question: "האם האתר מאובטח?",
      answer: "כן, ב-TachlesAI האבטחה שלך היא בעדיפות עליונה וכל המידע שלך מוצפן"
    },
    {
      question: "איזה סוג הרצאות אני יכול לסכם?",
      answer: "כל סוג של הרצאות שתצטרך"
    },
    {
      question: "אילו סוגי קבצי אודיו נתמכים?",
      answer: "כל סוגי קבצי האודיו וגם קישורי YouTube"
    },
    {
      question: "האם אני יכול לבטל בכל עת?",
      answer: "כן! בכל זמן שתרצה תוכל לבטל ללא שאלות מיותרות"
    },
    {
      question: "איך ליצור קשר עם התמיכה?",
      answer: "אנא צרו קשר באמצעות אימייל"
    },
    // שאלות נוספות
    {
      question: "כמה זמן לוקח לקבל סיכום?",
      answer: "הסיכומים מוכנים תוך דקות ספורות, תלוי באורך ההרצאה"
    },
    {
      question: "האם אפשר לערוך את הסיכומים?",
      answer: "כן, תוכל לערוך ולהתאים אישית את כל הסיכומים שתקבל"
    },
    {
      question: "האם יש הגבלה על כמות ההרצאות?",
      answer: "תלוי בחבילה שבחרת. יש לנו מגוון חבילות המתאימות לצרכים שונים"
    },
    {
      question: "באילו שפות האתר תומך?",
      answer: "האתר תומך בעברית ובאנגלית, עם תמיכה בשפות נוספות בקרוב"
    },
    {
      question: "האם אפשר לשתף סיכומים עם חברים?",
      answer: "כן, ניתן לשתף סיכומים בקלות עם חברים ועמיתים"
    },
    {
      question: "האם יש אפליקציה לנייד?",
      answer: "בקרוב! אנחנו עובדים על אפליקציה שתהיה זמינה ל-iOS ו-Android"
    },
    {
      question: "האם הסיכומים נשמרים לצפייה מאוחרת?",
      answer: "כן, כל הסיכומים נשמרים בחשבון שלך ונגישים בכל זמן"
    },
    {
      question: "האם יש תקופת ניסיון?",
      answer: "כן, אנחנו מציעים תקופת ניסיון חינם של 7 ימים"
    }
  ];

  const toggleAccordion = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    <div className="section faq-container">
      <h2 className="faq-title">שאלות נפוצות</h2>
      <div className="faq-list">
        {faqData.map((item, index) => (
          <div key={index} className="faq-item">
            <button
              className={`faq-question ${activeIndex === index ? 'active' : ''}`}
              onClick={() => toggleAccordion(index)}
            >
              {item.question}
              <span className="faq-icon">{activeIndex === index ? '-' : '+'}</span>
            </button>
            <div className={`faq-answer ${activeIndex === index ? 'active' : ''}`}>
              {item.answer}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FAQ;