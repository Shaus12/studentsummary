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

    console.log('Form submitted', requestData);
    console.log('Sending request to server...');

    try {
      const response = await fetch(`${API_BASE_URL}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      console.log('Response received:', response);
      
      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          localStorage.setItem('token', data.token);
          navigate('/dashboard');
        } else {
          throw new Error('No token in response');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Signup failed');
      }
    } catch (error) {
      console.error('Signup error:', error);
      alert(`שגיאה בהרשמה: ${error.message}`);
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