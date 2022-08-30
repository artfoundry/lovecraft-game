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
			gridPieceData: {},
			neighborSelectMode: false,
			neighborTypeSelection: 'toDelete',
			altClassOpeningOneSelectMode: false, // for selecting the 1st opening tile and template tile for setting alt class for when opening is closed
			altClassOpeningTwoSelectMode: false, // for selecting a 2nd opening tile and template tile (if needed) for setting alt class for when opening is closed
			altClassBothOpeningsSelectMode: false, // for selecting template tile to use when both opening tiles are closed
			altClassOpeningOneSelected: '', // the 1st opening tile in the grid that, when closed, causes gridTileIdSelected to use alt class
			altClassOpeningTwoSelected: '', // a 2nd opening tile in the grid that, when closed, causes gridTileIdSelected to use 2nd alt class
			altClassOne: '',
			altClassTwo: '',
			altClassBoth: '',
			instructions: ''
		};
	}

	initGridCells = (callback) => {
		let cells = {};
		for (let r = 0; r < 15; r++) {
			for (let c = 0; c < 15; c++) {
				cells[c + '-' + r] = {};
			}
		}
		this.setState({
			tileNameSelected: '',
			gridTileIdSelected: '',
			pieceNameSelected: '',
			gridPieceName: '',
			gridPieceData: cells,
			neighborSelectMode: false,
			neighborTypeSelection: 'toDelete',
			altClassOpeningOneSelectMode: false, // for selecting the 1st opening tile and template tile for setting alt class for when opening is closed
			altClassOpeningTwoSelectMode: false, // for selecting a 2nd opening tile and template tile (if needed) for setting alt class for when opening is closed
			altClassBothOpeningsSelectMode: false, // for selecting template tile to use when both opening tiles are closed
			altClassOpeningOneSelected: '', // the 1st opening tile in the grid that, when closed, causes gridTileIdSelected to use alt class
			altClassOpeningTwoSelected: '', // a 2nd opening tile in the grid that, when closed, causes gridTileIdSelected to use 2nd alt class
			altClassOne: '',
			altClassTwo: '',
			altClassBoth: '',
			instructions: '',
			gridDataDone: true
		}, () => {
			if (callback) callback();
		});
	}

	layoutTiles() {
		let tiles = [];
		let classNames = '';
		for (const tileName of Object.keys(this.tileData)) {
			let selectedAltClasses = '';
			classNames = 'tiles ' + tileName;
			if (this.state.altClassOpeningOneSelectMode || this.state.altClassOpeningTwoSelectMode || this.state.altClassBothOpeningsSelectMode) {
				if (this.state.altClassOpeningOneSelected !== '' && this.state.gridPieceData[this.state.gridTileIdSelected].altClasses[this.state.altClassOpeningOneSelected] === tileName) {
					selectedAltClasses += ' selected-alt-class-one';
				} else if (this.state.altClassOpeningTwoSelected !== '' && this.state.gridPieceData[this.state.gridTileIdSelected].altClasses[this.state.altClassOpeningTwoSelected] === tileName) {
					selectedAltClasses += ' selected-alt-class-two';
				} else if (this.state.gridPieceData[this.state.gridTileIdSelected].altClasses.both === tileName) {
					selectedAltClasses += ' selected-alt-class-both';
				}
				classNames += selectedAltClasses;
			} else if (this.state.tileNameSelected === tileName) {
				classNames += ' selected';
			}
			tiles.push(
				<div key={tileName}>
					<img className={classNames}
					     onClick={() => {
						    if (this.state.altClassOpeningOneSelected !== '' || this.state.altClassOpeningTwoSelected !== '' ||
							    this.state.altClassBothOpeningsSelectMode) {
								let openingTileToSet = '';
								let altClassToSet = '';
								if (this.state.altClassOpeningOneSelectMode) {
									openingTileToSet = this.state.altClassOpeningOneSelected;
									altClassToSet = 'altClassOne';
								} else if (this.state.altClassOpeningTwoSelectMode) {
									openingTileToSet = this.state.altClassOpeningTwoSelected;
									altClassToSet = 'altClassTwo';
								} else if (this.state.altClassBothOpeningsSelectMode) {
									openingTileToSet = 'both';
									altClassToSet = 'altClassBoth';
								}
								this.setState(prevState => ({
									gridPieceData: {
										...prevState.gridPieceData,
										[this.state.gridTileIdSelected]: {
											...prevState.gridPieceData[this.state.gridTileIdSelected],
											altClasses: {
												...prevState.gridPieceData[this.state.gridTileIdSelected].altClasses,
												[openingTileToSet]: tileName
											}
										}
									},
									[altClassToSet]: tileName,
									instructions: ''
								}));
						    } else if (!this.state.altClassOpeningOneSelectMode && !this.state.altClassOpeningTwoSelectMode && !this.state.altClassBothOpeningsSelectMode) {
						        this.state.tileNameSelected !== '' ? this.selectTile('', '') : this.selectTile(tileName, '');
						    }
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

		for (let r = 0; r < 15; r++) {
			gridCellEls.push(<div key={r} className="grid-row" style={{height: this.tileSize + 'px'}}>{this.layoutGridRow(r)}</div>);
		}
		return gridCellEls;
	}

	layoutGridRow(r) {
		let row = [];
		for (let c = 0; c < 15; c++) {
			const id = c + '-' + r;
			const tileDataClasses = this.state.gridPieceData[id].classes || '';
			let classes = Object.keys(this.state.gridPieceData[id]).length > 0 ? ' tiles' : '';
			// if alt class selection mode is on and an alt class has been selected, show that class in the grid
			if (this.state.gridTileIdSelected === id && this.state.altClassOpeningOneSelectMode && this.state.altClassOne !== '') {
				classes += ` ${this.state.altClassOne}`;
			} else if (this.state.gridTileIdSelected === id && this.state.altClassOpeningTwoSelectMode && this.state.altClassTwo !== '') {
				classes += ` ${this.state.altClassTwo}`;
			} else if (this.state.gridTileIdSelected === id && this.state.altClassBothOpeningsSelectMode && this.state.altClassBoth !== ''){
				classes += ` ${this.state.altClassBoth}`;
			// otherwise show the tile's normal class
			} else {
				classes += ` ${tileDataClasses}`;
			}
			if (this.state.gridTileIdSelected === id) {
				classes += ' selected';
			}
			if (this.state.neighborSelectMode) {
				for (const [neighborType, neighborPosArray] of Object.entries(this.state.gridPieceData[this.state.gridTileIdSelected].neighbors)) {
					if (neighborPosArray.includes(id) && neighborType === this.state.neighborTypeSelection) {
						classes += ' selected-neighbor';
						break;
					}
				}
			} else if (this.state.altClassOpeningOneSelectMode || this.state.altClassOpeningTwoSelectMode || this.state.altClassBothOpeningsSelectMode) {
				if (this.state.altClassOpeningOneSelected === id) {
					classes += ' selected-alt-class-one';
				} else if (this.state.altClassOpeningTwoSelected === id) {
					classes += ' selected-alt-class-two';
				}
			}
			row.push(<GridCell
				key={id}
				idProp={id}
				clickProp={() => this.handleGridTileClick(classes, id)}
				classesProp={classes}
				styleProp={{width: this.tileSize + 'px', height: this.tileSize + 'px'}} />
			);
		}
		return row;
	}

	handleGridTileClick(classes, id) {
		if (classes.includes('tiles') && (this.state.neighborSelectMode ||
			this.state.altClassOpeningOneSelectMode || this.state.altClassOpeningTwoSelectMode)) {
			if (this.state.neighborSelectMode) {
				let currentNeighborsState = {...this.state.gridPieceData[this.state.gridTileIdSelected].neighbors};
				if (currentNeighborsState[this.state.neighborTypeSelection] && currentNeighborsState[this.state.neighborTypeSelection].includes(id)) {
					currentNeighborsState[this.state.neighborTypeSelection] = currentNeighborsState[this.state.neighborTypeSelection].filter(tilePos => tilePos !== id);
				} else {
					if (!currentNeighborsState[this.state.neighborTypeSelection]) {
						currentNeighborsState = {...currentNeighborsState, [this.state.neighborTypeSelection]: []};
					}
					currentNeighborsState[this.state.neighborTypeSelection].push(id);
				}
				this.setState(prevState => ({
					gridPieceData: {
						...prevState.gridPieceData,
						[this.state.gridTileIdSelected]: {
							...prevState.gridPieceData[this.state.gridTileIdSelected],
							neighbors: {
								...this.state.gridPieceData[this.state.gridTileIdSelected].neighbors,
								[this.state.neighborTypeSelection]: currentNeighborsState[this.state.neighborTypeSelection]
							}
						}
					}
				}));
			} else if (this.state.altClassOpeningOneSelectMode) {
				this.setState(prevState => ({
					altClassOpeningOneSelected: prevState.altClassOpeningOneSelected === '' ? id : '',
					instructions: 'Now select the alt class from the Tile Templates that will replace the tile highlighted in blue.'
				}));
			} else if (this.state.altClassOpeningTwoSelectMode) {
				this.setState(prevState => ({
					altClassOpeningTwoSelected: prevState.altClassOpeningTwoSelected === '' ? id : '',
					instructions: 'Now select the alt class from the Tile Templates that will replace the tile highlighted in blue.'
				}));
			}
		} else if (!this.state.altClassOpeningOneSelectMode && !this.state.altClassOpeningTwoSelectMode && !this.state.altClassBothOpeningsSelectMode) {
			// if another grid tile is selected or neither tile template nor other grid tile is selected then select this grid tile
			if (classes.includes('tiles') &&
				((this.state.gridTileIdSelected !== id && this.state.gridTileIdSelected !== '') ||
				(this.state.tileNameSelected === '' && this.state.gridTileIdSelected === ''))) {
				this.selectTile('', id);
			// or if the tile here is already selected, then unselect it
			} else if (this.state.gridTileIdSelected === id) {
				this.selectTile('', '');
			// or if a tile template is selected or a grid tile is selected and space clicked on is empty, then insert tile here
			} else if (this.state.tileNameSelected !== '' || (this.state.gridTileIdSelected !== '' && !classes.includes('tiles'))) {
				this.insertTile(id);
			}
		}
	}

	populatePieceList = () => {
		this.socket.emit('load-pieces');
		this.socket.on('sending-pieces', (data) => {
			this.setState({pieces: JSON.parse(data), piecesLoaded: true});
		});
		this.socket.on('data-saved', () => {
			this.setState({instructions: 'Map data saved successfully'});
		});
	}

	layoutPieces() {
		let pieces = [];
		for (const pieceName of Object.keys(this.state.pieces)) {
			pieces.push(
				<button key={pieceName}
				     className={'piece' + (this.state.pieceNameSelected === pieceName ? ' selected' : '')}
				     disabled={this.state.altClassOpeningOneSelectMode ||
				            this.state.altClassOpeningTwoSelectMode ||
				            this.state.altClassBothOpeningsSelectMode ||
				            this.state.neighborSelectMode}
				     onClick={() => {
					    this.showPiece(pieceName);
					 }}>
					{pieceName}
				</button>
			);
		}
		return pieces;
	}

	showPiece = (pieceName) => {
		this.initGridCells(() => {
			this.setState({
				pieceNameSelected: pieceName,
				gridPieceName: pieceName
			});
			for (const [tilePos, tileData] of Object.entries(this.state.pieces[pieceName])) {
				this.insertTile(tilePos, tileData);
			}
		});
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
					altClasses: tileData.altClasses || {},
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

	savePiece = () => {
		let populatedGridTiles = {};

		for (const [tilePos, tileData] of Object.entries(this.state.gridPieceData)) {
			if (Object.keys(tileData).length > 0) {
				const coords = tilePos.split('-');
				const topTilePos = +coords[0] + '-' + (+coords[1] - 1);
				const rightTilePos = (+coords[0] + 1) + '-' + +coords[1];
				const bottomTilePos = +coords[0] + '-' + (+coords[1] + 1);
				const leftTilePos = (+coords[0] - 1) + '-' + +coords[1];
				tileData.topSide = this.getSideType(tilePos, topTilePos, 'top');
				tileData.rightSide = this.getSideType(tilePos, rightTilePos, 'right');
				tileData.bottomSide = this.getSideType(tilePos, bottomTilePos, 'bottom');
				tileData.leftSide = this.getSideType(tilePos, leftTilePos, 'left');
				tileData.piece = this.state.gridPieceName;
				populatedGridTiles[tilePos] = tileData;
			}
		}
		this.setState(prevState => ({
			pieces: {
				...prevState.pieces,
				[this.state.gridPieceName]: populatedGridTiles
			}
		}), () => {
			this.socket.emit('save-map-data', JSON.stringify(this.state.pieces));
		});
	}

	getSideType(mainTilePos, sideTilePos, direction) {
		let side = this.state.gridPieceData[mainTilePos].type === 'wall' ? 'wall' : '';

		// if side tile is nonexistent (off grid) or empty and either main tile is floor or
		// main tile is a door facing the direction of the side tile, then the side is an opening
		if ((!this.state.gridPieceData[sideTilePos] || Object.keys(this.state.gridPieceData[sideTilePos]).length === 0) && (
			this.state.gridPieceData[mainTilePos].type === 'floor' ||
			((direction === 'top' || direction === 'bottom') && this.state.gridPieceData[mainTilePos].classes === 'top-bottom-door') ||
			(direction === 'right' && this.state.gridPieceData[mainTilePos].classes === 'right-door') ||
			(direction === 'left' && this.state.gridPieceData[mainTilePos].classes === 'left-door')))
		{
			side = 'opening';
		} else if (this.state.gridPieceData[sideTilePos] && Object.keys(this.state.gridPieceData[sideTilePos]).length > 0) {
			if (this.state.gridPieceData[sideTilePos].type === 'wall') {
				side = 'wall';
			} else if (this.state.gridPieceData[sideTilePos].type === 'door') {
				side = 'door';
			}
		}
		return side;
	}

	deletePiece = () => {
		let pieces = {...this.state.pieces};
		delete pieces[this.state.gridPieceName];
		this.setState({pieces, gridPieceName: '', gridPieceData: {}}, () => {
			this.socket.emit('save-map-data', JSON.stringify(this.state.pieces));
		});
		this.initGridCells();
	}

	deleteTile = () => {
		const tileId = this.state.gridTileIdSelected;
		this.setState(prevState => ({
			gridPieceData: {...prevState.gridPieceData, [tileId]: {}},
			gridTileIdSelected: ''
		}));
	}

	changeNeighborSelectionType(e) {
		if (e.target.checked) {
			this.setState({neighborTypeSelection: e.target.value});
		}
	}

	componentDidMount() {
		this.initGridCells();
		this.populatePieceList();
	}

	render() {
		return (
			<div className="tool-container">

				<div className="tiles-container">
					<h3>Tile Templates</h3>
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
						<button type="submit" value="Save piece"
						        disabled={this.state.gridPieceName === ''||
						                this.state.altClassOpeningOneSelectMode ||
								        this.state.altClassOpeningOneSelectMode ||
								        this.state.altClassOpeningTwoSelectMode ||
								        this.state.altClassBothOpeningsSelectMode ||
								        this.state.neighborSelectMode}>
							Save piece
						</button>
						<button className="delete-button"
						        disabled={this.state.altClassOpeningOneSelectMode ||
						        this.state.altClassOpeningOneSelectMode ||
						        this.state.altClassOpeningTwoSelectMode ||
						        this.state.altClassBothOpeningsSelectMode ||
						        this.state.neighborSelectMode}
						        onClick={e => {
									e.preventDefault();
									this.deletePiece();
								}}>
							Delete piece
						</button>
						<button className="delete-button"
						        disabled={this.state.altClassOpeningOneSelectMode ||
								        this.state.altClassOpeningOneSelectMode ||
								        this.state.altClassOpeningTwoSelectMode ||
								        this.state.altClassBothOpeningsSelectMode ||
								        this.state.neighborSelectMode}
						        onClick={(e) => {
							        e.preventDefault();
									this.initGridCells();
						        }}>
							Clear grid
						</button>
					</form>
				</div>

				<div className="tile-options">
					<h3>Tile Options</h3>
					<form>
						<div className="subsection">
							<fieldset>
								<legend>Set neighbors:</legend>
								<div>
									<input id="neighbor-to-delete"
									       type="radio" name="neighbor-type" value="toDelete"
									       defaultChecked
									       onChange={e => {this.changeNeighborSelectionType(e)}} />
									<label htmlFor="neighbor-to-delete">To delete</label>
								</div>
								<div>
									<input id="neighbor-to-change-class"
									       type="radio" name="neighbor-type" value="toChangeClass"
									       onChange={e => {this.changeNeighborSelectionType(e)}} />
									<label htmlFor="neighbor-to-change-class">To change class</label>
								</div>
								<div>
									<input id="neighbor-to-change-side-type"
									       type="radio" name="neighbor-type" value="toChangeSideType"
									       onChange={e => {this.changeNeighborSelectionType(e)}} />
									<label htmlFor="neighbor-to-change-side-type">To change side type</label>
								</div>
								<div>
									<input id="neighbor-to-change-type"
									       type="radio" name="neighbor-type" value="toChangeType"
									       onChange={e => {this.changeNeighborSelectionType(e)}} />
									<label htmlFor="neighbor-to-change-type">To change type</label>
								</div>
								<button className={'multi-select-button' + (this.state.neighborSelectMode ? ' select-mode' : '')}
								        disabled={this.state.gridTileIdSelected === '' ||
										        this.state.altClassOpeningOneSelectMode ||
										        this.state.altClassOpeningTwoSelectMode ||
										        this.state.altClassBothOpeningsSelectMode}
								        onClick={e => {
											e.preventDefault();
											this.setState(prevState => ({neighborSelectMode: !prevState.neighborSelectMode}));
										}}>
									Select tiles
								</button>
							</fieldset>
						</div>
						<div className="subsection">
							<fieldset>
								<legend>Set alt classes:</legend>
								<div className="alt-class-opening-one">
									<input id="set-opening-one"
									       type="radio" name="set-alt-classes" value="openingOne"
									       defaultChecked
									       onClick={() => {
											   if (this.state.altClassOpeningTwoSelectMode || this.state.altClassBothOpeningsSelectMode) {
												   this.setState({
													   altClassOpeningOneSelectMode: true,
													   altClassOpeningTwoSelectMode: false,
													   altClassBothOpeningsSelectMode: false,
													   instructions: 'First select the opening tile in the grid that, when closed, causes this tile to use its alt class'
												   });
											   }
									       }}/>
									<label htmlFor="set-opening-one"><b>Opening one: </b></label>
									<span>{this.state.altClassOpeningOneSelected} </span>
								</div>
								<div className="alt-class-opening-two">
									<input id="set-opening-two"
									       type="radio" name="set-alt-classes" value="openingTwo"
									       onClick={() => {
											   if (this.state.altClassOpeningOneSelectMode || this.state.altClassBothOpeningsSelectMode) {
											       this.setState({
												       altClassOpeningOneSelectMode: false,
												       altClassOpeningTwoSelectMode: true,
												       altClassBothOpeningsSelectMode: false,
												       instructions: 'First select the opening tile in the grid that, when closed, causes this tile to use its alt class'
											       });
											   }
									       }}/>
									<label htmlFor="set-opening-two"><b>Opening two: </b></label>
									<span>{this.state.altClassOpeningTwoSelected} </span>
								</div>
								<div className="alt-class-opening-both">
									<input id="set-opening-both"
									       type="radio" name="set-alt-classes" value="openingBoth"
									       onClick={() => {
										       if (this.state.altClassOpeningOneSelectMode || this.state.altClassOpeningTwoSelectMode) {
											       this.setState({
												       altClassOpeningOneSelectMode: false,
												       altClassOpeningTwoSelectMode: false,
												       altClassBothOpeningsSelectMode: true,
												       instructions: 'Only need to select a Template tile for this'
											       });
										       }
									       }}/>
									<label htmlFor="set-opening-both"><b>Both</b></label>
								</div>
								<button className={'multi-select-button' +
										(this.state.altClassOpeningOneSelectMode ||
										this.state.altClassOpeningTwoSelectMode ||
										this.state.altClassBothOpeningsSelectMode ? ' select-mode' : '')}
								        disabled={this.state.gridTileIdSelected === '' || this.state.neighborSelectMode}
								        onClick={e => {
											e.preventDefault();
											let instructions = '';
											let altClassOpeningOneSelectMode = false;
											const altClassOpeningTwoSelectMode = false;
											const altClassBothOpeningsSelectMode = false;
											if (!this.state.altClassOpeningOneSelectMode && !this.state.altClassOpeningTwoSelectMode) {
									            instructions = 'First select the opening tile in the grid that, when closed, causes this tile to use its alt class';
												altClassOpeningOneSelectMode = true;
											}
											this.setState({
												altClassOpeningOneSelected: '',
												altClassOpeningTwoSelected: '',
												altClassOne: '',
												altClassTwo: '',
												altClassBoth: '',
												altClassOpeningOneSelectMode,
												altClassOpeningTwoSelectMode,
												altClassBothOpeningsSelectMode,
												instructions
											});
										}}>
									Select template as alt
								</button>
							</fieldset>
						</div>
						<button className="delete-button"
						        disabled={this.state.gridTileIdSelected === '' ||
						                this.state.altClassOpeningOneSelectMode ||
						                this.state.altClassOpeningTwoSelectMode ||
						                this.state.altClassBothOpeningsSelectMode ||
						                this.state.neighborSelectMode}
						        onClick={e => {
									e.preventDefault();
									this.deleteTile();}}>
							Delete tile
						</button>
					</form>
				</div>
				<div className={'instructions' + (this.state.instructions === '' ? ' hidden' : '')}
					onClick={e => this.setState({instructions: ''})}>
					{this.state.instructions}
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
