import React from 'react';
import Map from './Map';
import PlayerCharacterTypes from './playerCharacterTypes.json';
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
      startingPC: 'privateEye',
      activePC: 'privateEye',
      dialogClasses: 'dialog',
      dialogText: 'Find the stairs down to enter a new dungeon! Use mouse or arrow keys to move and space bar to open/close doors.',
      closeButtonText: 'Close',
      actionButtonVisible: false,
      actionButtonText: '',
      actionButtonCallback: null,
      pcTypes: PlayerCharacterTypes,
      currentLocation: 'catacombs'
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

  render() {
    return (
        <div className="game">
          <div className={this.state.dialogClasses}>
            <div className="dialog-message">{this.state.dialogText} <br /><br /> PC: {`${this.state.pcTypes[this.state.startingPC].name}, ${this.state.pcTypes[this.state.startingPC].profession}`}</div>
            <div className="dialog-buttons">
              <button className="dialog-button" onClick={this.closeDialog}>{this.state.closeButtonText}</button>
              <button className={`dialog-button ${this.state.actionButtonVisible ? '' : 'hide'}`}
                      onClick={() => {
                        this.state.actionButtonCallback();
                        this.closeDialog();
                      }}>{this.state.actionButtonText}</button>
            </div>
          </div>

          <Map
              showDialogProp={this.showDialog}
              pcTypesProp={this.state.pcTypes}
              playerCharsProp={this.state.startingPC}
              activeCharProp={this.state.activePC}
              locationProp={this.state.currentLocation} />
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
