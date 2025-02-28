import React from 'react';
import './StudentStories.css';

const StudentStories = () => {
  const stories = [
    {
      quote: '"TachlesAI עזר לי להבין את החומר הרבה יותר טוב. הסיכומים האוטומטיים חסכו לי שעות של עבודה"',
      name: 'רון כהן',
      title: 'סטודנט לכלכלה, אוניברסיטת תל אביב',
      avatar: 'https://randomuser.me/api/portraits/men/1.jpg'
    },
    {
      quote: '"פעם הייתי יושבת שעות, מסכמת, מתחרפנת, היום אני מעלה את ההרצאה שותה כוס קפה והסיכום/תמלול שלי מוכן"',
      name: 'מיכל לוי',
      title: 'סטודנטית למשפטים, האוניברסיטה העברית',
      avatar: 'https://randomuser.me/api/portraits/women/1.jpg'
    },
    {
      quote: '"התואר שלי עמוס ביותר ואני בן 23, נמאס לי לא לבלות בסופי שבוע רק בגלל שאני צריך להשלים חומר, סוף סוף לא אצטרך לדאוג מזה יותר"',
      name: 'דניאל אברהם',
      title: 'סטודנט להנדסה, הטכניון',
      avatar: 'https://randomuser.me/api/portraits/men/2.jpg'
    }
  ];

  return (
    <section className="student-stories">
      <h2 className="section-title">סטודנטים מספרים</h2>
      <p className="section-subtitle">הצצה לסטודנטים שכבר משתמשים ב-TachlesAI כדי ללמוד בצורה חכמה יותר</p>
      
      <div className="stories-container">
        {stories.map((story, index) => (
          <div key={index} className="story-card">
            <p className="quote">{story.quote}</p>
            <div className="author">
              <img src={story.avatar} alt={story.name} className="avatar" />
              <div className="author-info">
                <h3 className="author-name">{story.name}</h3>
                <p className="author-title">{story.title}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default StudentStories;