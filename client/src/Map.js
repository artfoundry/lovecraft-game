import React from 'react';
import { useRef } from 'react';
import MapData from './data/mapData.json';
import GameLocations from './data/gameLocations.json';
import CreatureData from './data/creatureTypes.json';
import Creature from './Creature';
import {Exit, LightElement, Character, Tile, Door} from './MapElements';
import {StoneDoor} from './Audio';
import {convertCamelToKabobCase, randomTileMovementValue} from './Utils';

/**
 * Map controls entire layout of game elements (objects, tiles, and lighting) as well as movement of players and creatures
 * Map is made up of pre-defined pieces (using the map tool) that contain tiles
 *
 * Creature data structure : {
 * 		...CreatureData[name],
 * 		...GameLocations[location].creatures[name],
 * 		currentHP: CreatureData[name].startingHP,
 * 		tileCoords: {xPos, yPos}
 * 	}
 */

class Map extends React.Component {
	constructor(props) {
		super(props);

		this.pageFirstLoaded = true;
		this.initialMapLoad = true;
		this.tileSize = 64;
		this.characterSizePercentage = 0.7;
		this.mapTileLimit = 500;
		this.OPPOSITE_SIDE = {
			topSide: 'bottomSide',
			bottomSide: 'topSide',
			leftSide: 'rightSide',
			rightSide: 'leftSide'
		};
		this.creatureSurvivalHpPercent = 0.25;
		this.movementDelay = 100;

		this.mapLayoutTemp = {};
		this.sfxSelectors = {
			catacombs: {}
		};
		this.currentMapData = GameLocations[this.props.currentLocation];
		this.charRefs = {};

		this.state = {
			pcTypes: this.props.pcTypes,
			playerPlaced: false,
			playerVisited: {},
			followModeMoves: [],
			mapLayout: {},
			mapLayoutDone: false,
			exitPosition: {},
			exitPlaced: false,
			lighting: {}
		};
	}

	resetMap = () => {
		this.initialMapLoad = true;
		this.mapLayoutTemp = {};

		this.setState({
			playerPlaced: false,
			creaturesPlaced: false,
			playerVisited: {},
			mapLayout: {},
			mapLayoutDone: false,
			exitPosition: {},
			exitPlaced: false,
			lighting: {}
		}, () => {
			this._layoutPieces();
		});
	}


	/**
	 * MAP LAYOUT
	 */

	/**
	 * Initialization of the map containing a loop that chooses and places tiles in temp storage,
	 * then runs a cleanup function to close up tile openings (halls, doorways) that weren't covered,
	 * then temp map storage is saved into state, after which callback runs that places characters, and sets activeCharacter,
	 * then runs callback that sets exit position, which triggers lighting to be set, and places creatures and saves their coordinates to state,
	 * then finally sets up keyboard listeners if first time page is loaded
	 * @private
	 */
	_layoutPieces() {
		let numPiecesTried = 0;
		let attemptedPieces = [];
		const numPieceTemplates = Object.keys(MapData).length;

		while (numPiecesTried < numPieceTemplates && Object.keys(this.mapLayoutTemp).length < this.mapTileLimit) {
			const {newPiece, pieceName} = this._chooseNewRandomPiece(attemptedPieces);
			attemptedPieces.push(pieceName);
			const {positionFound, updatedPiece, mapOpening, pieceOpening} = this._findNewPiecePosition(newPiece);

			if (positionFound) {
				this._updateMapLayout(updatedPiece, mapOpening, pieceOpening);
				attemptedPieces = [];
				numPiecesTried = 0;
			} else numPiecesTried++;
		}
		this._mapCleanup();

		if (this.initialMapLoad) {
			const initialSetupCallback = () => {
				this._setExitPosition();
				this._setInitialCreatureData();
				if (this.pageFirstLoaded) {
					this.pageFirstLoaded = false;
					this._setupKeyListeners();
				}
			};
			this.initialMapLoad = false;
			this.setState({
				mapLayoutDone: true,
				mapLayout: {...this.mapLayoutTemp}
			}, () => {
				this._setInitialCharacterCoords(initialSetupCallback);
			});
		}
	}

	/**
	 * Randomly chooses a new map piece to place on the map from the remaining list of pieces that haven't been tried yet
	 * @param attemptedPieces: Array (of Strings: piece names)
	 * @returns {{newPiece: Object, pieceName: String}}
	 * @private
	 */
	_chooseNewRandomPiece(attemptedPieces) {
		const pieceNamesList = Object.keys(MapData);
		const filteredPieceNameList = pieceNamesList.filter(name => attemptedPieces.indexOf(name) < 0);
		const randomIndex = Math.floor(Math.random() * filteredPieceNameList.length);
		const newPiece = MapData[filteredPieceNameList[randomIndex]];
		return {newPiece, pieceName: filteredPieceNameList[randomIndex]};
	}

	/**
	 * Updates the coordinates for a tile's neighbor attribute (containing a tile's neighbor info for when tiles need to be changed on the map)
	 * to use the map coordinates instead of the piece's local coordinates
	 * @param tileData: Object
	 * @param xAdjustment: Integer
	 * @param yAdjustment: Integer
	 * @returns Object (containing arrays of updated positions (string) for each neighboring tile)
	 * @private
	 */
	_updateNeighborCoordinates(tileData, xAdjustment, yAdjustment) {
		let updatedNeighbors = {};
		for (const [type, neighborPositions] of Object.entries(tileData.neighbors)) {
			let neighborCoords = [];
			let newXCoord = null;
			let newYCoord = null;
			updatedNeighbors[type] = [];
			neighborPositions.forEach(pos => {
				neighborCoords = pos.split('-');
				newXCoord = +neighborCoords[0] + xAdjustment;
				newYCoord = +neighborCoords[1] + yAdjustment;
				updatedNeighbors[type].push(newXCoord + '-' + newYCoord);
			});
		}
		return updatedNeighbors;
	}

	/**
	 * Updates the coordinates for a tile's altClasses attribute (containing alternate CSS class info for when tiles need to be changed on the map)
	 * to use the map coordinates instead of the piece's local coordinates
	 * @param tileData: Object
	 * @param xAdjustment: Integer
	 * @param yAdjustment: Integer
	 * @returns Object (containing CSS class info)
	 * @private
	 */
	_updateAltClassCoordinates(tileData, xAdjustment, yAdjustment) {
		let updatedAltClasses = {};
		for (const [pos, classes] of Object.entries(tileData.altClasses)) {
			if (pos === 'both') {
				updatedAltClasses.both = classes;
			} else {
				let neighborPos = [];
				let newXPos = null;
				let newYPos = null;
				neighborPos = pos.split('-');
				newXPos = +neighborPos[0] + xAdjustment;
				newYPos = +neighborPos[1] + yAdjustment;
				updatedAltClasses[newXPos + '-' + newYPos] = classes;
			}
		}
		return updatedAltClasses;
	}

	/**
	 * Finds a position on the map to place a new piece by looking at each piece's door/hall openings
	 * and ensuring the new piece has enough space
	 * @param piece: Object (containing objects with each tile's data)
	 * @returns Object: {
	 *      pieceOpening: Object (tile in the new piece that was connected to piece on the map),
	 *      positionFound: Boolean,
	 *      updatedPiece: Object (new piece with updated coordinates),
	 *      mapOpening: Object (tile on the map that the new piece connects to)
	 * }
	 * @private
	 */
	_findNewPiecePosition(piece) {
		let positionFound = false;
		let updatedPiece = {};

		// just for placing first piece
		if (Object.keys(this.mapLayoutTemp).length === 0) {
			const firstPiecePosition = {xPos: 5, yPos: 5}; //arbitrary but shifted from 0,0 to allow space for pieces on all sides
			positionFound = true;
			for (const tileData of Object.values(piece)) {
				const adjustedXPos = firstPiecePosition.xPos + tileData.xPos;
				const adjustedYPos = firstPiecePosition.yPos + tileData.yPos;
				const adjustedPos = adjustedXPos + '-' + adjustedYPos;
				const updatedAltClasses = this._updateAltClassCoordinates(tileData, firstPiecePosition.xPos, firstPiecePosition.yPos);
				const updatedNeighbors = this._updateNeighborCoordinates(tileData, firstPiecePosition.xPos, firstPiecePosition.yPos);
				updatedPiece[adjustedPos] = {
					...tileData,
					xPos: adjustedXPos,
					yPos: adjustedYPos,
					neighbors: updatedNeighbors,
					altClasses: updatedAltClasses
				};
			}
			return {positionFound, updatedPiece};
		}

		let pieceOpenings = [];
		let mapOpenings = [];

		// find all tile openings in piece and existing map
		for (const [tilePos, tileSides] of Object.entries(piece)) {
			for (const [side, value] of Object.entries(tileSides)) {
				if (value === 'opening') {
					pieceOpenings.push({[tilePos]: side});
				}
			}
		}
		for (const [tilePos, tileSides] of Object.entries(this.mapLayoutTemp)) {
			for (const [side, value] of Object.entries(tileSides)) {
				if (value === 'opening') {
					mapOpenings.push({[tilePos]: side});
				}
			}
		}

		let mapOpening = {};
		let pieceOpening = {};
		let adjustedPieceOpening = {};
		let pieceAdjustedTilePositions = {};
		let mapTilesAvailableForPiece = 0;
		let mapOpeningsCounter = 0;
		let pieceOpeningsCounter = 0;
		const numOfTilesInPiece = Object.keys(piece).length;

		// look through each opening in the map
		while (mapTilesAvailableForPiece < numOfTilesInPiece && mapOpeningsCounter < mapOpenings.length) {
			mapOpening = mapOpenings[mapOpeningsCounter];
			const mapOpeningTileCoords = Object.keys(mapOpening)[0].split('-');

			// for a map opening, check each piece opening to see if piece fits there
			// if mapTilesAvailableForPiece == numOfTilesInPiece, then piece fits in the map and can stop looking
			while (mapTilesAvailableForPiece < numOfTilesInPiece && pieceOpeningsCounter < pieceOpenings.length) {
				pieceAdjustedTilePositions = {};
				mapTilesAvailableForPiece = 0;  // gets reset for each piece opening
				pieceOpening = pieceOpenings[pieceOpeningsCounter];
				const mapOpeningOpenSide = Object.values(mapOpening)[0];
				const pieceOpeningOpenSide = Object.values(pieceOpening)[0];

				if (pieceOpeningOpenSide === this.OPPOSITE_SIDE[mapOpeningOpenSide]) {
					const pieceOpeningTileCoords = Object.keys(pieceOpening)[0].split('-');
					const xAdjust = mapOpeningOpenSide === 'leftSide' ? -1 : mapOpeningOpenSide === 'rightSide' ? 1 : 0;
					const yAdjust = mapOpeningOpenSide === 'topSide' ? -1 : mapOpeningOpenSide === 'bottomSide' ? 1 : 0;
					// these are the coords for where in the map to place the piece's tile that contains the opening
					const mapOpeningXOffset = +mapOpeningTileCoords[0] + xAdjust;
					const mapOpeningYOffset = +mapOpeningTileCoords[1] + yAdjust;
					const adjustedPieceOpeningPos = mapOpeningXOffset + '-' + mapOpeningYOffset;
					adjustedPieceOpening = {[adjustedPieceOpeningPos]: pieceOpeningOpenSide};

					// now move all other tiles in the piece to go with the opening tile
					// and copy in rest of original tile info
					let isValidPos = true;
					let tilePosIndex = 0;
					const tileList = Object.values(piece);

					while (isValidPos && tilePosIndex < tileList.length) {
						const tileData = tileList[tilePosIndex];
						const newXPos = mapOpeningXOffset + tileData.xPos - +pieceOpeningTileCoords[0];
						const newYPos = mapOpeningYOffset + tileData.yPos - +pieceOpeningTileCoords[1];
						const newPos = newXPos + '-' + newYPos;
						const originalPos = tileData.xPos + '-' + tileData.yPos;
						// check if location on map where tile would go is empty and within bounds
						if (this.mapLayoutTemp[newPos] || newXPos < 0 || newYPos < 0) {
							isValidPos = false;
						} else {
							mapTilesAvailableForPiece++;
							pieceAdjustedTilePositions[newXPos + '-' + newYPos] = {
								...tileData,
								xPos: newXPos,
								yPos: newYPos,
								originalPos
							};
							const xAdjust = mapOpeningXOffset - +pieceOpeningTileCoords[0];
							const yAdjust = mapOpeningYOffset - +pieceOpeningTileCoords[1];
							if (tileData.altClasses) {
								pieceAdjustedTilePositions[newXPos + '-' + newYPos].altClasses = this._updateAltClassCoordinates(tileData, xAdjust, yAdjust);
							}
							if (tileData.neighbors) {
								pieceAdjustedTilePositions[newXPos + '-' + newYPos].neighbors = this._updateNeighborCoordinates(tileData, xAdjust, yAdjust);
							}
							if (tileData.type === 'door') {
								pieceAdjustedTilePositions[newXPos + '-' + newYPos].doorIsOpen = false;
							}
						}
						tilePosIndex++;
					}
				}
				pieceOpeningsCounter++;
			}
			pieceOpeningsCounter = 0;
			mapOpeningsCounter++;
		}

		if (mapTilesAvailableForPiece === numOfTilesInPiece) {
			positionFound = true;
			updatedPiece = {...pieceAdjustedTilePositions};
		}

		pieceOpening = adjustedPieceOpening;
		return {positionFound, updatedPiece, mapOpening, pieceOpening};
	}

