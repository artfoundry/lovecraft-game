import React from 'react';
import io from 'socket.io-client';
import './app.css';
import './tiles.css';
const FILE_SERVER = 'http://localhost:4000';

function GridCell(props) {
	return <img id={props.idProp} className={'grid-cell' + props.classesProp} style={props.styleProp} onMouseUp={props.clickProp} />;
}

class Tool extends React.Component {
	constructor() {
		super();

		this.tileSize = 32;
		this.tileData = {
			'top-left-wall': {
				classes: 'top-left-wall',
				type: 'wall',
				walkable: false,
				topSide: 'wall',
				rightSide: 'wall',
				bottomSide: 'wall',
				leftSide: 'wall'
			},
			'top-wall': {
				classes: 'top-wall',
				type: 'wall',
				walkable: false,
				topSide: 'wall',
				rightSide: 'wall',
				bottomSide: 'wall',
				leftSide: 'wall'
			},
			'top-right-wall': {
				classes: 'top-right-wall',
				type: 'wall',
				walkable: false,
				topSide: 'wall',
				rightSide: 'wall',
				bottomSide: 'wall',
				leftSide: 'wall'
			},
			'left-wall': {
				classes: 'left-wall',
				type: 'wall',
				walkable: false,
				topSide: 'wall',
				rightSide: 'wall',
				bottomSide: 'wall',
				leftSide: 'wall'
			},
			'right-wall': {
				classes: 'right-wall',
				type: 'wall',
				walkable: false,
				topSide: 'wall',
				rightSide: 'wall',
				bottomSide: 'wall',
				leftSide: 'wall'
			},
			'bottom-left-wall': {
				classes: 'bottom-left-wall',
				type: 'wall',
				walkable: false,
				topSide: 'wall',
				rightSide: 'wall',
				bottomSide: 'wall',
				leftSide: 'wall'
			},
			'bottom-wall': {
				classes: 'bottom-wall',
				type: 'wall',
				walkable: false,
				topSide: 'wall',
				rightSide: 'wall',
				bottomSide: 'wall',
				leftSide: 'wall'
			},
			'bottom-right-wall': {
				classes: 'bottom-right-wall',
				type: 'wall',
				walkable: false,
				topSide: 'wall',
				rightSide: 'wall',
				bottomSide: 'wall',
				leftSide: 'wall'
			},
			'bottom-left-inverse-wall': {
				classes: 'bottom-left-inverse-wall',
				type: 'wall',
				walkable: false,
				topSide: 'wall',
				rightSide: 'wall',
				bottomSide: 'wall',
				leftSide: 'wall'
			},
			'bottom-right-inverse-wall': {
				classes: 'bottom-right-inverse-wall',
				type: 'wall',
				walkable: false,
				topSide: 'wall',
				rightSide: 'wall',
				bottomSide: 'wall',
				leftSide: 'wall'
			},
			'top-left-inverse-wall': {
				classes: 'top-left-inverse-wall',
				type: 'wall',
				walkable: false,
				topSide: 'wall',
				rightSide: 'wall',
				bottomSide: 'wall',
				leftSide: 'wall'
			},
			'top-right-inverse-wall': {
				classes: 'top-right-inverse-wall',
				type: 'wall',
				walkable: false,
				topSide: 'wall',
				rightSide: 'wall',
				bottomSide: 'wall',
				leftSide: 'wall'
			},
			'T-shaped-wall': {
				classes: 'T-shaped-wall',
				type: 'wall',
				walkable: false,
				topSide: 'wall',
				rightSide: 'wall',
				bottomSide: 'wall',
				leftSide: 'wall'
			},
			'floor': {
				classes: 'floor',
				type: 'floor',
				walkable: true,
				topSide: '',
				rightSide: '',
				bottomSide: '',
				leftSide: ''
			},
			'left-door': {
				classes: 'left-door',
				type: 'door',
				walkable: true,
				topSide: 'wall',
				rightSide: '',
				bottomSide: 'wall',
				leftSide: ''
			},
			'right-door': {
				classes: 'right-door',
				type: 'door',
				walkable: true,
				topSide: 'wall',
				rightSide: '',
				bottomSide: 'wall',
				leftSide: ''
			},
			'top-bottom-door': {
				classes: 'top-bottom-door',
				type: 'door',
				walkable: true,
				topSide: '',
				rightSide: 'wall',
				bottomSide: '',
				leftSide: 'wall'
			}
		}
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
			gridCellNamesDone: false,
			tileNameSelected: '',
			gridTileIdSelected: ''
		};
	}

	populateCellsState() {
		let cells = {};
		for (let r = 0; r < 15; r++) {
			for (let c = 0; c < 15; c++) {
				cells[r + '-' + c] = {};
			}
		}
		this.setState({gridCellNames: cells, gridCellNamesDone: true});
	}

	layoutTiles() {
		let tiles = [];
		for (const tileName of Object.keys(this.tileData)) {
			tiles.push(
				<div key={tileName}>
					<img className={'tiles ' + tileName + (this.state.tileNameSelected === tileName && !this.state.gridTileIdSelected ? ' selected' : '')}
					     onClick={e => {
						     this.selectTile(e.target.classList[1], '');
					     }}
					     style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}}
					/>
					{tileName}
				</div>
			)
		}
		return tiles;
	}

	layoutGrid() {
		let gridCellEls = [];
		const layoutRow = (r) => {
			let row = [];
			for (let c = 0; c < 15; c++) {
				const id = r + '-' + c;
				let classes = (this.state.tileNameSelected === this.state.gridCellNames[id].classes && this.state.gridTileIdSelected === id) ? ' selected' : '';
				classes += Object.keys(this.state.gridCellNames[id]).length === 0 ?
					this.state.gridCellNames[id] :
					` tiles ${this.state.gridCellNames[id].classes}`;
				row.push(<GridCell
					key={id}
					idProp={id}
					clickProp={e => {
						if (e.target.classList.contains('tiles') &&
							(this.state.tileNameSelected === '' || this.state.gridTileIdSelected === id))
						{
							this.selectTile(e.target.classList[2], id);
						} else if (this.state.tileNameSelected !== '') {
							this.insertTile(e.target.id);
						}
					}}
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

	selectTile = (tileName, tileId) => {
		this.setState(prevState => ({
			tileNameSelected: prevState.tileNameSelected === tileName ? '' : tileName,
			gridTileIdSelected: tileId
		}));
	}

	insertTile = (id) => {
		const pos = id;
		let coords = pos.split('-');
		const prevGridPos = this.state.gridTileIdSelected;
		const tileName = this.state.tileNameSelected;

		this.setState(prevState => ({
			gridCellNames: {
				...prevState.gridCellNames,
				[pos]: {
					piece: '',
					xPos: +coords[0],
					yPos: +coords[1],
					type: this.tileData[tileName].type,
					walkable: this.tileData[tileName].walkable,
					topSide: this.tileData[tileName].topSide,
					rightSide: this.tileData[tileName].rightSide,
					bottomSide: this.tileData[tileName].bottomSide,
					leftSide: this.tileData[tileName].leftSide,
					classes: tileName
				}
			},
			tileNameSelected: '',
			gridTileIdSelected: ''
		}));
		if (prevGridPos !== '') {
			this.setState(prevState => ({
				gridCellNames: {
					...prevState.gridCellNames,
					[prevGridPos]: {}
				}
			}));
		}
	}

	componentDidMount() {
		this.populateCellsState();
		this.populatePieceList();
	}

	render() {
		return (
			<div className="tool-container" style={{gridTemplateColumns: `auto ${this.tileSize * 15 + 'px'} auto`}}>
				<div className="tiles-container">
					{this.layoutTiles()}
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
