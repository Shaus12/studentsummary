import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import '../styles/Login.css';

function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    
    try {
      const response = await fetch('http://localhost:5001/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        // Store the token in localStorage
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Show success message
        setSuccess(true);

        // Redirect to main page after 2 seconds
        setTimeout(() => {
          navigate('/');
          window.location.reload();
        }, 2000);
      } else {
        setError(data.message || 'שגיאה בהתחברות');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('שגיאה בהתחברות');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const response = await fetch('http://localhost:5001/api/google-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential: credentialResponse.credential
        })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setSuccess(true);
        
        // Redirect to home page after 2 seconds
        setTimeout(() => {
          navigate('/');
          window.location.reload();
        }, 2000);
      } else {
        setError(data.message || 'שגיאה בהתחברות עם גוגל');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('שגיאה בהתחברות עם גוגל');
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>התחברות</h2>
        
        {error && (
          <div className="error-message text-red-500 mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="success-message text-green-500 mb-4">
            התחברת בהצלחה! מעביר אותך לדף הבית...
          </div>
        )}

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

        <button 
          type="submit" 
          disabled={success}
          className={success ? 'bg-gray-400' : ''}
        >
          התחבר
        </button>

        <div className="mt-4 text-center">
          <p className="text-gray-600 mb-2">או</p>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {
              setError('שגיאה בהתחברות עם גוגל');
            }}
            theme="outline"
            size="large"
            text="continue_with"
            useOneTap
          />
        </div>

        <div className="signup-link">
          אין לך חשבון? <Link to="/signup" className="text-indigo-600 hover:text-indigo-700">הרשם כאן</Link>
        </div>
      </form>
    </div>
  );
}

export default Login; 