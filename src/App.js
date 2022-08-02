import React from 'react';
import Map from './Map';
import './App.css';
import './Map.css';
import './VisualElements.css';
import './Creature.css';

class Game extends React.Component {
  constructor() {
    super();

    this.state = {
      noticeClasses: 'notice'
    }
  }

  closeNotice = () => {
    this.setState({noticeClasses: 'hide'});
  }

  render() {
    return (
        <div className="game">
          <div className={this.state.noticeClasses}>
            <div className="notice-message">Find the stairs down to enter a new dungeon! Use mouse or arrow keys to move.</div>
            <button className="notice-button" onClick={this.closeNotice}>Close</button>
          </div>

          <Map />
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
