import React from 'react';
import ReactDOM from 'react-dom/client';
import Game from './App';
import 'drag-drop-touch';
// import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
// chars: privateEye, chemist, archaeologist, doctor, priest, veteran, thief, occultResearcher
const bareBonesAttr = {
    showLogin: false,
    showCharacterCreation: false,
    startingCharacters: ['privateEye', 'chemist', 'archaeologist'],
    startingLocation: 'catacombs',
    playMusic: false,
    spawnCreatures: false
};
const testAttributes = {
    showLogin: false,
    showCharacterCreation: false,
    startingCharacters: ['privateEye', 'chemist', 'archaeologist'],
    startingLocation: 'catacombs',
    playMusic: false,
    spawnCreatures: true
};
const prodAttributes = {
    forProduction: true,
    showLogin: true,
    showCharacterCreation: true,
    startingCharacters: ['privateEye', 'chemist', 'archaeologist'],
    startingLocation: 'catacombs',
    playMusic: true,
    spawnCreatures: true
};

// prevent zoom on mobile
document.querySelector('meta[name="viewport"]').setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no");

root.render(
  <React.StrictMode>
    <Game gameAttributes={prodAttributes} />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
