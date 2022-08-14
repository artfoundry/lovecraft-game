import React from 'react';
import Map from './Map';
import './app.css';
import './map.css';
import './visualElements.css';
import './catacombs.css'
import './creature.css';

class Game extends React.Component {
  constructor() {
    super();

    this.state = {
      dialogClasses: 'dialog',
      dialogText: 'Find the stairs down to enter a new dungeon! Use mouse or arrow keys to move.',
      closeButtonText: 'Close',
      actionButtonVisible: false,
      actionButtonText: '',
      actionButtonCallback: null
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
            <div className="dialog-message">{this.state.dialogText}</div>
            <div className="dialog-buttons">
              <button className="dialog-button" onClick={this.closeDialog}>{this.state.closeButtonText}</button>
              <button className={`dialog-button ${this.state.actionButtonVisible ? '' : 'hide'}`}
                      onClick={() => {
                        this.state.actionButtonCallback();
                        this.closeDialog();
                      }}>{this.state.actionButtonText}</button>
            </div>
          </div>

          <Map showDialogProp={this.showDialog} />
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
