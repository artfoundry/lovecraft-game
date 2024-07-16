import React from 'react';
import ReactDOM from 'react-dom/client';
import Game from './App';
import 'drag-drop-touch';
// import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
const testAttributes = {
    showLogin: true,
    showCharacterCreation: true,
    startingCharacters: ['privateEye', 'chemist', 'archaeologist'],
    startingLocation: 'catacombs'
};

// prevent zoom on mobile
document.querySelector('meta[name="viewport"]').setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no");

root.render(
  <React.StrictMode>
    <Game testAttributes={testAttributes} />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
