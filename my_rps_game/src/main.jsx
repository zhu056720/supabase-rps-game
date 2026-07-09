import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx'; // 修正 Canvas 編譯路徑：在 Canvas 預覽環境中 App.jsx 位於根目錄，故使用 ../App.jsx

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);