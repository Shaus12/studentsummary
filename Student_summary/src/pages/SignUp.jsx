import React, { useState } from 'react';
import '../styles/SignUp.css';
import { useNavigate } from 'react-router-dom';
import '../styles/SignUp.css';
import API_BASE_URL from '../config';

function SignUp() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      alert('הסיסמאות אינן תואמות');
      return;
    }

    const requestData = {
      email: formData.email,
      password: formData.password,
      firstName: formData.firstName,
      lastName: formData.lastName
    };

    console.log('Sending signup data:', requestData);

    try {
      // Use XMLHttpRequest instead of fetch to bypass service worker
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/signup', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      
      xhr.onload = function() {
        console.log('Response status:', xhr.status);
        console.log('Response text:', xhr.responseText);
        
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.token) {
              localStorage.setItem('token', response.token);
              navigate('/dashboard');
            } else {
              alert('שגיאה בהרשמה: חסר טוקן');
            }
          } catch (e) {
            console.error('Error parsing response:', e);
            alert('שגיאה בעיבוד התגובה מהשרת');
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            alert(errorResponse.message || 'שגיאה בהרשמה');
          } catch (e) {
            alert('שגיאה בהרשמה');
          }
        }
      };
      
      xhr.onerror = function() {
        console.error('Request failed');
        alert('שגיאה בתקשורת עם השרת');
      };
      
      // Send the request
      xhr.send(JSON.stringify(requestData));
      
    } catch (error) {
      console.error('Signup error:', error);
      alert('שגיאה בהרשמה');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    console.log(`Updating ${name} to:`, value);
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="signup-container">
      <form className="signup-form" onSubmit={handleSubmit}>
        <h2>הרשמה</h2>
        
        <div className="form-group">
          <label htmlFor="firstName">שם פרטי:</label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            value={formData.firstName || ''}
            onChange={handleInputChange}
            placeholder="שם פרטי"
            required
            className="..."
          />
        </div>

        <div className="form-group">
          <label htmlFor="lastName">שם משפחה:</label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            value={formData.lastName || ''}
            onChange={handleInputChange}
            placeholder="שם משפחה"
            required
            className="..."
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">אימייל:</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email || ''}
            onChange={handleInputChange}
            placeholder="אימייל"
            required
            className="..."
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">סיסמה:</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password || ''}
            onChange={handleInputChange}
            placeholder="סיסמה"
            required
            className="..."
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">אימות סיסמה:</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword || ''}
            onChange={handleInputChange}
            placeholder="אימות סיסמה"
            required
            className="..."
          />
        </div>

        <button type="submit" className="...">
          הרשמה
        </button>
        
        <div className="login-link">
          כבר יש לך חשבון? <a href="/login">התחבר כאן</a>
        </div>
      </form>
    </div>
  );
}

export default SignUp; 