	/**
	 * Inserts piece into mapLayoutTemp and
	 * clears out the 'opening' from recently laid piece and matching opening on the map
	 * @param newPiece: Object (newly placed piece with updated coordinates for map layout)
	 * @param mapOpeningToRemove: Object ({[tileCoords relative to map]: side} - n/a for first piece)
	 * @param pieceOpeningToRemove: Object ({[tileCoords relative to piece]: side} - n/a for first piece)
	 * @private
	 */
	_updateMapLayout(newPiece, mapOpeningToRemove, pieceOpeningToRemove) {
		const tilePositions = Object.keys(newPiece);
		let pieceOpeningTilePos = '';
		let pieceOpeningSide = '';
		let mapOpeningTile = '';
		let mapOpeningSide = '';

		if (mapOpeningToRemove && pieceOpeningToRemove) {
			pieceOpeningTilePos = Object.keys(pieceOpeningToRemove)[0];
			pieceOpeningSide = pieceOpeningToRemove[pieceOpeningTilePos];
			mapOpeningTile = Object.keys(mapOpeningToRemove)[0];
			mapOpeningSide = mapOpeningToRemove[mapOpeningTile];
		}
		tilePositions.forEach(tilePos => {
			if (pieceOpeningToRemove && tilePos === pieceOpeningTilePos) {
				// clear 'opening' from piece tile
				newPiece[tilePos][pieceOpeningSide] = '';
			}
			this.mapLayoutTemp[tilePos] = {...newPiece[tilePos]};
		});

		// clear 'opening' from map tile next to where new piece is placed
		if (mapOpeningToRemove) {
			this.mapLayoutTemp[mapOpeningTile][mapOpeningSide] = '';
		}
	}

	/**
	 * For closing up all remaining tile door/hall openings in temp map storage since map layout is finished
	 * @private
	 */
	_mapCleanup() {
		const mapData = {...this.mapLayoutTemp};
		for (const [tileLoc, tileData] of Object.entries(mapData)) {
			if (tileData.type !== 'wall') {
				const tileSides = {
					topSide: tileData.topSide,
					bottomSide: tileData.bottomSide,
					leftSide: tileData.leftSide,
					rightSide: tileData.rightSide
				}
				for (const [tileSide, sideType] of Object.entries(tileSides)) {
					if (sideType === 'opening') {
						// change tile from opening to a wall if it and neighbors won't be deleted,
						// ie. if it's part of a hall, not a room
						if (!tileData.neighbors.toDelete) {
							this.mapLayoutTemp[tileLoc] = {
								...this.mapLayoutTemp[tileLoc],
								type: 'wall',
								topSide: 'wall',
								rightSide: 'wall',
								bottomSide: 'wall',
								leftSide: 'wall'
							};
						// or if it and neighbors will be deleted, then change neighboring door to wall
						} else if (tileData.neighbors.toChangeType){
							tileData.neighbors.toChangeType.forEach(tileToChange => {
								delete this.mapLayoutTemp[tileToChange].doorIsOpen;
								this.mapLayoutTemp[tileToChange] = {
									...this.mapLayoutTemp[tileToChange],
									type: 'wall',
									topSide: 'wall',
									rightSide: 'wall',
									bottomSide: 'wall',
									leftSide: 'wall'
								};
							});
						}

						// go through all neighbors and delete them or change class/side as specified in mapData
						tileData.neighbors.toChangeClass.forEach(neighborLoc => {
							let newTileClasses = this.mapLayoutTemp[neighborLoc].altClasses[tileLoc];

							// if this neighbor is a corner with two adjacent openings (has the 'both' key), need to check if both are now walls
							if (this.mapLayoutTemp[neighborLoc].altClasses.both) {
								const otherAdjacentOpening = Object.keys(this.mapLayoutTemp[neighborLoc].altClasses).find(key => (
									key !== 'both' && key !== tileLoc
								));
								if (this.mapLayoutTemp[otherAdjacentOpening].type === 'wall') {
									newTileClasses = this.mapLayoutTemp[neighborLoc].altClasses.both;
								}
							}
							this.mapLayoutTemp[neighborLoc].classes = newTileClasses;
						});
						if (tileData.neighbors.toDelete) {
							tileData.neighbors.toDelete.forEach(tileToDelete => {
								delete this.mapLayoutTemp[tileToDelete];
							});
						}
						if (tileData.neighbors.toChangeSideType) {
							tileData.neighbors.toChangeSideType.forEach(tileToChange => {
								this.mapLayoutTemp[tileToChange][tileSide] = 'wall';
							});
						}
					}
				}
			}
		}
	}

	/**
	 * Finds the nearest available (doesn't already contain another player) tile to the one passed in
	 * Don't need ot look for creature positions because players are placed first
	 * @param previousPlayerCoords: Array (of x and y integers)
	 * @returns String (new available pos)
	 * @private
	 */
	_findNearbyAvailableTile(previousPlayerCoords) {
		let availableTile = null;
		let distanceAway = 1;
		const tileList = Object.keys(this.state.mapLayout).filter(tilePos => this.state.mapLayout[tilePos].type === 'floor');
		const allCharactersPos = this.props.getAllCharactersPos('player', 'pos').map(posObj => posObj.pos);
		while (!availableTile) {
			const newNearbyPos1 = `${+previousPlayerCoords[0] + distanceAway}-${+previousPlayerCoords[1]}`;
			const newNearbyPos2 = `${+previousPlayerCoords[0] - distanceAway}-${+previousPlayerCoords[1]}`;
			const newNearbyPos3 = `${+previousPlayerCoords[0]}-${+previousPlayerCoords[1] + distanceAway}`;
			const newNearbyPos4 = `${+previousPlayerCoords[0]}-${+previousPlayerCoords[1] - distanceAway}`;
			const newNearbyPos5 = `${+previousPlayerCoords[0] + distanceAway}-${+previousPlayerCoords[1] + distanceAway}`;
			const newNearbyPos6 = `${+previousPlayerCoords[0] - distanceAway}-${+previousPlayerCoords[1] - distanceAway}`;
			const newNearbyPos7 = `${+previousPlayerCoords[0] + distanceAway}-${+previousPlayerCoords[1] - distanceAway}`;
			const newNearbyPos8 = `${+previousPlayerCoords[0] - distanceAway}-${+previousPlayerCoords[1] + distanceAway}`;
			if (tileList.includes(newNearbyPos1) && !allCharactersPos.includes(newNearbyPos1)) {
				availableTile = newNearbyPos1;
			} else if (tileList.includes(newNearbyPos2) && !allCharactersPos.includes(newNearbyPos2)) {
				availableTile = newNearbyPos2;
			} else if (tileList.includes(newNearbyPos3) && !allCharactersPos.includes(newNearbyPos3)) {
				availableTile = newNearbyPos3;
			} else if (tileList.includes(newNearbyPos4) && !allCharactersPos.includes(newNearbyPos4)) {
				availableTile = newNearbyPos4;
			} else if (tileList.includes(newNearbyPos5) && !allCharactersPos.includes(newNearbyPos5)) {
				availableTile = newNearbyPos5;
			} else if (tileList.includes(newNearbyPos6) && !allCharactersPos.includes(newNearbyPos6)) {
				availableTile = newNearbyPos6;
			} else if (tileList.includes(newNearbyPos7) && !allCharactersPos.includes(newNearbyPos7)) {
				availableTile = newNearbyPos7;
			} else if (tileList.includes(newNearbyPos8) && !allCharactersPos.includes(newNearbyPos8)) {
				availableTile = newNearbyPos8;
			} else {
				distanceAway++;
			}
		}
		return availableTile;
	}

