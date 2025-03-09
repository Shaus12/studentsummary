import React, { useState } from 'react';
import '../styles/SignUp.css';
import { useNavigate } from 'react-router-dom';
import '../styles/SignUp.css';
import API_BASE_URL from '../config';

function SignUp() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Log the form data
    console.log('Raw form data:', {
      ...formData,
      password: '[REDACTED]',
      confirmPassword: '[REDACTED]'
    });

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

    // Log the request details
    const url = `${API_BASE_URL}/api/signup`;
    console.log('Request URL:', url);
    console.log('Request data:', {
      ...requestData,
      password: '[REDACTED]'
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      // Log the response details
      console.log('Response status:', response.status);
      const responseText = await response.text();
      console.log('Response text:', responseText);

      if (response.ok) {
        navigate('/signup-success');
      } else {
        try {
          const errorData = JSON.parse(responseText);
          console.error('Error data:', errorData);
          alert(errorData.message || 'שגיאה בהרשמה');
        } catch (e) {
          console.error('Error parsing response:', responseText);
          alert('שגיאה בהרשמה');
        }
      }
    } catch (error) {
      console.error('Network error:', error);
      alert('שגיאה בהרשמה');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
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
            value={formData.firstName}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="lastName">שם משפחה:</label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">אימייל:</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">סיסמה:</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">אימות סיסמה:</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
          />
        </div>

        <button type="submit">הרשם</button>
        
        <div className="login-link">
          כבר יש לך חשבון? <a href="/login">התחבר כאן</a>
        </div>
      </form>
    </div>
  );
}

export default SignUp; 