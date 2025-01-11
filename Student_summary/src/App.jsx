import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import SignupSuccess from './pages/SignupSuccess';
import YouTubeSummarizer from './pages/YouTubeSummarizer';

function App() {
  return (
    <GoogleOAuthProvider clientId="223517881477-ncfrafhp355dj8c3rc99a124jrgnf4f1.apps.googleusercontent.com">
      <Router>
        <div className="min-h-screen w-full bg-[#f0f4ff]">
          <Navbar />
          <main className="flex-grow pt-16">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/signup-success" element={<SignupSuccess />} />
              <Route path="/youtube-summary" element={<YouTubeSummarizer />} />
            </Routes>
          </main>
        </div>
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App;