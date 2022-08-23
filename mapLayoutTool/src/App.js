import React from 'react';
import io from 'socket.io-client';
import './app.css';
import './tiles.css';
const FILE_SERVER = 'http://localhost:4000';

function GridCell(props) {
	return <img id={props.idProp} className={'grid-cell' + props.classesProp} style={props.styleProp} onMouseUp={props.mouseUpProp} />;
}

class Tool extends React.Component {
	constructor() {
		super();

		this.tileSize = 32;
		this.pieceData = {};

		this.socket = io(FILE_SERVER);
		this.socket.on('connect', () => {
			console.log('Connected to server');
		});
		this.socket.on('connect-error', (error) => {
			console.log('Error connecting to server: ', error);
		});

		this.state = {
			pieces: [],
			gridCellNames: {},
			gridCellNamesDone: false
		};
	}

	populateCellsState() {
		let cells = {};
		for (let r = 0; r < 15; r++) {
			for (let c = 0; c < 15; c++) {
				cells[r + '-' + c] = '';
			}
		}
		this.setState({gridCellNames: cells, gridCellNamesDone: true});
	}

	layoutGrid() {
		let gridCellEls = [];
		const layoutRow = (r) => {
			let row = [];
			for (let c = 0; c < 15; c++) {
				const id = r + '-' + c;
				const classes = this.state.gridCellNames[id] === '' ? this.state.gridCellNames[id] : ` tiles ${this.state.gridCellNames[id]}`;
				row.push(<GridCell
					key={id}
					idProp={id}
					mouseUpProp={e => {this.insertTile(e)}}
					classesProp={classes}
					styleProp={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
				);
			}
			return row;
		}
		for (let r = 0; r < 15; r++) {
			gridCellEls.push(<div key={r} className="grid-row" style={{height: this.tileSize + 'px'}}>{layoutRow(r)}</div>);
		}
		return gridCellEls;
	}

	populatePieceList = () => {

	}

	showPiece() {

	}

	insertTile = (e) => {
		e.preventDefault();
		const tileType = e.target.classList[1];
		let coords = '';
		let firstAvail = '';

		for (const [pos, name] of Object.entries(this.state.gridCellNames)) {
			if (name === '') {
				firstAvail = pos;
				break;
			}
		}

		// if click, user is inserting a new tile
		if (e.type === 'click') {
			if (this.state.gridCellNames['0-0'] === '') {
				coords = '0-0';
			} else if (firstAvail === '') {
				alert('All grid spaces full. Delete one first.');
				return;
			} else {
				coords = firstAvail;
			}
		// user is moving a tile
		} else if (e.type === 'mouseUp') {
			coords = e.target.id;
		}

		this.setState(prevState => ({
			gridCellNames: {...prevState.gridCellNames, [coords]: tileType}
		}));
	}

	componentDidMount() {
		this.populateCellsState();
		this.populatePieceList();
	}

	render() {
		return (
			<div className="tool-container" style={{gridTemplateColumns: `auto ${this.tileSize * 15 + 'px'} auto`}}>
				<div className="tiles-container">
					<div>
						<img className="tiles top-left-wall" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						top-left-wall
					</div>
					<div>
						<img className="tiles top-wall-one" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						top-wall-one
					</div>
					<div>
						<img className="tiles top-wall-two" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						top-wall-two
					</div>
					<div>
						<img className="tiles top-wall-three" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						top-wall-three
					</div>
					<div>
						<img className="tiles top-wall-four" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						top-wall-four
					</div>
					<div>
						<img className="tiles top-right-wall" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						top-right-wall
					</div>
					<div>
						<img className="tiles left-wall" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						left-wall
					</div>
					<div>
						<img className="tiles right-wall" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						right-wall
					</div>
					<div>
						<img className="tiles bottom-left-wall" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						bottom-left-wall
					</div>
					<div>
						<img className="tiles bottom-wall-one" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						bottom-wall-one
					</div>
					<div>
						<img className="tiles bottom-wall-two" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						bottom-wall-two
					</div>
					<div>
						<img className="tiles bottom-wall-three" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						bottom-wall-three
					</div>
					<div>
						<img className="tiles bottom-wall-four" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						bottom-wall-four
					</div>
					<div>
						<img className="tiles bottom-right-wall" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						bottom-right-wall
					</div>
					<div>
						<img className="tiles bottom-left-inverse-wall" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						bottom-left-inverse-wall
					</div>
					<div>
						<img className="tiles bottom-right-inverse-wall" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						bottom-right-inverse-wall
					</div>
					<div>
						<img className="tiles top-left-inverse-wall" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						top-left-inverse-wall
					</div>
					<div>
						<img className="tiles top-right-inverse-wall" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						top-right-inverse-wall
					</div>
					<div>
						<img className="tiles T-shaped-wall" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						T-shaped-wall
					</div>
					<div>
						<img className="tiles left-door" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						left-door
					</div>
					<div>
						<img className="tiles right-door" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						right-door
					</div>
					<div>
						<img className="tiles top-bottom-door" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						top-bottom-door
					</div>
					<div>
						<img className="tiles floor-one" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						floor-one
					</div>
					<div>
						<img className="tiles floor-two" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						floor-two
					</div>
					<div>
						<img className="tiles floor-three" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						floor-three
					</div>
					<div>
						<img className="tiles floor-four" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						floor-four
					</div>
					<div>
						<img className="tiles floor-five" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						floor-five
					</div>
					<div>
						<img className="tiles floor-six" onClick={e => this.insertTile(e)} style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
						floor-six
					</div>
				</div>
				<div className="existing-pieces">
					<h3>Existing Pieces</h3>
					{this.state.pieces}
				</div>
				<div className="grid">
					{this.state.gridCellNamesDone && this.layoutGrid()}
				</div>
				<div className="parameters">
					<h3>Tile Parameters</h3>
				</div>
			</div>
		);
	}
}

function App() {
	return (
		<Tool />
	);
}

export default App;
