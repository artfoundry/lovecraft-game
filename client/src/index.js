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
    startingCharacters: ['privateEye', 'doctor', 'priest'],
    startingLocation: 'catacombs',
    startingFloor: 1,
    playMusic: false,
    spawnCreatures: false,
    skipIntroConversation: true
};
const dungeonTestAttributes = {
    showLogin: false,
    showCharacterCreation: false,
    startingCharacters: ['privateEye', 'archaeologist', 'veteran'],
    startingLocation: 'catacombs',
    startingFloor: 1,
    playMusic: false,
    spawnCreatures: true
};
const worldTestAttributes = {
    showLogin: false,
    showCharacterCreation: false,
    startingCharacters: ['privateEye'],
    startingLocation: 'museum',
    startingFloor: 1,
    playMusic: false,
    spawnCreatures: true,
    skipIntroConversation: false
};
const prodAttributes = {
    forProduction: true,
    showLogin: true,
    showCharacterCreation: true,
    startingCharacters: ['privateEye'],
    startingLocation: 'museum',
    startingFloor: 1,
    playMusic: true,
    spawnCreatures: true,
    skipIntroConversation: false
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
