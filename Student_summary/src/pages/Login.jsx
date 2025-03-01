import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import API_BASE_URL from '../config';

function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setSuccess(true);
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
    } finally {
      setIsLoading(false);
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
      const response = await fetch(`${API_BASE_URL}/api/google-login`, {
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
    <div className="login-page" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: '#f0f4f8',
      padding: '0',
      margin: '0'
    }}>
      <div style={{
        width: '100%',
        height: '100vh',
        backgroundColor: 'white',
        padding: '40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <h2 style={{
          fontSize: '32px',
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: '40px',
          color: '#1a365d'
        }}>
          התחברות לחשבון
        </h2>

        <div style={{
          width: '100%',
          maxWidth: '400px',
          margin: '0 auto'
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {error && (
              <div style={{
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                padding: '16px',
                borderRadius: '8px',
                textAlign: 'center',
                fontSize: '16px'
              }}>
                {error}
              </div>
            )}

            {success && (
              <div style={{
                backgroundColor: '#dcfce7',
                color: '#16a34a',
                padding: '16px',
                borderRadius: '8px',
                textAlign: 'center',
                fontSize: '16px'
              }}>
                התחברת בהצלחה! מעביר אותך לדף הבית...
              </div>
            )}

            <div>
              <label style={{
                display: 'block',
                marginBottom: '10px',
                textAlign: 'right',
                fontSize: '16px',
                color: '#374151'
              }}>
                אימייל
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '14px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  outline: 'none',
                  fontSize: '16px',
                  transition: 'border-color 0.2s',
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '10px',
                textAlign: 'right',
                fontSize: '16px',
                color: '#374151'
              }}>
                סיסמה
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '14px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  outline: 'none',
                  fontSize: '16px',
                  transition: 'border-color 0.2s',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || success}
              style={{
                backgroundColor: isLoading || success ? '#93c5fd' : '#2563eb',
                color: 'white',
                padding: '16px',
                borderRadius: '8px',
                border: 'none',
                cursor: isLoading || success ? 'not-allowed' : 'pointer',
                marginTop: '20px',
                fontSize: '16px',
                fontWeight: 'bold',
                transition: 'background-color 0.2s'
              }}
            >
              {isLoading ? 'מתחבר...' : 'התחבר'}
            </button>
          </form>

          <div style={{
            margin: '40px 0',
            textAlign: 'center',
            position: 'relative'
          }}>
            <div style={{
              borderBottom: '1px solid #e5e7eb',
              position: 'absolute',
              width: '100%',
              top: '50%'
            }}></div>
            <span style={{
              backgroundColor: 'white',
              padding: '0 20px',
              color: '#6b7280',
              position: 'relative',
              fontSize: '16px'
            }}>
              או המשך עם
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('שגיאה בהתחברות עם גוגל')}
              theme="outline"
              size="large"
              text="continue_with"
              useOneTap
            />
          </div>

          <p style={{ 
            textAlign: 'center', 
            color: '#6b7280',
            fontSize: '16px'
          }}>
            אין לך חשבון?{' '}
            <Link to="/signup" style={{ 
              color: '#2563eb', 
              textDecoration: 'none',
              fontWeight: 'bold'
            }}>
              הרשם עכשיו
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login; 