	/**
	 * Sets to state coordinates for all PCs when map first loads,
	 * then moves the map to center on active PC
	 * @param initialSetupCallback: Function
	 * @private
	 */
	_setInitialCharacterCoords(initialSetupCallback) {
		let updatedPlayerData = {...this.props.playerCharacters};
		let playerVisitedUpdatedState = {};
		let previousPlayerCoords = null;

		for (const playerID of Object.keys(this.props.playerCharacters)) {
			let tilePos = '';
			let newCoords = [];
			if (!previousPlayerCoords) {
				tilePos = this._generateRandomLocation();
				newCoords = tilePos.split('-');
				previousPlayerCoords = newCoords;
			} else {
				// look for empty nearby tile to place 2nd/3rd PC
				newCoords = this._findNearbyAvailableTile(previousPlayerCoords).split('-');
				previousPlayerCoords = newCoords;
			}
			playerVisitedUpdatedState = Object.assign(this.state.playerVisited, this._findVisitedTiles(newCoords));
			updatedPlayerData[playerID].coords = {xPos: +newCoords[0], yPos: +newCoords[1]};
		}

		this.props.updateCharacters('player', updatedPlayerData, null, false, true, () => {
			this.setState(prevState => ({
				playerVisited: playerVisitedUpdatedState || {...prevState.playerVisited},
				playerPlaced: true
			}), () => {
				this._moveMap(initialSetupCallback);
			});
		});
	}

	/**
	 * Creates initial creature data, giving them starting HP and coords as well as basic stats, etc.,
	 * then saves to App state, after which turn order is set up (in App)
	 * @private
	 */
	_setInitialCreatureData() {
		let mapCreatures = {};
		let creatureCoords = {};
		for (const [name, stats] of Object.entries(this.currentMapData.creatures)) {
			for (let i=0; i < stats.count; i++) {
				const coords = this._setInitialCreatureCoords(creatureCoords);
				const creatureID = name + i;
				mapCreatures[creatureID] = new Creature(CreatureData[name]);
				mapCreatures[creatureID].coords = coords;
				creatureCoords[creatureID] = coords;
			}
		}
		this.props.updateCharacters('creature', mapCreatures, null, true, false, () => {
			this.setState({creaturesPlaced: true}, () => {
				const creaturePositions = this.props.getAllCharactersPos('creature', 'pos');
				const playerPositions = this.props.getAllCharactersPos('player', 'pos');
				const threatLists = this._findChangesToNearbyThreats(playerPositions, creaturePositions);
				this.props.updateThreatList(threatLists.threatListToAdd, [], null);
			});
		});
	}

	/**
	 * Uses _generateRandomLocation to find location for creature, then formats it as coords object
	 * @param creatureCoords: Object (collection of all creature locations)
	 * @returns {{yPos: number, xPos: number}}
	 * @private
	 */
	_setInitialCreatureCoords(creatureCoords) {
		const newPosition = this._generateRandomLocation(creatureCoords).split('-');
		return {xPos: +newPosition[0], yPos: +newPosition[1]};
	}

	/**
	 * Wrapper called by render() to create all map tile components
	 * @returns Array (of Tile components)
	 */
	createAllMapPieces = () => {
		let tiles = [];
		for (const tilePos of Object.keys(this.state.mapLayout)) {
			tiles.push(this._createMapTile(tilePos));
		}
		return tiles;
	}

	/**
	 * Creates Tile component using tilePos from mapLayout,
	 * then transforms it to the proper x,y coordinates on the page
	 * @param tilePos: String
	 * @returns {JSX.Element}: Tile component
	 * @private
	 */
	_createMapTile(tilePos) {
		let allClasses = this.currentMapData.name;
		const tileData = this.state.mapLayout[tilePos];

		if (tileData.classes && tileData.classes !== '') {
			allClasses += ` ${tileData.classes}`;
		} else if (tileData.type === 'floor') {
			allClasses += ' floor'
		}
		const xPos = (tileData.xPos * this.tileSize) + 'px';
		const yPos = (tileData.yPos * this.tileSize) + 'px';
		const size = this.tileSize + 'px';
		const tileStyle = {
			transform: `translate(${xPos}, ${yPos})`,
			width: size,
			height: size
		};

		return (<Tile
			key={tilePos}
			tileTypeProp={tileData.type}
			styleProp={tileStyle}
			tileNameProp={tileData.xPos + '-' + tileData.yPos}
			classStrProp={allClasses}
			moveCharacterProp={(tilePos) => {this.checkIfTileOrObject(tilePos, null)}} />);
	}

	/**
	 * Makes list of all tiles, chooses one by one at random,
	 * and checks them for other creatures, players, and objects to find an empty one
	 * Can be used to place any character/object
	 * @param creatureCoords: Object
	 * @returns {string}
	 * @private
	 */
	_generateRandomLocation(creatureCoords = {}) {
		let emptyLocFound = false;
		// list of available floor tiles, in str format, on which to place stuff
		let tileList = Object.keys(this.state.mapLayout).filter(tilePos => this.state.mapLayout[tilePos].type === 'floor');
		let creatureLocList = Object.values(creatureCoords).length > 0 ? Object.values(creatureCoords).map(creature => `${creature.xPos}-${creature.yPos}`) : null;
		let randomIndex = 0;
		let tilePos = '';
		const exitPos = Object.values(this.state.exitPosition).length > 0 ?`${this.state.exitPosition.xPos}-${this.state.exitPosition.yPos}` : null;
		let allPlayerPos = [];

		this.props.getAllCharactersPos('player', 'pos').forEach(player => {
			allPlayerPos.push(player.pos);
		});

		while (!emptyLocFound && tileList.length > 0) {
			randomIndex = Math.floor(Math.random() * tileList.length);
			tilePos = tileList[randomIndex];
	// todo: also will need to search object locations once I've set up storage for them
			// comparisons formatted this way because 'null && false' equals null, not false, while '!(null && true)' equals true
			if (!(exitPos && tilePos === exitPos) &&
				!(creatureLocList && creatureLocList.includes(tilePos)) &&
				!(allPlayerPos.includes(tilePos)))
			{
				emptyLocFound = true;
			} else {
				// remove tile from list of available locations
				tileList.splice(randomIndex, 1);
			}
		}
		return tilePos;
	}

	/**
	 * Calculates the middle of the game window in pixels for placing main character
	 * @returns {{yPos: number, xPos: number}}
	 * @private
	 */
	_calculateMapCenter() {
		return {xPos: Math.floor(window.outerWidth/(this.tileSize * 2)) * this.tileSize,
			yPos: Math.floor(window.innerHeight/(this.tileSize * 2)) * this.tileSize};
	}

	/**
	 * Takes tile position from map and returns transform x,y pixel values
	 * Used for characters and objects
	 * @param xPos: integer
	 * @param yPos: integer
	 * @returns {string}
	 * @private
	 */
	_calculateObjectTransform(xPos, yPos) {
		return `${xPos * this.tileSize}px, ${yPos * this.tileSize}px`;
	}

	/**
	 * Either tilePos or direction is passed in, depending on control method (tilePos for clicking/tapping or direction for keyboard),
	 * then destination tile is checked for interactive objects (like door) or just tile and calls appropriate function
	 * @param tilePos: String
	 * @param direction: String
	 */
	checkIfTileOrObject = (tilePos, direction) => {
		let newPos = tilePos;
		let tileData = this.state.mapLayout[tilePos];
		const activePCCoords = this.props.playerCharacters[this.props.activeCharacter].coords;
		let validAction = true;

		// movement by keyboard
		if (direction) {
			switch(direction) {
				case 'left':
					newPos = `${activePCCoords.xPos - 1}-${activePCCoords.yPos}`;
					break;
				case 'right':
					newPos = `${activePCCoords.xPos + 1}-${activePCCoords.yPos}`;
					break;
				case 'up':
					newPos = `${activePCCoords.xPos}-${activePCCoords.yPos - 1}`;
					break;
				case 'down':
					newPos = `${activePCCoords.xPos}-${activePCCoords.yPos + 1}`;
					break;
				case 'up-left':
					newPos = `${activePCCoords.xPos - 1}-${activePCCoords.yPos - 1}`;
					break;
				case 'up-right':
					newPos = `${activePCCoords.xPos + 1}-${activePCCoords.yPos - 1}`;
					break;
				case 'down-left':
					newPos = `${activePCCoords.xPos - 1}-${activePCCoords.yPos + 1}`;
					break;
				case 'down-right':
					newPos = `${activePCCoords.xPos + 1}-${activePCCoords.yPos + 1}`;
					break;
			}
			tileData = this.state.mapLayout[newPos]
		}

		// check if player is trying to move where a character exists
		if (validAction) {
			const newCoords = newPos.split('-');
			validAction = this._tileIsFreeToMove({xPos: +newCoords[0], yPos: +newCoords[1]}, 'player');
		}

		// check if tile is door or floor
		if (validAction) {
			const newCoords = newPos.split('-');
			const playerXMovementAmount = Math.abs(+newCoords[0] - activePCCoords.xPos);
			const playerYMovementAmount = Math.abs(+newCoords[1] - activePCCoords.yPos);
			if (playerXMovementAmount <= 1 && playerYMovementAmount <= 1) {
				if (tileData.type === 'floor') {
					this.moveCharacter([newPos]);
				} else if (tileData.type === 'door') {
					if (tileData.doorIsOpen) {
						const showDialog = true;
						const dialogProps = {
							dialogContent: 'Close the door or move into the doorway?',
							closeButtonText: 'Close door',
							closeButtonCallback: () => {this.toggleDoor(newPos)},
							disableCloseButton: false,
							actionButtonVisible: true,
							actionButtonText: 'Move',
							actionButtonCallback: () => {this.moveCharacter([newPos])},
							dialogClasses: ''
						};
						this.props.setShowDialogProps(showDialog, dialogProps);
					} else {
						this.toggleDoor(newPos);
					}
				}
			} else if (tileData.type !== 'wall') {
				const allPlayersPos = this.props.getAllCharactersPos('player', 'pos');
				const litTiles = this._getTilesSurroundingAllPCs(allPlayersPos);
				let newPosIsLitTile = false;
				for (const tiles of Object.values(litTiles)) {
					// need to check for door separately because _getTilesSurroundingAllPCs considers closed doors as walls for sake of lighting
					if (tiles.floors[newPos] || this.state.mapLayout[newPos].type === 'door') {
						newPosIsLitTile = true;
					}
				}
				if (this.state.playerVisited[newPos] || newPosIsLitTile) {
					const temp = newPos.split('-');
					const coords = {xPos: +temp[0], yPos: +temp[1]};
					const path = this.pathFromAtoB(this.props.playerCharacters[this.props.activeCharacter].coords, coords);
					if (path.length > 1) {
						this.moveCharacter(path);
					} else {
						const showDialog = true;
						const dialogProps = {
							dialogContent: 'The path is blocked.',
							closeButtonText: 'Ok',
							closeButtonCallback: null,
							disableCloseButton: false,
							actionButtonVisible: false,
							actionButtonText: '',
							actionButtonCallback: null,
							dialogClasses: ''
						};
						this.props.setShowDialogProps(showDialog, dialogProps);
					}
				}
			}
		}
	}

