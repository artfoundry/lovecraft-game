import React from 'react';
import Map from './Map';
import Character from "./Character";
import PlayerCharacterTypes from './playerCharacterTypes.json';
import UI from './UI';
import './css/app.css';
import './css/map.css';
import './css/visualElements.css';
import './css/catacombs.css'
import './css/creatures.css';
import './css/playerCharacters.css';

class Game extends React.Component {
  constructor() {
    super();

    this.state = {
      allPCs: {privateEye: new Character(PlayerCharacterTypes['privateEye'])},
      activePC: 'privateEye',
      dialogClasses: 'dialog',
      dialogText: 'Find the stairs down to enter a new dungeon! Use mouse or arrow keys to move and space bar to open/close doors.',
      closeButtonText: 'Close',
      actionButtonVisible: false,
      actionButtonText: '',
      actionButtonCallback: null,
      characterIsSelected: false,
      creatureIsSelected: false,
      characterInfoText: '',
      controlsContent: '',
      pcTypes: PlayerCharacterTypes,
      currentLocation: 'catacombs',
      logText: []
    }
  }

  showDialog = (dialogText, closeButtonText, actionButtonVisible, actionButtonText, actionButtonCallback) => {
    this.setState({
      dialogClasses: 'dialog',
      dialogText,
      closeButtonText,
      actionButtonVisible,
      actionButtonText,
      actionButtonCallback
    });
  }

  closeDialog = () => {
    this.setState({dialogClasses: 'hide'});
  }

  updateLog = (logText) => {
    this.setState(prevState => ({
      logText: [...prevState.logText, logText]
    }));
  }

  updateCharIsSelected = (type, status) => {
    const storageName = type === 'player' ? 'characterIsSelected' : 'creatureIsSelected';
    this.setState({[storageName]: status});
  }

  render() {
    return (
        <div className="game">
          <div className={this.state.dialogClasses}>
            <div className="dialog-message">{this.state.dialogText} <br /><br /> PC: {`${this.state.allPCs[this.state.activePC].name}, ${this.state.allPCs[this.state.activePC].profession}`}</div>
            <div className="dialog-buttons">
              <button className="dialog-button" onClick={this.closeDialog}>{this.state.closeButtonText}</button>
              <button className={`dialog-button ${this.state.actionButtonVisible ? '' : 'hide'}`}
                      onClick={() => {
                        this.state.actionButtonCallback();
                        this.closeDialog();
                      }}>{this.state.actionButtonText}</button>
            </div>
          </div>

          <UI
              logTextProp={this.state.logText}
              characterInfoTextProp={this.state.characterInfoText}
              controlsContentProp={this.state.controlsContent}
              characterIsSelectedProp={this.state.characterIsSelected}
              creatureIsSelectedProp={this.state.creatureIsSelected}
          />

          <Map
              showDialogProp={this.showDialog}
              pcTypesProp={this.state.pcTypes}
              playerCharsProp={this.state.allPCs}
              activeCharProp={this.state.activePC}
              locationProp={this.state.currentLocation}
              logUpdateProp={this.updateLog}
              charIsSelectedProp={this.updateCharIsSelected}
          />

        </div>
    );
  }
}

function App() {
  return (
      <Game />
  );
}

export default App;
