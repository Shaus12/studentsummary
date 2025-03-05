import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import SignupSuccess from './pages/SignupSuccess';
import StudentDashboard from './pages/StudentDashboard';
import SummaryResult from './pages/SummaryResult';

function App() {
  return (
    <GoogleOAuthProvider clientId="223517881477-ncfrafhp355dj8c3rc99a124jrgnf4f1.apps.googleusercontent.com">
      <BrowserRouter>
        <div className="min-h-screen bg-white">
          <Navbar />
          <div className="pt-16">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/signup-success" element={<SignupSuccess />} />
              <Route path="/dashboard" element={<StudentDashboard />} />
              <Route path="/summary-result" element={<SummaryResult />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;