	/**
	 * Checks to see if player char is on exit tile and if so, shows dialog to give player choice of action
	 * @private
	 */
	_checkForExit() {
		const activePCCoords = this.props.playerCharacters[this.props.activeCharacter].coords;
		if (activePCCoords.xPos === this.state.exitPosition.xPos &&
			activePCCoords.yPos === this.state.exitPosition.yPos)
		{
			const showDialog = true;
			const dialogProps = {
				dialogContent: 'Do you want to descend to the next level?',
				closeButtonText: 'Stay here',
				closeButtonCallback: null,
				disableCloseButton: false,
				actionButtonVisible: true,
				actionButtonText: 'Descend',
				actionButtonCallback: this.resetMap,
				dialogClasses: ''
			};
			this.props.setShowDialogProps(showDialog, dialogProps);
		}
	}

	/**
	 * Checks to see if a creature is in attacking range of active player character, given choice of weapon
	 * @param id: String (creature id)
	 * @param weaponData: Object
	 * @returns {boolean}
	 */
	isCreatureInRange = (id, weaponData) => {
		const creatureCoords = this.props.mapCreatures[id].coords;
		const activePC = this.props.playerCharacters[this.props.activeCharacter];
		const activePlayerCoords = activePC.coords;
		const activePlayerSight = activePC.lightRange;
		const activePcVisibleTiles = this._unblockedPathsToNearbyTiles(`${activePlayerCoords.xPos}-${activePlayerCoords.yPos}`, activePlayerSight);
		const allPcCoords = this.props.getAllCharactersPos('player', 'coords');
		let otherPcVisibleTiles = [];
		let isInRangedWeaponRange = false;
		let isInMeleeRange = false;

		allPcCoords.forEach(pc => {
			if (pc.id !== this.props.activeCharacter) {
				let temp = this._unblockedPathsToNearbyTiles(`${pc.coords.xPos}-${pc.coords.yPos}`, this.props.playerCharacters[pc.id].lightRange);
				for (const tileType of Object.values(temp)) {
					otherPcVisibleTiles = otherPcVisibleTiles.concat(tileType.floors);
				}
			}
		});

		if (creatureCoords) {
			if (weaponData.stats.ranged) {
				const creaturePos = `${creatureCoords.xPos}-${creatureCoords.yPos}`;
				const otherPcTilePos = Object.keys(otherPcVisibleTiles);
				let tiles = [];
				for (const distance of Object.values(activePcVisibleTiles)) {
					tiles = tiles.concat(Object.keys(distance.floors));
				}
	//todo: add new function to check line of sight
				if (tiles.includes(creaturePos) || (otherPcTilePos.includes(creaturePos))) {
					isInRangedWeaponRange = true;
				}
			} else if (Math.abs(creatureCoords.xPos - activePlayerCoords.xPos) <= 1 && Math.abs(creatureCoords.yPos - activePlayerCoords.yPos) <= 1) {
				isInMeleeRange = true;
			}
		}
		return isInRangedWeaponRange || isInMeleeRange;
	}

	/**
	 *
	 * @param startTileCoords
	 * @param endTileCoords
	 * @returns {boolean|*[]}
	 */
	pathFromAtoB(startTileCoords, endTileCoords) {
		const allPcPos = this.props.getAllCharactersPos('player', 'pos');
//todo: need allObjectPos
		const allObjectPos = [];

		let tilePath = [];
		let startingPos = '';
		let currentX = startTileCoords.xPos;
		let currentY = startTileCoords.yPos;
		const startXDelta = Math.abs(endTileCoords.xPos - startTileCoords.xPos);
		const startYDelta = Math.abs(endTileCoords.yPos - startTileCoords.yPos);
		const startRating = startXDelta + startYDelta;
		let foundClosedDoor = false;
		let checkedTiles = {[startingPos]: {rating: startRating}};
		const modifierPairs = [
			{x: -1, y: -1},
			{x: 0, y: -1},
			{x: 1, y: -1},
			{x: 1, y: 0},
			{x: 1, y: 1},
			{x: 0, y: 1},
			{x: -1, y: 1},
			{x: -1, y: 0}
		];
		let noPathAvail = false;

		const checkForCleanPath = (currentPos, coords, rating) => {
			let testPos = `${coords.xPos}-${coords.yPos}`;
			let isTestPosOk = true;

			// if (checkLineOfSight) {
			// 	isLineOfSight = !allCreaturePos.find(creature => creature.pos === testPos) &&
			// 		this.state.mapLayout[testPos].type !== 'wall' && !allObjectPos.find(obj => obj.pos === testPos);
			// }
			if (this.state.mapLayout[testPos].type === 'door' && !this.state.mapLayout[testPos].doorIsOpen) {
				foundClosedDoor = true;
			}

			const isWalkableTile = this.state.mapLayout[testPos].type === 'floor' || (this.state.mapLayout[testPos].type === 'door' && this.state.mapLayout[testPos].doorIsOpen);

			if (this.state.mapLayout[testPos].type === 'wall' || foundClosedDoor || (isWalkableTile && (allPcPos.find(pc => pc.pos === testPos)))) {
				checkedTiles[testPos] = {rating: 0};
				if (checkedTiles[currentPos]) {
					checkedTiles[currentPos][testPos] = 0;
				} else {
					checkedTiles[currentPos] = {[testPos]: 0};
				}
				isTestPosOk = false;
			} else {
				if (checkedTiles[currentPos]) {
					checkedTiles[currentPos][testPos] = rating;
				} else {
					checkedTiles[currentPos] = {[testPos]: rating};
				}
				checkedTiles[testPos] = {rating};
				currentX = coords.xPos;
				currentY = coords.yPos;
			}
			return isTestPosOk;
		}

		while (!noPathAvail && (currentX !== endTileCoords.xPos || currentY !== endTileCoords.yPos) && !foundClosedDoor) {
			let xDelta = endTileCoords.xPos - currentX;
			let yDelta = endTileCoords.yPos - currentY;
			const rating = Math.abs(xDelta) + Math.abs(yDelta);
			const initialXmod = xDelta < 0 ? -1 : xDelta > 0 ? 1 : 0;
			const initialYmod = yDelta < 0 ? -1 : yDelta > 0 ? 1 : 0;
			const modifiersIndex = modifierPairs.findIndex(pair => pair.x === initialXmod && pair.y === initialYmod);
			const secondaryMods = {
				2: modifiersIndex === 0 ? 7 : modifiersIndex - 1,
				3: modifiersIndex === 7 ? 0 : modifiersIndex + 1,
				4: modifiersIndex === 0 ? 6 : modifiersIndex === 1 ? 7 : modifiersIndex - 2,
				5: modifiersIndex === 7 ? 1 : modifiersIndex === 6 ? 0 : modifiersIndex + 2,
				6: modifiersIndex === 0 ? 5 : modifiersIndex === 1 ? 6 : modifiersIndex === 2 ? 7 : modifiersIndex - 3,
				7: modifiersIndex === 7 ? 2 : modifiersIndex === 6 ? 1 : modifiersIndex === 5 ? 0 : modifiersIndex + 3,
				8: modifiersIndex === 7 ? 3 : modifiersIndex === 6 ? 2 : modifiersIndex === 5 ? 1 : modifiersIndex === 4 ? 0 : modifiersIndex + 4
			};
			const coordsToCheck = [
				{xPos: currentX + initialXmod, yPos: currentY + initialYmod},
				{xPos: currentX + modifierPairs[secondaryMods[2]].x, yPos: currentY + modifierPairs[secondaryMods[2]].y},
				{xPos: currentX + modifierPairs[secondaryMods[3]].x, yPos: currentY + modifierPairs[secondaryMods[3]].y},
				{xPos: currentX + modifierPairs[secondaryMods[4]].x, yPos: currentY + modifierPairs[secondaryMods[4]].y},
				{xPos: currentX + modifierPairs[secondaryMods[5]].x, yPos: currentY + modifierPairs[secondaryMods[5]].y},
				{xPos: currentX + modifierPairs[secondaryMods[6]].x, yPos: currentY + modifierPairs[secondaryMods[6]].y},
				{xPos: currentX + modifierPairs[secondaryMods[7]].x, yPos: currentY + modifierPairs[secondaryMods[7]].y},
				{xPos: currentX + modifierPairs[secondaryMods[8]].x, yPos: currentY + modifierPairs[secondaryMods[8]].y}
			];
			let tileIndex = 0;
			let newPos = null;
			while (tileIndex < 8 && !newPos && !foundClosedDoor) {
				startingPos = `${currentX}-${currentY}`;
				newPos = `${coordsToCheck[tileIndex].xPos}-${coordsToCheck[tileIndex].yPos}`;
				// should never revisit checked tile (except through backtracking 12 lines below)
				if (checkedTiles[newPos] || !checkForCleanPath(startingPos, coordsToCheck[tileIndex], rating)) {
					newPos = null;
					tileIndex++;
				}
			}
			if (newPos) {
				startingPos = newPos;
				tilePath.push(newPos);
			} else if (tilePath.length === 0) {
				noPathAvail = true;
			} else if (!foundClosedDoor) {
				// if current startingPos is a dead end, then we didn't find a lower rated pos and need to back up
				tilePath.pop();
				if (tilePath.length > 0) {
					const lastTileIndex = tilePath.length-1;
					let lowestRating = rating;
					let lowestRatedPos = null;
					// mark the dead end tile
					checkedTiles[tilePath[lastTileIndex]][startingPos] = 0;
					checkedTiles[startingPos] = {rating: 0};
					let pathCopy = [...tilePath];
					// starting from end of path, check each tile for the lowest rated connection that isn't 0
					for (let i = lastTileIndex; i >= 0; i--) {
						for (const [pos, rating] of Object.entries(checkedTiles[tilePath[i]])) {
							// the tiledata includes a rating and up to 8 connected positions, so we need to weed out the one key that's a rating
							if (pos !== 'rating' && rating < lowestRating && rating !== 0) {
								lowestRating = rating;
								lowestRatedPos = pos;
							}
						}
						if (lowestRatedPos) {
							const newCoords = lowestRatedPos.split('-');
							currentX = +newCoords[0];
							currentY = +newCoords[1];
							i = -1;
						} else {
							// all tile's connections are 0
							pathCopy.pop();
							if (i > 0) {
								checkedTiles[tilePath[i-1]][tilePath[i]] = 0;
							} else {
								checkedTiles[`${startTileCoords.xPos}-${startTileCoords.yPos}`][tilePath[i]] = 0;
							}
							checkedTiles[tilePath[i]] = {rating: 0};
						}
					}
					tilePath = [...pathCopy];
				}
				if (tilePath.length === 0) {
					currentX = startTileCoords.xPos;
					currentY = startTileCoords.yPos;
				}
			}
		}

		return tilePath;
	}

