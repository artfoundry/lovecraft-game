import React from 'react';
import MapData from './mapData.json';
import GameLocations from './gameLocations.json';
import CreatureData from './creatureTypes.json';
import Creature from './Creature';
import {Exit, LightElement, Character, Tile, Door} from './MapPieceElements';
import {StoneDoor} from './Audio';
import {unblockedPathsToNearbyTiles, convertCamelToKabobCase, randomTileMovementValue} from './Utils';

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

		this.mapLayoutTemp = {};
		this.sfxSelectors = {
			catacombs: {}
		};
		this.currentMapData = GameLocations[this.props.currentLocation];


		this.state = {
			pcTypes: this.props.pcTypes,
			playerPlaced: false,
			playerVisited: {},
			mapLayout: {},
			mapLayoutDone: false,
			mapPosition: {},
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
			playerVisited: {},
			mapLayout: {},
			mapLayoutDone: false,
			mapPosition: {},
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
	 * Initialization of the map containing loop that chooses and places tiles in temp storage,
	 * then runs a cleanup function to close up tile openings (halls, doorways) that weren't covered,
	 * then temp storage is saved into state, after which callback runs that places characters,
	 * then runs callback that places creatures and saves their coordinates to state,
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
			this.initialMapLoad = false;
			this.setState({
				mapLayoutDone: true,
				mapLayout: {...this.mapLayoutTemp}
			}, () => {
				this._setInitialCharacterCoords(() => {
					this._setExitPosition();
					this._setInitialCreatureData();
					if (this.pageFirstLoaded) {
						this.pageFirstLoaded = false;
						this._setupKeyListeners();
					}
				});
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
	 * Sets to state coordinates for all PCs when map first loads,
	 * then moves the map to center on active PC
	 * @param initialSetupCallback: Function
	 * @private
	 */
	_setInitialCharacterCoords(initialSetupCallback) {
		let updatedPlayerData = {...this.props.playerCharacters};
		let playerVisitedUpdatedState = {};

		for (const playerID of Object.keys(this.props.playerCharacters)) {
			const tileLoc = this._generateRandomLocation();
			const newCoords = tileLoc.split('-');
			playerVisitedUpdatedState = Object.assign(this.state.playerVisited, this._findVisitedTiles(newCoords));
			updatedPlayerData[playerID].coords = {xPos: +newCoords[0], yPos: +newCoords[1]};
		}

		this.props.updateCharacters('player', updatedPlayerData, null, false, () => {
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
		this.props.updateCharacters('creature', mapCreatures, null, true);
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
			moveCharacterProp={this.moveCharacter} />);
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
		const allPlayerPos = this.props.getAllCharactersPos('player', 'pos');

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
	 * Calculates the middle of the game window for placing main character
	 * @returns {{yPos: number, xPos: number}}
	 * @private
	 */
	_calculatePlayerTransform() {
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
	 * Checks to see if player char is on exit tile and if so, shows dialog to give player choice of action
	 * @private
	 */
	_checkForExit() {
		const activePCCoords = this.props.playerCharacters[this.props.activeCharacter].coords;
		if (activePCCoords.xPos === this.state.exitPosition.xPos &&
			activePCCoords.yPos === this.state.exitPosition.yPos)
		{
			const showDialog = true;
			const dialogText = 'Do you want to descend to the next level?';
			const closeButtonText = 'Stay here';
			const actionButtonVisible = true;
			const actionButtonText = 'Descend';
			const actionButtonCallback = this.resetMap;
			const dialogClasses = '';
			this.props.setShowDialogProps(showDialog, dialogText, closeButtonText, actionButtonVisible, actionButtonText, actionButtonCallback, dialogClasses);
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
		const playerCoords = this.props.playerCharacters[this.props.activeCharacter].coords;
		let isInRange = true;
		if (!creatureCoords || (!weaponData.stats.ranged && (Math.abs(creatureCoords.xPos - playerCoords.xPos) > 1 || Math.abs(creatureCoords.yPos - playerCoords.yPos) > 1))) {
			isInRange = false;
		}
		return isInRange;
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

				// todo: use _calculatePlayerTransform for active char, but _calculateObjectTransform for other player chars

				characterTransform = this._calculatePlayerTransform();
				characterTransform = `${characterTransform.xPos}px, ${characterTransform.yPos}px`;
			} else {
				// hide all creatures from rendering unless creature is in sight of any PC
				const characterPos = characterCoords.xPos + '-' + characterCoords.yPos;
				creatureIsHidden = true;
				for (const playerData of Object.values(this.props.playerCharacters)) {
					lineOfSightTiles = unblockedPathsToNearbyTiles(this.state.mapLayout, `${playerData.coords.xPos}-${playerData.coords.yPos}`);
					for (const tileData of Object.values(lineOfSightTiles)) {
						if (tileData.floors[characterPos]) {
							creatureIsHidden = false;
						}
					}
				}
				characterTransform = this._calculateObjectTransform(characterCoords.xPos, characterCoords.yPos);
			}

			const numberInID = id.search(/\d/);
			const idEndIndex = numberInID > -1 ? numberInID : id.length;
			const idConvertedToClassName = convertCamelToKabobCase(id.substring(0, idEndIndex));
			characterList.push(
				<Character
					id={id}
					key={id + Math.random()}
					characterType={characters[id].type}
					idClassName={idConvertedToClassName}
					isHidden={creatureIsHidden}
					isSelected={characters[id].isSelected}
					isDead={characters[id].currentHP <= 0}
					isInRange={(Object.keys(this.props.weaponButtonSelected).length > 0 && props.characterType === 'creature' && this.isCreatureInRange(id, this.props.weaponButtonSelected))}
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
		const allPlayerPos = this.props.getAllCharactersPos('player', 'pos');
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
		let lineOfSightTiles = {
			oneAway: {floors: {}, walls: {}},
			twoAway: {floors: {}, walls: {}},
			threeAway: {floors: {}, walls: {}},
			fourAway: {floors: {}, walls: {}},
			fiveAway: {floors: {}, walls: {}}
		};
		allPlayersPos.forEach(pos => {
			const tempTiles = unblockedPathsToNearbyTiles(this.state.mapLayout, pos);
			for (const [distance, tiles] of Object.entries(tempTiles)) {
				lineOfSightTiles[distance].floors = Object.assign(lineOfSightTiles[distance].floors, tiles.floors);
				lineOfSightTiles[distance].walls = Object.assign(lineOfSightTiles[distance].walls, tiles.walls);
			}
		});

		for (const tilePos of Object.keys(this.state.mapLayout)) {
			let allClasses = 'light-tile';

			if (allPlayersPos.includes(tilePos)) {
				allClasses += ' very-bright-light black-light';
			} else if (lineOfSightTiles.oneAway.floors[tilePos] || lineOfSightTiles.oneAway.walls[tilePos]) {
				allClasses += ' bright-light black-light';
			} else if (lineOfSightTiles.twoAway.floors[tilePos] || lineOfSightTiles.twoAway.walls[tilePos]) {
				allClasses += ' bright-med-light black-light';
			} else if (lineOfSightTiles.threeAway.floors[tilePos] || lineOfSightTiles.threeAway.walls[tilePos]) {
				allClasses += ' med-light black-light';
			} else if (lineOfSightTiles.fourAway.floors[tilePos] || lineOfSightTiles.fourAway.walls[tilePos]) {
				allClasses += ' med-low-light black-light';
			} else if (lineOfSightTiles.fiveAway.floors[tilePos] || lineOfSightTiles.fiveAway.walls[tilePos]) {
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
	 * Determines if user's key/tap/click movement command is valid, and if so, updates coords for the active PC
	 * then calls _moveMap to keep the active PC centered on screen
	 * @param tileLoc: String
	 * @param e: Event object
	 */
	moveCharacter = (tileLoc, e) => {
		const activePC = this.props.playerCharacters[this.props.activeCharacter];
		if (this.props.activePlayerMovesCompleted === this.props.playerMovesLimit) {
			const showDialog = true;
			const dialogText = `${activePC.name} has no more moves this turn`;
			const closeButtonText = 'Ok';
			const actionButtonVisible = false;
			const actionButtonText = '';
			const actionButtonCallback = null;
			const dialogClasses = '';
			this.props.setShowDialogProps(showDialog, dialogText, closeButtonText, actionButtonVisible, actionButtonText, actionButtonCallback, dialogClasses);
			return;
		}
		let newCoords = [];
		let invalidMove = false;
		const activePCCoords = activePC.coords;

		// new position from moving
		if (tileLoc || tileLoc === '') {

			//keyboard input
			let tileCoordsTemp = {...activePCCoords};
			if (e.code) {
				switch(e.code) {
					case 'ArrowLeft':
					case 'Numpad4':
						tileCoordsTemp.xPos -= 1;
						break;
					case 'ArrowRight':
					case 'Numpad6':
						tileCoordsTemp.xPos += 1;
						break;
					case 'ArrowUp':
					case 'Numpad8':
						tileCoordsTemp.yPos -= 1;
						break;
					case 'ArrowDown':
					case 'Numpad2':
						tileCoordsTemp.yPos += 1;
						break;
					case 'Numpad1':
						tileCoordsTemp.xPos -= 1;
						tileCoordsTemp.yPos += 1;
						break;
					case 'Numpad3':
						tileCoordsTemp.xPos += 1;
						tileCoordsTemp.yPos += 1;
						break;
					case 'Numpad7':
						tileCoordsTemp.xPos -= 1;
						tileCoordsTemp.yPos -= 1;
						break;
					case 'Numpad9':
						tileCoordsTemp.xPos += 1;
						tileCoordsTemp.yPos -= 1;
						break;
				}
				tileLoc = `${tileCoordsTemp.xPos}-${tileCoordsTemp.yPos}`;
				newCoords = tileLoc.split('-');

			} else {
				// mouse/touch input

				newCoords = tileLoc.split('-');
				const playerXMovementAmount = Math.abs(+newCoords[0] - activePCCoords.xPos);
				const playerYMovementAmount = Math.abs(+newCoords[1] - activePCCoords.yPos);

				// Invalid move if movement is more than 1 square
				if (playerXMovementAmount > 1 || playerYMovementAmount > 1) {
					invalidMove = true;
				}
			}

			// check if player is trying to move where a creature exists
			for (const creatureData of Object.values(this.props.mapCreatures)) {
				const creaturePos = `${creatureData.coords.xPos}-${creatureData.coords.yPos}`;
				const newPlayerPos = `${newCoords[0]}-${newCoords[1]}`;
				if (newPlayerPos === creaturePos) {
					invalidMove = true;
				}
			}

			if (this.state.mapLayout[tileLoc].type === 'wall' ||
				(this.state.mapLayout[tileLoc].type === 'door' && !this.state.mapLayout[tileLoc].doorIsOpen))
			{
				invalidMove = true;
			}
		}

		if (!invalidMove) {

			// if (activePC) {
			// 	this.props.updateLog(`NEW TURN: Player ${activePC.name} moves to ${newCoords[0]}, ${newCoords[1]}`);
			// }

			// Find all visited tiles for determining lighting
			const playerVisitedUpdatedState = {...this.state.playerVisited, ...this._findVisitedTiles(newCoords)};

			const coordData = {coords: {xPos: +newCoords[0], yPos: +newCoords[1]}};
			this.props.updateCharacters('player', coordData, this.props.activeCharacter, false, () => {
				this.setState(prevState => ({
					playerVisited: playerVisitedUpdatedState || {...prevState.playerVisited},
					playerPlaced: true
				}), () => {
					this._moveMap();
					this._checkForExit();
					this.props.updateActivePlayerMoves();
				});
			});
		}
	}

	/**
	 * For dungeons only:
	 * If PC hasn't visited the current tile,
	 * gets a collection any of the 8 tiles surrounding current one that are walls in order to light them,
	 * since only visited tiles are lit
	 * @param newCoords: Object
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
	 * Used to determine if creature can move to specified tile (ie. not already occupied, not wall, not closed door)
	 * @param tileCoords: Object
	 * @returns {boolean}
	 * @private
	 */
	_tileIsFreeToMove(tileCoords) {
		let tileIsAvail = true;
		const tilePos = `${tileCoords.xPos}-${tileCoords.yPos}`;
		const tile = this.state.mapLayout[tilePos];
		const allCharCoords = [...this.props.getAllCharactersPos('creature', 'coords'), ...this.props.getAllCharactersPos('player', 'coords')];

		let i = 0;
		if (!tile || tile.type === 'wall' || (tile.type === 'door' && !tile.doorIsOpen)) {
			tileIsAvail = false;
		} else {
			while (tileIsAvail && i < allCharCoords.length) {
				if (allCharCoords[i].xPos === tileCoords.xPos && allCharCoords[i].yPos === tileCoords.yPos) {
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
	 * @returns {{yPos, xPos}}
	 * @private
	 */
	_findNewCreatureCoordsRelativeToChar(creatureCoords, directionModifier) {
		let newCreatureCoords = {xPos: creatureCoords.xPos, yPos: creatureCoords.yPos};

		const allPlayersCoords = this.props.getAllCharactersPos('player', 'coords');
		let modifiers = {};
		const calcModifiers = (xValue, yValue, xComparison, yComparison) => {
			let mods = {};
			if (xValue < xComparison) {
				mods = yValue < yComparison ? {primary: {x: -1, y: -1}, altOne: {x: -1, y: 0}, altTwo: {x: 0, y: -1}} :
					yValue === yComparison ? {primary: {x: -1, y: 0}, altOne: {x: -1, y: 1}, altTwo: {x: -1, y: -1}} :
					{primary: {x: -1, y: 1}, altOne: {x: -1, y: 0}, altTwo: {x: 0, y: 1}};
			} else if (xValue === xComparison) {
				mods = yValue < yComparison ? {primary: {x: 0, y: -1}, altOne: {x: -1, y: -1}, altTwo: {x: 1, y: -1}} :
					{primary: {x: 0, y: 1}, altOne: {x: -1, y: 1}, altTwo: {x: 1, y: 1}};
			} else {
				mods = yValue < yComparison ? {primary: {x: 1, y: -1}, altOne: {x: 0, y: -1}, altTwo: {x: 1, y: 0}} :
					yValue === yComparison ? {primary: {x: 1, y: 0}, altOne: {x: 1, y: -1}, altTwo: {x: 1, y: 1}} :
					{primary: {x: 1, y: 1}, altOne: {x: 1, y: 0}, altTwo: {x: 0, y: 1}};
			}
			return mods;
		};

		// move toward nearest PC
		if (directionModifier === 1) {
			let shortestDist = 10000; //dummy value
			allPlayersCoords.forEach(pos => {
				const newDistX = pos.xPos - creatureCoords.xPos;
				const newDistY = pos.yPos - creatureCoords.yPos;
				const newDistance = Math.max(Math.abs(newDistX), Math.abs(newDistY));
				if (newDistance < shortestDist) {
					shortestDist = newDistance;
					modifiers = calcModifiers(newDistX, newDistY, 0, 0);
				}
			});

		// move away from all PCs
		} else {
			let avgXCoord = 0;
			let avgYCoord = 0;
			let numPCs = allPlayersCoords.length;
			allPlayersCoords.forEach(pos => {
				avgXCoord += pos.xPos;
				avgYCoord += pos.yPos;
			});
			avgXCoord = avgXCoord / numPCs;
			avgYCoord = avgYCoord / numPCs;
			modifiers = calcModifiers(creatureCoords.xPos, creatureCoords.yPos, avgXCoord, avgYCoord);
		}

		const newXPos = creatureCoords.xPos + modifiers.primary.x;
		const newYPos = creatureCoords.yPos + modifiers.primary.y;
		const newXPosAlt1 = creatureCoords.xPos + modifiers.altOne.x;
		const newYPosAlt1 = creatureCoords.yPos + modifiers.altOne.y;
		const newXPosAlt2 = creatureCoords.xPos + modifiers.altTwo.x;
		const newYPosAlt2 = creatureCoords.yPos + modifiers.altTwo.y;

		if (this._tileIsFreeToMove({xPos: newXPos, yPos: newYPos})) {
			newCreatureCoords.xPos = newXPos;
			newCreatureCoords.yPos = newYPos;
		} else if (this._tileIsFreeToMove({xPos: newXPosAlt1, yPos: newYPosAlt1})) {
			newCreatureCoords.xPos = newXPosAlt1;
			newCreatureCoords.yPos = newYPosAlt1;
		} else if (this._tileIsFreeToMove({xPos: newXPosAlt2, yPos: newYPosAlt2})) {
			newCreatureCoords.xPos = newXPosAlt2;
			newCreatureCoords.yPos = newYPosAlt2;
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

		this.props.updateCharacters('creature', creatureData[creatureID], creatureID, false, () => {
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
		const MIN_SEARCH_DIST = 1;
		const MAX_SEARCH_DIST = 5;
		const creatureID = this.props.activeCharacter;
		const creatureData = this.props.mapCreatures[creatureID];
		let creatureDidAct = false;

		if (creatureData.currentHP > 0) {
			let creatureCoords = creatureData.coords;
			const creaturePos = `${creatureCoords.xPos}-${creatureCoords.yPos}`;
			let newCreatureCoordsArray = [];
	//todo: add perception/light range as a 3rd param to only search within perceived range
			const lineOfSightTiles = unblockedPathsToNearbyTiles(this.state.mapLayout, creaturePos);
			let playerPos = '';
			let playerDistance = -1;
			let targetPlayerID = '';
			let targetPlayerPos = '';
			let targetPlayerDistance = 10; //dummy value
			let targetPlayerData = this.props.playerCharacters['privateEye'];

			// find closest player for creature to focus on
			for (const [playerID, playerData] of Object.entries(this.props.playerCharacters)) {
				playerPos = `${playerData.coords.xPos}-${playerData.coords.yPos}`;
				let tileDistance = 0;
				const tiles = Object.values(lineOfSightTiles);
				let distance = tiles[tileDistance];
				while (playerDistance === -1 && tileDistance < tiles.length) {
					if (creatureData.perception >= tileDistance + 1 && distance.floors[playerPos]) {
						playerDistance = tileDistance + 1;
					}
					tileDistance++;
					distance = tiles[tileDistance];
				}

				if (playerDistance < targetPlayerDistance) {
					targetPlayerDistance = playerDistance;
					targetPlayerPos = playerPos;
					targetPlayerID = playerID;
					targetPlayerData = playerData;
				}
			}
			// if a player char is nearby...
			if (targetPlayerDistance >= MIN_SEARCH_DIST && targetPlayerDistance <= MAX_SEARCH_DIST) {
				// if creature is low on health
				if (creatureData.currentHP < (creatureData.startingHP * this.creatureSurvivalHpPercent)) {
					// if player char is within attack range, then attack
					if (targetPlayerDistance <= creatureData.range) {
						this.props.updateLog(`${creatureID} attacks player at ${JSON.stringify(targetPlayerPos)}`);
						this.props.mapCreatures[creatureID].attack(targetPlayerID, targetPlayerData, this.props.updateCharacters, this.props.updateLog);
					}
					// then move away from player
					for (let i=1; i <= creatureData.moveSpeed; i++) {
						creatureCoords = this._findNewCreatureCoordsRelativeToChar(creatureCoords, -1);
						newCreatureCoordsArray.push(creatureCoords);
						// this.props.updateLog(`Moving ${creatureID} away from player to ${JSON.stringify(newCreatureCoordsArray)}`);
					}
					this._storeNewCreatureCoords(creatureID, newCreatureCoordsArray, this.props.updateCurrentTurn);
				// or if player is out of attack range, move closer
				} else if (targetPlayerDistance > creatureData.range && targetPlayerDistance <= creatureData.perception) {
					let moves = 1;
					while (moves <= creatureData.moveSpeed && targetPlayerDistance > creatureData.range) {
						creatureCoords = this._findNewCreatureCoordsRelativeToChar(creatureCoords, 1);
						newCreatureCoordsArray.push(creatureCoords);
						moves++;
						targetPlayerDistance--;
						// this.props.updateLog(`Moving ${creatureID} toward player, to ${JSON.stringify(newCreatureCoordsArray)}`);
					}
					this._storeNewCreatureCoords(creatureID, newCreatureCoordsArray, () => {
						// if player char is within attack range, then attack
						if (targetPlayerDistance <= creatureData.range) {
							this.props.updateLog(`${creatureID} attacks player at ${JSON.stringify(targetPlayerPos)}`);
							this.props.mapCreatures[creatureID].attack(targetPlayerID, targetPlayerData, this.props.updateCharacters, this.props.updateLog, this.props.updateCurrentTurn);
						} else {
							this.props.updateCurrentTurn();
						}
					});
				// otherwise player is in attack range, so attack
				} else {
					this.props.updateLog(`${creatureID} attacks player at ${JSON.stringify(targetPlayerPos)}`);
					this.props.mapCreatures[creatureID].attack(targetPlayerID, targetPlayerData, this.props.updateCharacters, this.props.updateLog, this.props.updateCurrentTurn);

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
	 * @param initialSetupCallback: Function (runs initial map setup functions)
	 * @private
	 */
	_moveMap(initialSetupCallback) {
		const playerID = this.props.activeCharacter;
		const playerTransform = this._calculatePlayerTransform();
		const playerXPos = this.props.playerCharacters[playerID].coords.xPos * this.tileSize;
		const playerYPos = this.props.playerCharacters[playerID].coords.yPos * this.tileSize;
		const newXPos = playerTransform.xPos - playerXPos;
		const newYPos = playerTransform.yPos - playerYPos;

		this.setState({
			mapPosition: {
				transform: `translate(${newXPos}px, ${newYPos}px)`
			}
		}, () => {
			// passed in from _layoutPieces after setting mapLayout; called after placing PCs and centering map
			if (initialSetupCallback) {
				initialSetupCallback();
			}
		})
	}

	/**
	 * Looks to see if a door is near the active player (since user just tried activating a door)
	 * then opens/closes it (and plays the sound effect for it)
	 * @private
	 */
	_toggleDoor() {
		const playerID = this.props.activeCharacter;
		const playerCoords = this.props.playerCharacters[playerID].coords;
		const playerPos = playerCoords.xPos + '-' + playerCoords.yPos;
		const playerPosTile = this.state.mapLayout[playerPos];
		const playerPosTileSides = [playerPosTile.leftSide, playerPosTile.rightSide, playerPosTile.topSide, playerPosTile.bottomSide];
		const doorLocation = playerPosTileSides.indexOf('door');
		const doorTileDirections = [
			(playerCoords.xPos - 1) + '-' + playerCoords.yPos,
			(playerCoords.xPos + 1) + '-' + playerCoords.yPos,
			playerCoords.xPos + '-' + (playerCoords.yPos - 1),
			playerCoords.xPos + '-' + (playerCoords.yPos + 1)
		];
		if (doorLocation >= 0) {
	//todo: move play into separate sfx function
			this.sfxSelectors[this.currentMapData.name].door.play();
			const doorTilePos = doorTileDirections[doorLocation];
			this.setState(prevState => ({
				mapLayout: {
					...prevState.mapLayout,
					[doorTilePos]: {
						...prevState.mapLayout[doorTilePos],
						doorIsOpen: !prevState.mapLayout[doorTilePos].doorIsOpen
					}
				}
			}));
		}
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
				this.moveCharacter('', e);
			} else if (e.code === 'Space') {
				e.preventDefault();
				this._toggleDoor();
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
		if (prevProps.activeCharacter !== this.props.activeCharacter && this.props.mapCreatures[this.props.activeCharacter]) {
			this._moveCreature();
		}
	}

	// Add below for testing: <button onClick={this.resetMap}>Reset</button>
	render() {
		return (
			<div className="world" style={{width: `${Math.floor(window.outerWidth/this.tileSize) * this.tileSize}px`}}>
				<div className="map" style={this.state.mapPosition}>
					{ this.state.mapLayoutDone && <this.createAllMapPieces /> }
				</div>
				<div className="objects" style={this.state.mapPosition}>
					{ this.state.exitPlaced && <this.addObjects /> }
				</div>
				<div className="lighting" style={this.state.mapPosition}>
					{ this.state.exitPlaced && <this.addLighting /> }
				</div>
				<div className="creatures" style={this.state.mapPosition}>
					{ this.state.mapLayoutDone && this.state.playerPlaced && <this.addCharacters characterType='creature' /> }
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
