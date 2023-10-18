import React from 'react';
import ReactDOM from 'react-dom/client';
import Game from './App';
import 'drag-drop-touch';
// import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));

// prevent zoom on mobile - not sure these will work
document.querySelector('meta[name="viewport"]').setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no");
// document.addEventListener("gesturestart", function (e) {
//     e.preventDefault();
//     document.body.style.zoom = 0.99;
// });
// document.addEventListener("gesturechange", function (e) {
//     e.preventDefault();
//
//     document.body.style.zoom = 0.99;
// });
// document.addEventListener("gestureend", function (e) {
//     e.preventDefault();
//     document.body.style.zoom = 1;
// });

root.render(
  <React.StrictMode>
    <Game />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