	/**
	 * Find all tiles out to 'range' number of rings surrounding center,
	 * then find tiles of those that have unblocked lines of sight(LOS) to the center
	 * @param centerTilePos {string} : position of player (ex. '1-2')
	 * @param range {number} : perception/light radius
	 * @returns {
	 *  {
	 *      oneAway: {floors: {[tilePosString]: {xPos, yPos}}, walls: {[tilePosString]: {xPos, yPos}}},
	 *      twoAway: {floors: {[tilePosString]: {xPos, yPos}}, walls: {[tilePosString]: {xPos, yPos}}},
	 *      threeAway: {floors: {[tilePosString]: {xPos, yPos}}, walls: {[tilePosString]: {xPos, yPos}}},
	 *      etc
	 *  }
	 * }
	 * @private
	 */
	_unblockedPathsToNearbyTiles(centerTilePos, range) {
		const centerTile = this.state.mapLayout[centerTilePos];
		const numToStr = [null, 'one', 'two', 'three', 'four', 'five'];
		let nearbyTiles = {};
		let lineOfSightTiles = {};
		let minXBoundary = (centerTile.xPos - range) < 0 ? 0 : centerTile.xPos - range;
		let minYBoundary = (centerTile.yPos - range) < 0 ? 0 : centerTile.yPos - range;
		/**
		 * Looks at two adjacent tiles, one farther away from character than other,
		 * and determines if there is Line of Sight (LOS) between them
		 * @param distance: number
		 * @param farthestTilePos: string
		 * @param farthestTileData: object
		 * @param fartherTileData: object
		 */
		const compareTiles = (distance, farthestTilePos, farthestTileData, fartherTileData) => {
			const distString = `${numToStr[distance]}Away`;
			const distPlus1String = `${numToStr[distance+1]}Away`;
			for (const closestTileData of Object.values(lineOfSightTiles[distString].floors)) {
				const deltaXFartherTiles = Math.abs(distance === 1 ? farthestTileData.xPos - closestTileData.xPos : farthestTileData.xPos - fartherTileData.xPos);
				const deltaYFartherTiles = Math.abs(distance === 1 ? farthestTileData.yPos - closestTileData.yPos : farthestTileData.yPos - fartherTileData.yPos);
				const deltaXCloserTiles = Math.abs(distance === 1 ? closestTileData.xPos - centerTile.xPos : fartherTileData.xPos - closestTileData.xPos);
				const deltaYCloserTiles = Math.abs(distance === 1 ? closestTileData.yPos - centerTile.yPos : fartherTileData.yPos - closestTileData.yPos);
				const outerTileHasLOS =
					(deltaXFartherTiles <= 1 && deltaXCloserTiles <= 1 && deltaYFartherTiles === 1) ||
					(deltaYFartherTiles <= 1 && deltaYCloserTiles <= 1 && deltaXFartherTiles === 1);

				// if one of the 1 away tiles that has line of sight is between the current 2 away tile and center tile...
				if (outerTileHasLOS)
				{
					if (farthestTileData.type === 'wall' || (farthestTileData.type === 'door' && !farthestTileData.doorIsOpen)) {
						lineOfSightTiles[distPlus1String].walls[farthestTilePos] = farthestTileData;
					} else {
						lineOfSightTiles[distPlus1String].floors[farthestTilePos] = farthestTileData;
					}
				}
			}
		};

		for (let i=1; i <= range; i++) {
			const distance = `${numToStr[i]}Away`;
			if (i > 1) {
				nearbyTiles[distance] = {floors: {}, walls: {}};
			}
			lineOfSightTiles[distance] = {floors: {}, walls: {}};
		}

		// collect all tiles that are 1-range tiles away from center
		for (let xCount = minXBoundary; xCount <= centerTile.xPos + range; xCount++) {
			for (let yCount = minYBoundary; yCount <= centerTile.yPos + range; yCount++) {
				const tilePos = xCount + '-' + yCount;
				const currentTile = this.state.mapLayout[tilePos];
				if (currentTile && tilePos !== centerTilePos) {
					const horizDeltaFromCenter = Math.abs(centerTile.xPos - currentTile.xPos);
					const vertDeltaFromCenter = Math.abs(centerTile.yPos - currentTile.yPos);
					const greaterOrCommonDistance = horizDeltaFromCenter >= vertDeltaFromCenter ? horizDeltaFromCenter : vertDeltaFromCenter;
					const distance = `${numToStr[greaterOrCommonDistance]}Away`;
					if (currentTile.type === 'wall' || (currentTile.type === 'door' && !currentTile.doorIsOpen)) {
						if (greaterOrCommonDistance === 1) {
							lineOfSightTiles[distance].walls[tilePos] = currentTile;
						} else {
							nearbyTiles[distance].walls[tilePos] = currentTile;
						}
					} else {
						if (greaterOrCommonDistance === 1) {
							lineOfSightTiles[distance].floors[tilePos] = currentTile;
						} else {
							nearbyTiles[distance].floors[tilePos] = currentTile;
						}
					}
				}
			}
		}

		// now find tiles two tiles from center that have line of sight
		let floorsAndWalls = {...nearbyTiles.twoAway.floors, ...nearbyTiles.twoAway.walls};
		for (const [twoAwayTilePos, twoAwayTileData] of Object.entries(floorsAndWalls)) {
			compareTiles(1, twoAwayTilePos, twoAwayTileData);
		}

		// now find tiles three or more tiles from center that have line of sight
		for (let dist=3; dist <= range; dist++) {
			const distString = `${numToStr[dist]}Away`;
			const distMinus1String = `${numToStr[dist-1]}Away`;
			floorsAndWalls = {...nearbyTiles[distString].floors, ...nearbyTiles[distString].walls};
			for (const [farthestTilePos, farthestTileData] of Object.entries(floorsAndWalls)) {
				for (const fartherTileData of Object.values(lineOfSightTiles[distMinus1String].floors)) {
					compareTiles(dist-1, farthestTilePos, farthestTileData, fartherTileData);
				}
			}
		}

		return lineOfSightTiles;
	}

	/**
	 * Finds all visible/lit tiles within range of all PCs
	 * @param allPlayersPos: array of objects ({id, pos: '(pos)'}
	 * @returns object {combined floors/walls from _unblockedPathsToNearbyTiles for all PCs}
	 * @private
	 */
	_getTilesSurroundingAllPCs(allPlayersPos) {
		let lineOfSightTiles = {};
		// get all floors/walls around each player
		allPlayersPos.forEach(player => {
			const range = this.props.playerCharacters[player.id].lightRange;
			const tempTiles = this._unblockedPathsToNearbyTiles(player.pos, range);
			for (const [distance, tiles] of Object.entries(tempTiles)) {
				if (!lineOfSightTiles[distance]) {
					lineOfSightTiles[distance] = {floors: {}, walls: {}};
				}
				lineOfSightTiles[distance].floors = Object.assign(lineOfSightTiles[distance].floors, tiles.floors);
				lineOfSightTiles[distance].walls = Object.assign(lineOfSightTiles[distance].walls, tiles.walls);
			}
		});
		return lineOfSightTiles;
	}

	/**
	 * Looks at all visible/lit tiles around all PCs and lists all creatures that should be
	 * added to or removed from the App's threatList
	 * @param playerPositions: array of player pos data (from getAllCharactersPos in App)
	 * @param creaturePositions: array of creature pos data (from getAllCharactersPos in App)
	 * @returns {{threatListToAdd: array, threatListToRemove: array}} (both arrays contain strings (IDs))
	 * @private
	 */
	_findChangesToNearbyThreats(playerPositions, creaturePositions) {
		const tilesInView = this._getTilesSurroundingAllPCs(playerPositions);
		let threatLists = {
			threatListToAdd: [],
			threatListToRemove: [...this.props.threatList]
		};
		for (const tiles of Object.values(tilesInView)) {
			creaturePositions.forEach(creature => {
				if (tiles.floors[creature.pos]) {
					if (!this.props.threatList.includes(creature.id)) {
						threatLists.threatListToAdd.push(creature.id);
					} else if (threatLists.threatListToRemove.includes(creature.id)) {
						threatLists.threatListToRemove.splice(threatLists.threatListToRemove.indexOf(creature.id), 1);
					}
				}
			});
		}
		return threatLists;
	}

	/**
	 * Called by render() and spawns all PCs and NPCs/creatures on the map, creating a Character component for each one
	 * @param props: Object passed from render(): {characterType: String}
	 * @returns Array (of Character components)
	 */
	addCharacters = (props) => {
		const characters = props.characterType === 'player' ? {...this.props.playerCharacters} : {...this.props.mapCreatures};
		const characterIDs = Object.keys(characters);
		let lineOfSightTiles = {}
		let characterList = [];
		let characterTransform = null;
		let characterCoords = {};
		let creatureIsHidden = false;

		characterIDs.forEach(id => {
			characterCoords = characters[id].coords;
			if (props.characterType === 'player') {
				characterTransform = this._calculateObjectTransform(characterCoords.xPos, characterCoords.yPos);
			} else {
				// hide all creatures from rendering unless creature is in sight of any PC
				const characterPos = characterCoords.xPos + '-' + characterCoords.yPos;
				creatureIsHidden = true;
				for (const playerData of Object.values(this.props.playerCharacters)) {
					lineOfSightTiles = this._unblockedPathsToNearbyTiles(`${playerData.coords.xPos}-${playerData.coords.yPos}`, playerData.lightRange);
					for (const tileData of Object.values(lineOfSightTiles)) {
						if (tileData.floors[characterPos]) {
							creatureIsHidden = false;
						}
					}
				}
				characterTransform = this._calculateObjectTransform(characterCoords.xPos, characterCoords.yPos);
			}

			this.charRefs[id] = useRef(null);
			const numberInID = id.search(/\d/);
			const idEndIndex = numberInID > -1 ? numberInID : id.length;
			const idConvertedToClassName = convertCamelToKabobCase(id.substring(0, idEndIndex));
			characterList.push(
				<Character
					id={id}
					key={id}
					charRef={this.charRefs[id]}
					characterType={characters[id].type}
					idClassName={idConvertedToClassName}
					isHidden={creatureIsHidden}
					isSelected={characters[id].isSelected}
					isDead={characters[id].currentHP <= 0}
					isInRange={
						Object.keys(this.props.weaponButtonSelected).length > 0 &&
						props.characterType === 'creature' &&
						this.props.playerCharacters[this.props.activeCharacter] &&
						this.isCreatureInRange(id, this.props.weaponButtonSelected)
					}
					dataLoc={characterCoords}
					dataCharType={props.characterType}
					clickUnit={this.props.handleUnitClick}
					styles={{
						transform: `translate(${characterTransform})`,
						width: Math.round(this.tileSize * this.characterSizePercentage) + 'px',
						height: Math.round(this.tileSize * this.characterSizePercentage) + 'px',
						margin: Math.round(this.tileSize / 8) + 'px'
					}}
				/>
			)
		});
		return characterList;
	}

