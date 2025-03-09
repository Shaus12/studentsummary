import './unregisterServiceWorker';

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(registration => {
    registration.unregister().then(() => {
      console.log('Service worker successfully unregistered');
      window.location.reload(); // Force reload after unregistration
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);