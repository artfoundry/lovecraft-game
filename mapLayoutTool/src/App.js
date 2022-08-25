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

		this.socket = io(FILE_SERVER);
		this.socket.on('connect', () => {
			console.log('Connected to server');
		});
		this.socket.on('connect-error', (error) => {
			console.log('Error connecting to server: ', error);
		});

		this.state = {
			pieces: {},
			piecesLoaded: false,
			gridDataDone: false,
			tileNameSelected: '',
			gridTileIdSelected: '',
			pieceNameSelected: '',
			gridPieceName: '',
			gridPieceData: {}
		};
	}

	initGridCells = () => {
		let cells = {};
		for (let r = 0; r < 15; r++) {
			for (let c = 0; c < 15; c++) {
				cells[c + '-' + r] = {};
			}
		}
		this.setState({gridPieceData: cells, gridDataDone: true});
	}

	layoutTiles() {
		let tiles = [];
		for (const tileName of Object.keys(this.tileData)) {
			tiles.push(
				<div key={tileName}>
					<img className={'tiles ' + tileName + (this.state.tileNameSelected === tileName && !this.state.gridTileIdSelected ? ' selected' : '')}
					     onClick={() => {
							 this.state.tileNameSelected !== '' ? this.selectTile('', '') : this.selectTile(tileName, '');
					     }}
					     style={{width: this.tileSize + 'px', height: this.tileSize + 'px'}}
					/>
					{tileName.replace(/-/g, ' ')}
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
				const id = c + '-' + r;
				const tileDataClasses = this.state.gridPieceData[id].classes || '';
				let classes = this.state.gridTileIdSelected === id ? ' selected' : '';
				classes += Object.keys(this.state.gridPieceData[id]).length === 0 ? '' : ` tiles ${tileDataClasses}`;
				row.push(<GridCell
					key={id}
					idProp={id}
					clickProp={() => {
						// if a tile already exists in this grid space
						if (classes.includes('tiles')) {
							// if neither tile template nor other grid tile is selected then select this grid tile
							if (this.state.tileNameSelected === '' && this.state.gridTileIdSelected === '') {
								this.selectTile('', id);
							// or if the tile here is already selected, then unselect it
							} else if (this.state.gridTileIdSelected === id) {
								this.selectTile('', '');
							}
						// if a tile template is selected or a grid tile is selected, then insert tile here
						} else if (this.state.tileNameSelected !== '' || this.state.gridTileIdSelected !== '') {
							this.insertTile(id);
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
		this.socket.emit('load-pieces');
		this.socket.on('sending-pieces', (data) => {
			this.setState({pieces: JSON.parse(data), piecesLoaded: true});
		});
	}

	layoutPieces() {
		let pieces = [];
		for (const pieceName of Object.keys(this.state.pieces)) {
			pieces.push(
				<div key={pieceName}
				     className={'piece' + (this.state.pieceNameSelected === pieceName ? ' selected' : '')}
				     onClick={() => {
						 if (this.state.pieceNameSelected !== pieceName) {
							 this.showPiece(pieceName);
						 }
				     }}
				>
					{pieceName}
				</div>
			);
		}
		return pieces;
	}

	showPiece = (pieceName) => {
		this.initGridCells();
		this.setState({
			pieceNameSelected: pieceName,
			gridPieceName: pieceName
		});
		for (const [tilePos, tileData] of Object.entries(this.state.pieces[pieceName])) {
			this.insertTile(tilePos, tileData);
		}
	}

	selectTile = (tileName, tileId) => {
		this.setState({
			tileNameSelected: tileName,
			gridTileIdSelected: tileId
		});
	}

	// tile data is either imported from mapData file from server or from this.tileData,
	// which is template data used for generating new pieces
	insertTile = (tilePos, importedTileData = null) => {
		const coords = tilePos.split('-');
		const prevGridPos = this.state.gridTileIdSelected;
		const tileData = importedTileData ? importedTileData :
			this.state.tileNameSelected !== '' ? this.tileData[this.state.tileNameSelected] :
			this.state.gridPieceData[prevGridPos];

		this.setState(prevState => ({
			gridPieceData: {
				...prevState.gridPieceData,
				[tilePos]: {
					piece: tileData.piece || '',
					xPos: +coords[0],
					yPos: +coords[1],
					type: tileData.type,
					walkable: tileData.walkable,
					topSide: tileData.topSide,
					rightSide: tileData.rightSide,
					bottomSide: tileData.bottomSide,
					leftSide: tileData.leftSide,
					classes: tileData.classes || 'floor',
					altClasses: tileData.classes || {},
					neighbors: tileData.neighbors || {}
				}
			},
			tileNameSelected: '',
			gridTileIdSelected: ''
		}));
		if (prevGridPos !== '') {
			this.setState(prevState => ({
				gridPieceData: {
					...prevState.gridPieceData,
					[prevGridPos]: {}
				}
			}));
		}
	}

	updatePieceName(value) {
		this.setState({
			gridPieceName: value,
			pieceNameSelected: ''
		});
	}

	updatePieceOptions(options) {

	}

	savePiece = () => {
		let populatedGridTiles = {};

		for (const [tilePos, tileData] of Object.entries(this.state.gridPieceData)) {
			if (Object.keys(tileData).length > 0) {
				populatedGridTiles[tilePos] = tileData;
			}
		}
		this.setState(prevState => ({
			pieces: {
				...prevState.pieces,
				[this.state.gridPieceName]: populatedGridTiles
			}
		}), () => {alert('Piece saved')});
	}

	deletePiece = () => {
		let pieces = {...this.state.pieces};
		delete pieces[this.state.gridPieceName];
		this.setState({pieces, gridPieceName: '', gridPieceData: {}});
		this.initGridCells();
	}

	deleteTile = () => {
		const tileId = this.state.gridTileIdSelected;
		this.setState(prevState => ({
			gridPieceData: {...prevState.gridPieceData, [tileId]: {}},
			gridTileIdSelected: ''
		}));
	}

	componentDidMount() {
		this.initGridCells();
		this.populatePieceList();
	}

	render() {
		return (
			<div className="tool-container">
				<div className="tiles-container">
					{this.layoutTiles()}
				</div>
				<div className="existing-pieces">
					<h3>Existing Pieces</h3>
					{this.state.piecesLoaded && this.layoutPieces()}
				</div>
				<div className="grid">
					{this.state.gridDataDone && this.layoutGrid()}
				</div>
				<div className="piece-options">
					<h3>Map Piece Options</h3>
					<form onSubmit={e => {
						e.preventDefault();
						this.savePiece();
					}}>
						<label>
							Name:
							<input type="text" name="name" required size="15"
							       onInput={e => {
									   this.updatePieceName(e.target.value);
								   }}
							       value={this.state.gridPieceName ? this.state.gridPieceName : ''} />
						</label>
						<input className="button" type="submit" value="Save piece" />
						<button className="delete-button" onClick={e => {
							e.preventDefault();
							this.deletePiece();
						}}>Delete piece</button>
						<button className="delete-button" onClick={this.initGridCells}>Clear grid</button>
					</form>
				</div>
				<div className="tile-options">
					<h3>Tile Options</h3>
					<form>

						<button className="delete-button" onClick={e => {
							e.preventDefault();
							this.deleteTile();
						}}>Delete tile</button>
					</form>
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