	/**
	 * Wrapper called by render() to run all object spawning functions
	 * that will add their returned components to an array
	 * @returns Array (of object components)
	 */
	addObjects = () => {
		let allObjects = [];
		allObjects.push(...this._addDoors(), this._addExit());

		return allObjects;
	}

	/**
	 * Sets to state the position for the exit object
	 * @private
	 */
	_setExitPosition() {
		const tilePositions = Object.keys(this.state.mapLayout).filter(tilePos => this.state.mapLayout[tilePos].type === 'floor');
		const pickRandomLoc = () => {
			return tilePositions[Math.floor(Math.random() * tilePositions.length)];
		}
		let exitPosition = pickRandomLoc();
		let allPlayerPos = [];

		this.props.getAllCharactersPos('player', 'pos').forEach(player => {
			allPlayerPos.push(player.pos);
		});
		while (allPlayerPos.includes(exitPosition)) {
			exitPosition = pickRandomLoc();
		}
		const exitCoords = exitPosition.split('-');
		this.setState({exitPosition: {xPos: +exitCoords[0], yPos: +exitCoords[1]}, exitPlaced: true});
	}

	/**
	 * Creates Exit component
	 * Note - may end up broadening this to add other objects too
	 * @returns {JSX.Element} (Exit component)
	 * @private
	 */
	_addExit() {
		return (<Exit
			key={'exit-' + this.state.exitPosition.xPos + '-' + this.state.exitPosition.yPos}
			styleProp={{
				transform: `translate(${this._calculateObjectTransform(this.state.exitPosition.xPos, this.state.exitPosition.yPos)})`,
				width: this.tileSize + 'px',
				height: this.tileSize + 'px'
			}} />);
	}

	/**
	 * Creates and transforms Door components
	 * Could be used for other objects and/or merged with _addExit
	 * @returns Array (of Door components)
	 * @private
	 */
	_addDoors() {
		let objects = [];

		for (const [tilePos, tileData] of Object.entries(this.state.mapLayout)) {
			const tileCoords = tilePos.split('-');
			if (tileData.type === 'door') {
				let doorClass = this.currentMapData.name + ' object';
				if (tileData.classes.includes('top-bottom-door')) {
					doorClass += tileData.doorIsOpen ? ' front-door-open' : ' front-door';
				} else if (tileData.classes.includes('left-door')) {
					doorClass += tileData.doorIsOpen ? ' left-side-door-open' : ' side-door';
				} else {
					doorClass += tileData.doorIsOpen ? ' right-side-door-open' : ' side-door';
				}
				objects.push(
					<Door
						key={`object-${tilePos}`}
						styleProp={{
							transform: `translate(${this._calculateObjectTransform(+tileCoords[0], +tileCoords[1])})`,
						}}
						classProp={doorClass}
					/>
				)
			}
		}
		return objects;
	}

	/**
	 * Called by render() to add LightElement tile components to map representing tile lighting
	 * @returns Array (of LightElement components)
	 */
	addLighting = () => {
		let tiles = [];
		const allPlayersPos = this.props.getAllCharactersPos('player', 'pos');
		let allPlayersCoords = [];
		allPlayersPos.forEach(player => {
			allPlayersCoords.push(player.pos);
		});
		// get all lit floors/walls around each player
		let lineOfSightTiles = this._getTilesSurroundingAllPCs(allPlayersPos);

		for (const tilePos of Object.keys(this.state.mapLayout)) {
			let allClasses = 'light-tile';

			if (allPlayersCoords.includes(tilePos)) {
				allClasses += ' very-bright-light black-light';
			} else if (lineOfSightTiles.oneAway && (lineOfSightTiles.oneAway.floors[tilePos] || lineOfSightTiles.oneAway.walls[tilePos])) {
				allClasses += ' bright-light black-light';
			} else if (lineOfSightTiles.twoAway && (lineOfSightTiles.twoAway.floors[tilePos] || lineOfSightTiles.twoAway.walls[tilePos])) {
				allClasses += ' bright-med-light black-light';
			} else if (lineOfSightTiles.threeAway && (lineOfSightTiles.threeAway.floors[tilePos] || lineOfSightTiles.threeAway.walls[tilePos])) {
				allClasses += ' med-light black-light';
			} else if (lineOfSightTiles.fourAway && (lineOfSightTiles.fourAway.floors[tilePos] || lineOfSightTiles.fourAway.walls[tilePos])) {
				allClasses += ' med-low-light black-light';
			} else if (lineOfSightTiles.fiveAway && (lineOfSightTiles.fiveAway.floors[tilePos] || lineOfSightTiles.fiveAway.walls[tilePos])) {
				allClasses += ' low-light black-light';
			} else if (this.state.playerVisited[tilePos]) {
				allClasses += ' ambient-light black-light';
			} else {
				allClasses += ' no-light black-light';
			}
			const xPos = (this.state.mapLayout[tilePos].xPos * this.tileSize) + 'px';
			const yPos = (this.state.mapLayout[tilePos].yPos * this.tileSize) + 'px';
			const size = this.tileSize + 'px';
			const tileStyle = {
				transform: `translate(${xPos}, ${yPos})`,
				width: size,
				height: size
			};
			tiles.push(<LightElement
				key={tilePos}
				styles={tileStyle}
				tileName={this.state.mapLayout[tilePos].xPos + '-' + this.state.mapLayout[tilePos].yPos}
				classes={allClasses} />);
		}
		return tiles;
	}


	/*******************
	 * MAP INTERACTION
	 *******************/

	/**
	 * Animates component objects. Not currently in use (using css transitions)
	 * @param id
	 * @param props
	 * @private
	 */
	_animateObject(id, props) {
		const transforms = [
			{transform: `translate(${this._calculateObjectTransform(props.firstCoords.xPos, props.firstCoords.yPos)})`},
			{transform: `translate(${this._calculateObjectTransform(props.secondCoords.xPos, props.secondCoords.yPos)})`}
		];
		const transformsTiming = {
			duration: 500
		};
		this.charRefs[id].current.animate(transforms, transformsTiming);
	}

	/**
	 * Determines if user's key/tap/click movement command is valid, and if so, updates coords for the active PC,
	 * then calls _moveMap to keep the active PC centered on screen,
	 * then if in combat, updates the threatList, and if not, calls moveCharacter again to move followers
	 * @param tilePath: Array (of pos (String) - optional - only passed in follow mode)
	 * @param newTile: String (optional - for either one move during combat or when moving followers)
	 * @param pcToMove: String (optional - ID of follower to move)
	 */
	moveCharacter = (tilePath, newTile = null, pcToMove = null) => {
		const newTilePos = newTile || tilePath[0];
		if (!pcToMove) {
			tilePath.shift();
		}
		const activePcData = this.props.playerCharacters[this.props.activeCharacter];
		if (this.props.isInCombat && this.props.activePlayerMovesCompleted >= this.props.playerMovesLimit) {
			const showDialog = true;
			const dialogProps = {
				dialogContent: `${activePcData.name} has no more moves this turn`,
				closeButtonText: 'Ok',
				closeButtonCallback: null,
				disableCloseButton: false,
				actionButtonVisible: false,
				actionButtonText: '',
				actionButtonCallback: null,
				dialogClasses: ''
			};
			this.props.setShowDialogProps(showDialog, dialogProps);
			return;
		}
		let newCoords = newTilePos.split('-');
		let playerPositions = this.props.getAllCharactersPos('player', 'pos');
		const activePC = this.props.isInCombat ? this.props.activeCharacter : pcToMove ? pcToMove : this.props.activeCharacter;

		// Find all visited tiles for determining lighting
		const playerVisitedUpdatedState = {...this.state.playerVisited, ...this._findVisitedTiles(newCoords)};

		// Find any creatures in range that could be a threat
		const creaturePositions = this.props.getAllCharactersPos('creature', 'pos');
		const activePlayerIndex = playerPositions.findIndex(element => element.id === activePC);
		playerPositions[activePlayerIndex].pos = newTilePos;
		const threatLists = this._findChangesToNearbyThreats(playerPositions, creaturePositions);

		const followModeMoves = !this.props.isInCombat ? [...this.state.followModeMoves] : [];
		// only update followModeMoves if we're moving the leader
		// newest pos at end, oldest pos at beginning of array
		if (!this.props.isInCombat && activePC === this.props.activeCharacter) {
			followModeMoves.unshift(newTilePos);
			if (followModeMoves.length === 6) {
				followModeMoves.pop();
			}
		}
		const coordData = {coords: {xPos: +newCoords[0], yPos: +newCoords[1]}};
		this.props.updateCharacters('player', coordData, activePC, false, false, () => {
			this.setState(prevState => ({
				playerVisited: playerVisitedUpdatedState || {...prevState.playerVisited},
				playerPlaced: true,
				followModeMoves
			}), () => {
				this._moveMap();
				if (tilePath.length === 0) {
					this._checkForExit();
				}
				const isCurrentlyInCombat = this.props.isInCombat;
				if (threatLists.threatListToAdd.length > 0 || threatLists.threatListToRemove.length > 0) {
					this.props.updateThreatList(threatLists.threatListToAdd, threatLists.threatListToRemove, () => {
						// need to use preset value so if just now coming across threats, won't update player move count
						if (isCurrentlyInCombat) {
							this.props.updateActivePlayerMoves();
						}
					})
				} else if (this.props.isInCombat) {
					this.props.updateActivePlayerMoves();
				} else if (!this.props.isInCombat) {
					// strip out the ids to make finding available pos easier
					const listOfPlayerPos = playerPositions.map(player => player.pos);
					let newFollowerPos = this.state.followModeMoves.find(pos => !listOfPlayerPos.includes(pos));
					// if leader has moved at least 2x, there is at least 1 follower, and pc just moved was the leader,
					// then call moveCharacter to update first follower next avail pos in followModeMoves array
					if (this.state.followModeMoves.length >= 2 && this.props.playerFollowOrder.length >= 2 && !pcToMove) {
						setTimeout(() => {
							this.moveCharacter(tilePath, newFollowerPos, this.props.playerFollowOrder[1]);
						}, this.movementDelay);

					// if leader has moved 3x, there are 2 followers, and 1st follower was just moved,
					// then call moveCharacter to update second follower to next avail pos in followModeMoves array
					} else if (this.state.followModeMoves.length >= 3 && this.props.playerFollowOrder.length === 3 && pcToMove === this.props.playerFollowOrder[1]) {
						setTimeout(() => {
							this.moveCharacter(tilePath, newFollowerPos, this.props.playerFollowOrder[2]);
						}, this.movementDelay);
					// otherwise, moving to next tile in path
					} else if (tilePath.length > 0) {
						// to force characters to move one space at a time
						setTimeout(() => {
							this.moveCharacter(tilePath);
						}, this.movementDelay);
					}
				}
			});
		});
	}

	/**
	 * For dungeons only:
	 * If PC hasn't visited the current tile,
	 * gets a collection of the 8 tiles surrounding current one that are walls in order to light them,
	 * since only visited tiles are lit
	 * @param newCoords: Array
	 * @returns Object (containing tile coords)
	 * @private
	 */
	_findVisitedTiles(newCoords) {
		const visitedTile = `${newCoords[0]}-${newCoords[1]}`;
		let surroundingTilesCoords = {};
		if (this.state.playerVisited[visitedTile]) {
			return surroundingTilesCoords;
		}

		const xMinusOne = (+newCoords[0] - 1) < 0 ? 0 : +newCoords[0] - 1;
		const yMinusOne = (+newCoords[1] - 1) < 0 ? 0 : +newCoords[1] - 1;
		// list of surrounding tiles that are walls
		let surroundingTilesList = [
			`${xMinusOne}-${yMinusOne}`,
			`${+newCoords[0]}-${yMinusOne}`,
			`${+newCoords[0]+1}-${yMinusOne}`,
			`${xMinusOne}-${+newCoords[1]}`,
			`${+newCoords[0]+1}-${+newCoords[1]}`,
			`${xMinusOne}-${+newCoords[1]+1}`,
			`${+newCoords[0]}-${+newCoords[1]+1}`,
			`${+newCoords[0]+1}-${+newCoords[1]+1}`
		].filter(tile => this.state.mapLayout[tile] && this.state.mapLayout[tile].type === 'wall');

		surroundingTilesList.push(visitedTile);
		surroundingTilesList.forEach(tile => {
			surroundingTilesCoords[tile] = {
				xPos: +tile.split('-')[0],
				yPos: +tile.split('-')[1]
			}
		});
		return surroundingTilesCoords;
	}

	/**
	 * Used to determine if player/creature can move to specified tile (ie. not already occupied, not wall, not closed door)
	 * @param tileCoords: Object
	 * @param characterType: String (type that is trying to move - 'player' or 'creature')
	 * @returns {boolean}
	 * @private
	 */
	_tileIsFreeToMove(tileCoords, characterType = 'creature') {
		let tileIsAvail = true;
		const tilePos = `${tileCoords.xPos}-${tileCoords.yPos}`;
		const tile = this.state.mapLayout[tilePos];
		const allCharCoords = [...this.props.getAllCharactersPos('creature', 'coords'), ...this.props.getAllCharactersPos('player', 'coords')];

		let i = 0;
		if (!tile || tile.type === 'wall' || (characterType === 'creature' &&  tile.type === 'door' && !tile.doorIsOpen)) {
			tileIsAvail = false;
		} else {
			while (tileIsAvail && i < allCharCoords.length) {
				if (allCharCoords[i].coords.xPos === tileCoords.xPos && allCharCoords[i].coords.yPos === tileCoords.yPos) {
					tileIsAvail = false;
				}
				i++;
			}
		}
		return tileIsAvail;
	}

	/**
	 * Finds tile for creature to move to that is either toward (1) or away from (-1) PC(s)
	 * @param creatureCoords: Object
	 * @param directionModifier: Integer (1 or -1)
	 * @param targetPlayerPos: String (pos of target PC to move toward - only passed in if directionModifier === 1)
	 * @returns {{yPos, xPos}}
	 * @private
	 */
	_findNewCreatureCoordsRelativeToChar(creatureCoords, directionModifier, targetPlayerPos = null) {
		const calcModifiers = (xValue, yValue, xComparison, yComparison) => {
			let mods = {};
			if (xValue < xComparison) {
				mods = yValue < yComparison ? {primary: {x: -1, y: -1}, alt1: {x: -1, y: 0}, alt2: {x: 0, y: -1}, alt3: {x: -1, y: 1}, alt4: {x: 1, y: -1}} :
					yValue === yComparison ? {primary: {x: -1, y: 0}, alt1: {x: -1, y: 1}, alt2: {x: -1, y: -1}, alt3: {x: 0, y: 1}, alt4: {x: 0, y: -1}} :
					{primary: {x: -1, y: 1}, alt1: {x: -1, y: 0}, alt2: {x: 0, y: 1}, alt3: {x: -1, y: -1}, alt4: {x: 1, y: 1}};
			} else if (xValue === xComparison) {
				mods = yValue < yComparison ? {primary: {x: 0, y: -1}, alt1: {x: -1, y: -1}, alt2: {x: 1, y: -1}, alt3: {x: -1, y: 0}, alt4: {x: 1, y: 0}} :
					{primary: {x: 0, y: 1}, alt1: {x: -1, y: 1}, alt2: {x: 1, y: 1}, alt3: {x: -1, y: 0}, alt4: {x: 1, y: 0}};
			} else {
				mods = yValue < yComparison ? {primary: {x: 1, y: -1}, alt1: {x: 0, y: -1}, alt2: {x: 1, y: 0}, alt3: {x: -1, y: -1}, alt4: {x: 1, y: 1}} :
					yValue === yComparison ? {primary: {x: 1, y: 0}, alt1: {x: 1, y: -1}, alt2: {x: 1, y: 1}, alt3: {x: 0, y: -1}, alt4: {x: 0, y: 1}} :
					{primary: {x: 1, y: 1}, alt1: {x: 1, y: 0}, alt2: {x: 0, y: 1}, alt3: {x: 1, y: -1}, alt4: {x: -1, y: 1}};
			}
			return mods;
		};
		let newCreatureCoords = {xPos: creatureCoords.xPos, yPos: creatureCoords.yPos};
		let modifiers = {};

		// move toward target PC
		if (directionModifier === 1) {
			const targetCoords = targetPlayerPos.split('-');
			const newDistX = targetCoords[0] - creatureCoords.xPos;
			const newDistY = targetCoords[1] - creatureCoords.yPos;
			modifiers = calcModifiers(newDistX, newDistY, 0, 0);

		// move away from all PCs
		} else {
			const allPlayersCoords = this.props.getAllCharactersPos('player', 'coords');
			let avgXCoord = 0;
			let avgYCoord = 0;
			let numPCs = allPlayersCoords.length;
			allPlayersCoords.forEach(pos => {
				avgXCoord += pos.coords.xPos;
				avgYCoord += pos.coords.yPos;
			});
			avgXCoord = avgXCoord / numPCs;
			avgYCoord = avgYCoord / numPCs;
			modifiers = calcModifiers(creatureCoords.xPos, creatureCoords.yPos, avgXCoord, avgYCoord);
		}

		let altNum = 0
		let tileIsOccupied = true;
		let newX = 0;
		let newY = 0;
		while (altNum < 5 && tileIsOccupied) {
			if (altNum === 0) {
				newX = creatureCoords.xPos + modifiers.primary.x;
				newY = creatureCoords.yPos + modifiers.primary.y;
			} else {
				newX = creatureCoords.xPos + modifiers['alt' + altNum].x;
				newY = creatureCoords.yPos + modifiers['alt' + altNum].y;
			}
			if (this._tileIsFreeToMove({xPos: newX, yPos: newY})) {
				tileIsOccupied = false;
				newCreatureCoords.xPos = newX;
				newCreatureCoords.yPos = newY;
			} else {
				altNum++;
			}
		}

		return newCreatureCoords;
	}

	/**
	 * Saves to state (in App using props.updateCharacters) new coords for a creature, then either recursively calls again to save next coords in array
	 * or updates map creature data in App (which then calls callback if there is one)
	 * @param creatureID: String
	 * @param newCoords: Array (of coord objects representing each of a creature's moves)
	 * @param callback: Function (generally either updating current turn or doing creature attack and then updating turn)
	 * @private
	 */
	_storeNewCreatureCoords(creatureID, newCoords, callback) {
		let newCoordsArray = newCoords;
		const nextCoords = newCoordsArray.shift();
		const creatureData = {...this.props.mapCreatures};
		creatureData[creatureID].coords = nextCoords;

		this.props.updateCharacters('creature', creatureData[creatureID], creatureID, false, false, () => {
			if (newCoordsArray.length > 0) {
				this._storeNewCreatureCoords(creatureID, newCoordsArray, callback);
			} else {
				callback();
			}
		});
	}

	/**
	 * AI for creature behavior
	 * Basically a creature with a PC in view will either move toward it and/or attack it if in range
	 * or move away from it if its HP is below a threshold (set by this.creatureSurvivalHpPercent)
	 * @private
	 */
	_moveCreature() {
		const creatureID = this.props.activeCharacter;
		const creatureData = this.props.mapCreatures[creatureID];
		let creatureDidAct = false;

		if (creatureData.currentHP > 0) {
			let creatureCoords = creatureData.coords;
			const creaturePos = `${creatureCoords.xPos}-${creatureCoords.yPos}`;
			const lineOfSightTiles = this._unblockedPathsToNearbyTiles(creaturePos, creatureData.perception);
			const tilesToSearch = Object.values(lineOfSightTiles);
			if (tilesToSearch.length === 0) {
				return;
			}

			let newCreatureCoordsArray = [];
			let playerPos = '';
			let targetPlayerID = '';
			let targetPlayerPos = '';
			let targetPlayerDistance = null;
			let targetPlayerData = {};

			// find closest player for creature to focus on
			for (const [playerID, playerData] of Object.entries(this.props.playerCharacters)) {
				playerPos = `${playerData.coords.xPos}-${playerData.coords.yPos}`;
				let playerDistance = 0;
				let searchDistance = 0;
				let tileAtSearchDistance = tilesToSearch[searchDistance];
				while (playerDistance === 0 && searchDistance < tilesToSearch.length) {
					if (creatureData.perception >= searchDistance + 1 && tileAtSearchDistance.floors[playerPos]) {
						playerDistance = searchDistance + 1;
					}
					searchDistance++;
					tileAtSearchDistance = tilesToSearch[searchDistance];
				}

				if (playerDistance > 0 && (!targetPlayerDistance || playerDistance < targetPlayerDistance)) {
					targetPlayerDistance = playerDistance;
					targetPlayerPos = playerPos;
					targetPlayerID = playerID;
					targetPlayerData = playerData;
				}
			}

			// if a nearby PC was found
			if (targetPlayerDistance) {
				const updateThreatAndCurrentTurn = (forRemoval = false) => {
					if (forRemoval) {
						this.props.updateThreatList([], [creatureID], this.props.updateCurrentTurn);
					} else {
						this.props.updateThreatList([creatureID], [], this.props.updateCurrentTurn);
					}
				}
				// if creature is low on health
				if (creatureData.currentHP < (creatureData.startingHP * this.creatureSurvivalHpPercent)) {
					// if player char is within attack range, then attack
					if (targetPlayerDistance <= creatureData.range) {
						this.props.updateLog(`${creatureID} attacks player at ${JSON.stringify(targetPlayerPos)}`);
						this.props.mapCreatures[creatureID].attack(targetPlayerID, targetPlayerData, this.props.updateCharacters, this.props.updateLog);
					}
					// then move away from player
					for (let i = 1; i <= creatureData.moveSpeed; i++) {
						creatureCoords = this._findNewCreatureCoordsRelativeToChar(creatureCoords, -1);
						newCreatureCoordsArray.push(creatureCoords);
						// this.props.updateLog(`Moving ${creatureID} away from player to ${JSON.stringify(newCreatureCoordsArray)}`);
					}
					this._storeNewCreatureCoords(creatureID, newCreatureCoordsArray, () => {updateThreatAndCurrentTurn(true)});
				// or if player is out of attack range, move closer
				} else if (targetPlayerDistance > creatureData.range) {
					let moves = 1;
					while (moves <= creatureData.moveSpeed && targetPlayerDistance > creatureData.range) {
						creatureCoords = this._findNewCreatureCoordsRelativeToChar(creatureCoords, 1, targetPlayerPos);
						newCreatureCoordsArray.push(creatureCoords);
						moves++;
						targetPlayerDistance--;
						// this.props.updateLog(`Moving ${creatureID} toward player, to ${JSON.stringify(newCreatureCoordsArray)}`);
					}
					this._storeNewCreatureCoords(creatureID, newCreatureCoordsArray, () => {
						// if player char is within attack range, then attack
						if (targetPlayerDistance <= creatureData.range) {
							this.props.updateLog(`${creatureID} attacks player at ${JSON.stringify(targetPlayerPos)}`);
							this.props.mapCreatures[creatureID].attack(targetPlayerID, targetPlayerData, this.props.updateCharacters, this.props.updateLog, updateThreatAndCurrentTurn);
						} else {
							this.props.updateCurrentTurn();
						}
					});
					// otherwise player is in attack range, so attack
				} else {
					this.props.updateLog(`${creatureID} attacks player at ${JSON.stringify(targetPlayerPos)}`);
					this.props.mapCreatures[creatureID].attack(targetPlayerID, targetPlayerData, this.props.updateCharacters, this.props.updateLog, updateThreatAndCurrentTurn);
				}
				creatureDidAct = true;
			}

			// For creatures that don't act, still need to advance turn
			if (!creatureDidAct) {
				this.props.updateCurrentTurn();
			}
		}
	}

	/**
	 * Moves a creature in random directions.
	 * Currently not in use (but may use in daylight areas where all creatures are visible)
	 * @private
	 */
	_moveRandomly() {
		const creatureID = this.props.activeCharacter;
		const creatureData = this.props.mapCreatures[creatureID];
		const creatureCoords = creatureData.coords;
		let allCreatureMoves = [];
		let newRandX = 0;
		let newRandY = 0;
		for (let i=1; i <= creatureData.moveSpeed; i++) {
			newRandX = creatureCoords.xPos + randomTileMovementValue();
			newRandY = creatureCoords.yPos + randomTileMovementValue();
			if (this._tileIsFreeToMove({xPos: newRandX, yPos: newRandY})) {
				allCreatureMoves.push({xPos: newRandX, yPos: newRandY});

				// this.props.updateLog(`Moving ${creatureID} randomly to ${newRandX}, ${newRandY}`);
			}
		}
		if (allCreatureMoves.length > 0) {
			this._storeNewCreatureCoords(creatureID, allCreatureMoves);
		}
	}

	// todo: No longer needed? Was being used in moveCharacter, but from old map paradigm using tile sides to determine valid moves
	//
	// getSidesBetweenAdjacentTiles(mainTileLoc, adjTileLoc) {
	// 	let sides = [];
	// 	const adjTile = this.state.mapLayout[adjTileLoc];
	// 	const mainTile = this.state.mapLayout[mainTileLoc];
	//
	// 	if (mainTile.xPos - adjTile.xPos === -1) {
	// 		sides.push('rightSide');
	// 	}
	// 	if (mainTile.xPos - adjTile.xPos === 1) {
	// 		sides.push('leftSide');
	// 	}
	// 	if (mainTile.yPos - adjTile.yPos === -1) {
	// 		sides.push('bottomSide');
	// 	}
	// 	if (mainTile.yPos - adjTile.yPos === 1) {
	// 		sides.push('topSide');
	// 	}
	//
	// 	return sides;
	// }

	/**
	 * For keeping active character in center of screen while moving
	 * @param initialSetupCallback: Function (sets exit then creatures then key listeners)
	 * @private
	 */
	_moveMap(initialSetupCallback) {
		const playerID = this.props.activeCharacter;
		const activePlayerCoords = this.props.playerCharacters[playerID].coords;
		const windowCenter = this._calculateMapCenter();
		const scrollOptions = {
			left: (activePlayerCoords.xPos * this.tileSize) - windowCenter.xPos,
			top: (activePlayerCoords.yPos * this.tileSize) - windowCenter.yPos,
			behavior: "smooth"
		};

		window.scroll(scrollOptions);

		// passed in from _layoutPieces after setting mapLayout; called after placing PCs and centering map
		if (initialSetupCallback) {
			initialSetupCallback();
		}
	}

	/**
	 * Toggles door opens/closed (and plays the sound effect for it)
	 */
	toggleDoor = (doorTilePos) => {

	//todo: move play into separate sfx function
		this.sfxSelectors[this.currentMapData.name].door.play();
		this.setState(prevState => ({
			mapLayout: {
				...prevState.mapLayout,
				[doorTilePos]: {
					...prevState.mapLayout[doorTilePos],
					doorIsOpen: !prevState.mapLayout[doorTilePos].doorIsOpen
				}
			}
		}), () => {
			const allPlayerPos = this.props.getAllCharactersPos('player', 'pos');
			const creaturePositions = this.props.getAllCharactersPos('creature', 'pos');
			const threatLists = this._findChangesToNearbyThreats(allPlayerPos, creaturePositions);
			if (threatLists.threatListToAdd.length > 0 || threatLists.threatListToRemove.length > 0) {
				this.props.updateThreatList(threatLists.threatListToAdd, threatLists.threatListToRemove);
			}
		});
	}


	/***********************
	 * ELEMENTS AND EVENTS
	 ***********************/

	/**
	 * Called by render() to set up array of sound effects elements
	 * @returns {*[]}
	 */
	setupSoundEffects = () => {
		let effects = [];

		effects.push(<StoneDoor key='sfx-stonedoor' idProp='sfx-stonedoor' />);

		return effects;
	}

	/**
	 * Sets up selectors for sound effect elements
	 * @private
	 */
	_populateSfxSelectors() {
		this.sfxSelectors.catacombs['door'] = document.getElementById('sfx-stonedoor');
	}

	/**
	 * Sets up listeners for key commands
	 * @private
	 */
	_setupKeyListeners() {
		document.addEventListener('keydown', (e) => {
			if (e.code.startsWith('Arrow') || e.code.startsWith('Numpad')) {
				e.preventDefault();
				let direction = '';
				switch(e.code) {
					case 'ArrowLeft':
					case 'Numpad4':
						direction = 'left';
						break;
					case 'ArrowRight':
					case 'Numpad6':
						direction = 'right';
						break;
					case 'ArrowUp':
					case 'Numpad8':
						direction = 'up';
						break;
					case 'ArrowDown':
					case 'Numpad2':
						direction = 'down';
						break;
					case 'Numpad1':
						direction = 'up-left';
						break;
					case 'Numpad3':
						direction = 'up-right';
						break;
					case 'Numpad7':
						direction = 'down-left';
						break;
					case 'Numpad9':
						direction = 'down-right';
						break;
				}
				this.checkIfTileOrObject('', direction);
			}
		});
	}


	/***************************
	 * REACT LIFECYCLE FUNCTIONS
	 ***************************/

	componentDidMount() {
		if (this.initialMapLoad) {
			this._layoutPieces();
			this._populateSfxSelectors();
		}
	}

	componentDidUpdate(prevProps, prevState, snapShot) {
		if (prevProps.activeCharacter !== this.props.activeCharacter) {
			if (this.props.mapCreatures[this.props.activeCharacter]) {
				// timeout to allow UI to provide visible updates to player, like creatures moving in turn and turn indicator to show 'enemies moving'
				setTimeout(() => {
					this._moveCreature();
				}, this.movementDelay);
			} else if (this.props.playerCharacters[this.props.activeCharacter]) {
				this._moveMap();
			}
		}
	}

	// Add below for testing: <button onClick={this.resetMap}>Reset</button>
	render() {
		return (
			<div className="world">
				<div className="map">
					{ this.state.mapLayoutDone && <this.createAllMapPieces /> }
				</div>
				<div className="objects">
					{ this.state.exitPlaced && <this.addObjects /> }
				</div>
				<div className="lighting">
					{ this.state.exitPlaced && <this.addLighting /> }
				</div>
				<div className="creatures">
					{ this.state.mapLayoutDone && this.state.playerPlaced && this.state.creaturesPlaced && <this.addCharacters characterType='creature' /> }
				</div>
				<div className="player-characters">
					{ this.state.mapLayoutDone && this.state.playerPlaced && <this.addCharacters characterType='player' /> }
				</div>
				{ <this.setupSoundEffects /> }
			</div>
		);
	}
}

export default Map;
