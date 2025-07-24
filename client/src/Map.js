import React, {createRef} from 'react';
import DungeonMapData from './data/dungeonMapData.json';
import GameLocations from './data/gameLocations.json';
import CreatureData from './data/creatureTypes.json';
import Creature from './Creature';
import ItemTypes from './data/itemTypes.json';
import WeaponTypes from './data/weaponTypes.json';
import EnvObjectTypes from './data/envObjectTypes.json';
import {Character, Exit, Tile, Door, Item, EnvObject, LightElement, MapCover} from './MapElements';
import {
	convertObjIdToClassId,
	removeIdNumber,
	convertPosToCoords,
	convertCoordsToPos,
	getDistanceBetweenTargets,
	roundTowardZero,
	deepCopy,
	diceRoll} from './Utils';
import './css/catacombs.css';
import './css/museum.css';
import './css/creatures.css';
import './css/playerCharacters.css';
import './css/npcs.css';
import './css/map.css';

/**
 * Map controls entire layout of game elements (objects, tiles, and lighting) as well as movement of players and creatures
 * Map is made up of pre-defined pieces (using the map tool) that contain tiles
 */

class Map extends React.PureComponent {
	constructor(props) {
		super(props);

		this.componentMounted = false;

		// Constants
		this.tileSize = 64;
		this.uiPadding = 310; // extra space above/below map so top/bottom of map aren't under UI and for determining when to move map if pc gets too close to ui
		// total number of unique map pieces in currentLocationData: 21;
		this.firstMapPieceCoords = {xPos: 10, yPos: 10}; //arbitrary but shifted from 0,0 to allow space for pieces on all sides
		this.characterSizePercentage = 0.7;
		this.OPPOSITE_SIDE = {
			topSide: 'bottomSide',
			bottomSide: 'topSide',
			leftSide: 'rightSide',
			rightSide: 'leftSide'
		};
		this.creatureSurvivalHpPercent = 0.3;
		this.playerAutoTurnDelay = 500;
		this.creatureMovementDelay = 200;
		this.maxLightStrength = 5;
		this.minPcTileLightStrength = 2;
		this.baseChanceOfFindingSecretDoor = 0.1;
		this.chanceForCreatureSound = 1; // dice roll of this or lower triggers sound

		this.pageFirstLoaded = true;
		this.mapLayoutTemp = {};
		this.numberOpeningsPerPiece = {};
		this.staticMapData = null;

		this.charRefs = {};
		this.clickedOnWorld = false;
		this.isDraggingWorld = false;
		this.contextMenuOpen = false;
		this.animFrameStartTime = 0;
		this.animFrameTimeLimit = 0;
		this.animFrameCallback = null;

		this.worldFarthestX = 0;
		this.worldFarthestY = 0;
		this.worldRef = createRef();
		this.worldTransform = {x: 0, y: 0};

		this.state = {
			pcTypes: this.props.pcTypes,
			currentLocationData: GameLocations[this.props.currentLocation],
			playerPlaced: false,
			npcsPlaced: false,
			creaturesPlaced: false,
			objectsPlaced: false,
			envObjectsPlaced: false,
			lightingCalculated: false,
			usingSavedMapData: false,
			playerVisited: {},
			mapLayout: {},
			mapLayoutDone: false,
			exits: {
				previousAreaExitCoords: null,
				nextAreaExitCoords: null,
				stairs: null,
				doors: null
			},
			exitPlaced: false,
			mapMoved: false,
			worldWidth: 0,
			worldHeight: 0,
			leaderMovementDelay: GameLocations[this.props.currentLocation].floors[this.props.currentFloor].mapSize === 'large' ? 50 : 200,
			shortMovementDelay: 50
		};
	}

	/**
	 * Resets state and other vars related to map - used for moving from one floor to another or to another location
	 */
	resetMap = () => {
		this.mapLayoutTemp = {};

		this.setState({
			currentLocationData: GameLocations[this.props.currentLocation],
			playerPlaced: false,
			npcsPlaced: false,
			creaturesPlaced: false,
			objectsPlaced: false,
			envObjectsPlaced: false,
			lightingCalculated: false,
			usingSavedMapData: this.props.savedMaps[this.props.currentLocation] && this.props.savedMaps[this.props.currentLocation].floors[this.props.currentFloor],
			playerVisited: {},
			mapLayout: {},
			mapLayoutDone: false,
			exits: {
				previousAreaExitCoords: null,
				nextAreaExitCoords: null,
				stairs: null,
				doors: null
			},
			exitPlaced: false,
			mapMoved: false,
			worldWidth: 0,
			worldHeight: 0,
			leaderMovementDelay: GameLocations[this.props.currentLocation].floors[this.props.currentFloor].mapSize === 'large' ? 50 : 200,
			shortMovementDelay: 50
		}, () => {
			this.props.resetDataForNewArea(this.layoutPieces);
		});
	}

	/**
	 * Save map data in App, which then saves all game data to FB
	 * @param callback: function
	 * @param newFloorNum: number (optional)
	 * @param exitToLocation string (name of location exiting to, optional)
	 */
	saveAllData = (callback, newFloorNum, exitToLocation) => {
		const mapData = {
			playerVisited: deepCopy(this.state.playerVisited),
			mapLayout: deepCopy(this.state.mapLayout),
			exits: deepCopy(this.state.exits),
			worldWidth: this.state.worldWidth,
			worldHeight: this.state.worldHeight,
			newFloorNum,
			exitToLocation
		};
		const saveMapData = () => {
			this.props.saveMapData(mapData, callback);
		}
		if (newFloorNum || exitToLocation) {
			mapData.partyExitCoords = {};
			// save coords of each pc's last tile before leaving location/floor so know where to place them upon returning
			this.props.playerFollowOrder.forEach(id => {
				mapData.partyExitCoords[id] = {...this.props.playerCharacters[id].coords};
			});
			this.setState({mapLayoutDone: false}, () => {
				saveMapData();
				if (exitToLocation && GameLocations[exitToLocation].recoversSpirit) {
					this.props.recoverCharsSpirit('all');
				}
			});
		} else {
			saveMapData();
		}
	}


	/**
	 * MAP LAYOUT
	 */

	/**
	 * Loads json for non-randomized map
	 */
	async _loadStaticMap() {
		this.staticMapData = await import(`./data/${this.props.currentLocation}MapData.json`);
	}

	/**
	 * Initialization of the map containing a loop that chooses and places tiles in temp storage,
	 * then runs a cleanup function to close up tile openings (halls, doorways) that weren't covered,
	 * then temp map storage is saved into state, after which callback runs that places characters, and sets activeCharacter,
	 * then runs callback that sets exit position, which triggers lighting to be set, and places creatures and saves their coordinates to state,
	 * then finally sets up keyboard listeners if first time page is loaded
	 * @private
	 */
	layoutPieces = () => {
		const usingSavedMapData = this.state.usingSavedMapData;
		const savedMapData = usingSavedMapData ? this.props.savedMaps[this.props.currentLocation].floors[this.props.currentFloor] : null;
		const floorMapData = this.state.currentLocationData.floors[this.props.currentFloor];

		// new randomized map
		if (!usingSavedMapData && floorMapData.isRandom) {
			let numPiecesTried = 0;
			let attemptedPieces = [];
			const numPieceTemplates = Object.keys(DungeonMapData).length;

			// find how many openings each piece has
			for (const [pieceName, pieceData] of Object.entries(DungeonMapData)) {
				let openings = 0;
				for (const tileSides of Object.values(pieceData)) {
					for (const value of Object.values(tileSides)) {
						if (value === 'opening') {
							openings++;
						}
					}
				}
				this.numberOpeningsPerPiece[pieceName] = openings;
			}

			if (floorMapData.setPiece) {
				const pieceName = floorMapData.setPiece.pieceName;
				const newPiece = DungeonMapData[pieceName];
				const {updatedPiece, mapOpening, pieceOpening} = this._findNewPiecePosition(newPiece, pieceName);
				this._updateMapLayout(updatedPiece, mapOpening, pieceOpening, pieceName);
			}

			// choose random piece, see if there's a valid place for it, and if position found, update map
			// if tried all of the different pieces, and none fit, or if reached the tile limit, exit loop
			while (numPiecesTried < numPieceTemplates && Object.keys(this.mapLayoutTemp).length < floorMapData.mapTileLimit) {
				const {newPiece, pieceName} = this._chooseNewRandomPiece(attemptedPieces);
				attemptedPieces.push(pieceName);
				const {positionFound, updatedPiece, mapOpening, pieceOpening} = this._findNewPiecePosition(newPiece, pieceName);

				if (positionFound) {
					this._updateMapLayout(updatedPiece, mapOpening, pieceOpening, pieceName);
					attemptedPieces = [];
					numPiecesTried = 0;
				} else numPiecesTried++;
			}
			this._mapCleanup();
		// saved map (random or not)
		} else if (usingSavedMapData) {
			this.mapLayoutTemp = deepCopy(savedMapData.mapLayout);
		// new non-randomized map
		} else {
			this._placeStaticPieces();
			this.worldFarthestX = floorMapData.maxXpos;
			this.worldFarthestY = floorMapData.maxYpos;
		}

		const worldWidth = usingSavedMapData ? savedMapData.worldWidth : (this.worldFarthestX * this.tileSize) + this.uiPadding;
		const worldHeight = usingSavedMapData ? savedMapData.worldHeight: (this.worldFarthestY * this.tileSize) + this.uiPadding;
		this.setState({
			mapLayoutDone: true,
			mapLayout: {...this.mapLayoutTemp},
			worldWidth,
			worldHeight
		}, () => {
			this._setExitPosition(() => {
				this._setInitialCharacterCoords(() => {

					const continueWithObjSetup = () => {
						this._setInitialObjectData(() => {
							this._setInitialEnvObjectData(() => {
								this._calculateLighting(() => {
									const saveNewData = () => {
										if (!this.state.usingSavedMapData) {
											this.saveAllData();
										} else if (this.props.mapCreatures[this.props.activeCharacter]) {
											this._moveCreature();
										}
									}
									if (floorMapData.creatures) {
										this._updateThreatLists(saveNewData);
									} else {
										saveNewData();
									}
									if (this.pageFirstLoaded) {
										this.pageFirstLoaded = false;
										this._setupKeyListeners();
									}
								});
							})
						});
					}
					// for unlit maps, warn usr to equip a light
					if (!floorMapData.allTilesAtLeastAmbientLit) {
						let anyLightEquipped = false;
						const partyData = Object.values(this.props.playerCharacters);
						let count = 0;
						while (count < partyData.length && !anyLightEquipped) {
							if (partyData[count].lightRange > 0) {
								anyLightEquipped = true;
							}
							count++;
						}
						if (!anyLightEquipped) {
							const dialogProps = {
								dialogContent: "Make sure to equip a light - wandering in the dark is taxing on one's sanity! (click/tap a character's name below to access inventory)",
								closeButtonText: 'Ok',
								closeButtonCallback: null,
								disableCloseButton: false,
								actionButtonVisible: false,
								actionButtonText: '',
								actionButtonCallback: null,
								dialogClasses: ''
							};
							this.props.setShowDialogProps(true, dialogProps)
						}
					}
					if (floorMapData.setPiece && floorMapData.setPiece.dialogs) {
						this._setScriptedDialogs(deepCopy(floorMapData.setPiece.dialogs));
					}
					if (floorMapData.npcs || (floorMapData.setPiece && floorMapData.setPiece.npcs)) {
						this._setInitialNpcData();
					}
					if (floorMapData.creatures) {
						this._setInitialCreatureData(continueWithObjSetup);
					} else {
						continueWithObjSetup();
					}
				});
			});
		});
	}

	_placeStaticPieces() {
		for (const [pieceName, pieceCoords] of Object.entries(this.state.currentLocationData.floors[this.props.currentFloor].pieces)) {
			for (const tileData of Object.values(this.staticMapData[pieceName])) {
				const newXpos = tileData.xPos + pieceCoords.xPos;
				const newYpos = tileData.yPos + pieceCoords.yPos;
				const newTilePos = convertCoordsToPos({xPos: newXpos, yPos: newYpos});
				this.mapLayoutTemp[newTilePos] = deepCopy(tileData);
				this.mapLayoutTemp[newTilePos].xPos = newXpos;
				this.mapLayoutTemp[newTilePos].yPos = newYpos;
			}
		}
	}

	/**
	 * Randomly chooses a new map piece to place on the map from the remaining list of pieces that haven't been tried yet
	 * @param attemptedPieces: Array (of Strings: piece names)
	 * @returns {{newPiece: Object, pieceName: String}}
	 * @private
	 */
	_chooseNewRandomPiece(attemptedPieces) {
		const pieceNamesList = Object.keys(DungeonMapData);
		const remainingPieceNameList = pieceNamesList.filter(name => attemptedPieces.indexOf(name) < 0 && name !== 'roomScripted');
		const piecesWith3orMoreOpenings = remainingPieceNameList.filter(name => this.numberOpeningsPerPiece[name] >= 3);
		const percentMapFilled = Object.keys(this.mapLayoutTemp).length / this.state.currentLocationData.floors[this.props.currentFloor].mapTileLimit;
		// while map is only 30% filled so far, ~66% chance of only using rooms/halls with more than 2 doors - this is to try to prevent small maps
		let pieceName = '';
		let randomIndex = 0;
		if (percentMapFilled < 0.3 && diceRoll(3) > 1) {
			randomIndex = Math.floor(Math.random() * piecesWith3orMoreOpenings.length);
			pieceName = piecesWith3orMoreOpenings[randomIndex];
		} else {
			randomIndex = Math.floor(Math.random() * remainingPieceNameList.length);
			pieceName = remainingPieceNameList[randomIndex];
		}
		const newPiece = DungeonMapData[pieceName];
		return {newPiece, pieceName};
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
			updatedNeighbors[type] = [];
			neighborPositions.forEach(pos => {
				const neighborCoords = convertPosToCoords(pos);
				const newXCoord = neighborCoords.xPos + xAdjustment;
				const newYCoord = neighborCoords.yPos + yAdjustment;
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
				const neighborCoords = convertPosToCoords(pos);
				const newXCoord = neighborCoords.xPos + xAdjustment;
				const newYCoord = neighborCoords.yPos + yAdjustment;
				updatedAltClasses[newXCoord + '-' + newYCoord] = classes;
			}
		}
		return updatedAltClasses;
	}

	/**
	 * Finds a position on the map to place a new piece by looking at each piece's door/hall openings
	 * and ensuring the new piece has enough space
	 * @param piece: Object (containing objects with each tile's data)
	 * @param pieceName: String
	 * @returns Object: {
	 *      pieceOpening: Object (tile in the new piece that was connected to piece on the map),
	 *      positionFound: Boolean,
	 *      updatedPiece: Object (new piece with updated coordinates),
	 *      mapOpening: Object (tile on the map that the new piece connects to)
	 * }
	 * @private
	 */
	_findNewPiecePosition(piece, pieceName) {
		let positionFound = false;
		let updatedPiece = {};

		// just for placing first piece
		if (Object.keys(this.mapLayoutTemp).length === 0) {
			positionFound = true;
			for (const tileData of Object.values(piece)) {
				const adjustedXPos = this.firstMapPieceCoords.xPos + tileData.xPos;
				const adjustedYPos = this.firstMapPieceCoords.yPos + tileData.yPos;
				const adjustedPos = adjustedXPos + '-' + adjustedYPos;
				const updatedAltClasses = this._updateAltClassCoordinates(tileData, this.firstMapPieceCoords.xPos, this.firstMapPieceCoords.yPos);
				const updatedNeighbors = this._updateNeighborCoordinates(tileData, this.firstMapPieceCoords.xPos, this.firstMapPieceCoords.yPos);
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
		for (const [tilePos, tileInfo] of Object.entries(piece)) {
			for (const [attributeType, attributeValue] of Object.entries(tileInfo)) {
				if (attributeValue === 'opening') {
					pieceOpenings.push({[tilePos]: attributeType});
				}
			}
		}
		for (const [tilePos, tileInfo] of Object.entries(this.mapLayoutTemp)) {
			for (const [attributeType, attributeValue] of Object.entries(tileInfo)) {
				if (attributeValue === 'opening' && (!pieceName.includes('secret') || tileInfo.piece.includes('room'))) {
					mapOpenings.push({[tilePos]: attributeType});
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
			const mapOpeningTileCoords = convertPosToCoords(Object.keys(mapOpening)[0]);

			// for a map opening, check each piece opening to see if piece fits there
			// if mapTilesAvailableForPiece == numOfTilesInPiece, then piece fits in the map and can stop looking
			while (mapTilesAvailableForPiece < numOfTilesInPiece && pieceOpeningsCounter < pieceOpenings.length) {
				pieceAdjustedTilePositions = {};
				mapTilesAvailableForPiece = 0;  // gets reset for each piece opening
				pieceOpening = pieceOpenings[pieceOpeningsCounter];
				const mapOpeningOpenSide = Object.values(mapOpening)[0];
				const pieceOpeningOpenSide = Object.values(pieceOpening)[0];

				if (pieceOpeningOpenSide === this.OPPOSITE_SIDE[mapOpeningOpenSide]) {
					const pieceOpeningTileCoords = convertPosToCoords(Object.keys(pieceOpening)[0]);
					const xAdjust = mapOpeningOpenSide === 'leftSide' ? -1 : mapOpeningOpenSide === 'rightSide' ? 1 : 0;
					const yAdjust = mapOpeningOpenSide === 'topSide' ? -1 : mapOpeningOpenSide === 'bottomSide' ? 1 : 0;
					// these are the coords for where in the map to place the piece's tile that contains the opening
					const mapOpeningXOffset = mapOpeningTileCoords.xPos + xAdjust;
					const mapOpeningYOffset = mapOpeningTileCoords.yPos + yAdjust;
					const adjustedPieceOpeningPos = mapOpeningXOffset + '-' + mapOpeningYOffset;
					adjustedPieceOpening = {[adjustedPieceOpeningPos]: pieceOpeningOpenSide};

					// now move all other tiles in the piece to go with the opening tile
					// and copy in rest of original tile info
					let isValidPos = true;
					let tilePosIndex = 0;
					const tileList = Object.values(piece);

					while (isValidPos && tilePosIndex < tileList.length) {
						const tileData = tileList[tilePosIndex];
						const newXPos = mapOpeningXOffset + tileData.xPos - pieceOpeningTileCoords.xPos;
						const newYPos = mapOpeningYOffset + tileData.yPos - pieceOpeningTileCoords.yPos;
						const newPos = newXPos + '-' + newYPos;
						const originalPos = tileData.xPos + '-' + tileData.yPos;
						// check if location on map where tile would go is empty and within bounds
						if (this.mapLayoutTemp[newPos] || newXPos < 0 || newYPos < 0) {
							isValidPos = false;
						} else {
							mapTilesAvailableForPiece++;
							pieceAdjustedTilePositions[newPos] = {
								...tileData,
								xPos: newXPos,
								yPos: newYPos,
								originalPos
							};
							const xAdjust = mapOpeningXOffset - pieceOpeningTileCoords.xPos;
							const yAdjust = mapOpeningYOffset - pieceOpeningTileCoords.yPos;
							if (tileData.altClasses) {
								pieceAdjustedTilePositions[newPos].altClasses = this._updateAltClassCoordinates(tileData, xAdjust, yAdjust);
							}
							if (tileData.neighbors) {
								pieceAdjustedTilePositions[newPos].neighbors = this._updateNeighborCoordinates(tileData, xAdjust, yAdjust);
							}
							if (tileData.type === 'door') {
								pieceAdjustedTilePositions[newPos].doorIsOpen = false;
							}
						}
						tilePosIndex++;
						this.worldFarthestX = newXPos > this.worldFarthestX ? newXPos : this.worldFarthestX;
						this.worldFarthestY = newYPos > this.worldFarthestY ? newYPos : this.worldFarthestY;
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
	 * @param pieceName: String
	 * @private
	 */
	_updateMapLayout(newPiece, mapOpeningToRemove, pieceOpeningToRemove, pieceName) {
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

		if (pieceName.includes('secret') && mapOpeningTile) {
			const mapTileCoords = convertPosToCoords(mapOpeningTile);
			let mapTileToChangeCoords = {};
			if (mapOpeningSide === 'topSide') {
				mapTileToChangeCoords = {xPos: mapTileCoords.xPos, yPos: mapTileCoords.yPos + 1};
			} else if (mapOpeningSide === 'bottomSide') {
				mapTileToChangeCoords = {xPos: mapTileCoords.xPos, yPos: mapTileCoords.yPos - 1};
			} else if (mapOpeningSide === 'leftSide') {
				mapTileToChangeCoords = {xPos: mapTileCoords.xPos + 1, yPos: mapTileCoords.yPos};
			} else {
				mapTileToChangeCoords = {xPos: mapTileCoords.xPos - 1, yPos: mapTileCoords.yPos};
			}
			let mapTileToChange = this.mapLayoutTemp[convertCoordsToPos(mapTileToChangeCoords)];
			mapTileToChange.isSecretDoor = true;
			mapTileToChange.isDiscovered = false;
			mapTileToChange.baseChanceOfFinding = this.baseChanceOfFindingSecretDoor;
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
	 * @param previousPlayerCoords: Object (xPos, yPos)
	 * @param playerPositions: Array (of pos strings)
	 * @returns String (new available pos)
	 * @private
	 */
	_findNearbyAvailableTile(previousPlayerCoords, playerPositions) {
		let availableTile = null;
		let distanceAway = 1;
		const previousPlayerPos = convertCoordsToPos(previousPlayerCoords);
		const prevPlayerRoomName = this.state.mapLayout[previousPlayerPos].pieceName;
		const tileList = Object.keys(this.state.mapLayout).filter(tilePos => {
			const mapTile = this.state.mapLayout[tilePos];
			return mapTile.type === 'floor' && mapTile.pieceName === prevPlayerRoomName;
		});
		while (!availableTile) {
			const newNearbyPos1 = `${previousPlayerCoords.xPos + distanceAway}-${previousPlayerCoords.yPos}`;
			const newNearbyPos2 = `${previousPlayerCoords.xPos - distanceAway}-${previousPlayerCoords.yPos}`;
			const newNearbyPos3 = `${previousPlayerCoords.xPos}-${previousPlayerCoords.yPos + distanceAway}`;
			const newNearbyPos4 = `${previousPlayerCoords.xPos}-${previousPlayerCoords.yPos - distanceAway}`;
			const newNearbyPos5 = `${previousPlayerCoords.xPos + distanceAway}-${previousPlayerCoords.yPos + distanceAway}`;
			const newNearbyPos6 = `${previousPlayerCoords.xPos - distanceAway}-${previousPlayerCoords.yPos - distanceAway}`;
			const newNearbyPos7 = `${previousPlayerCoords.xPos + distanceAway}-${previousPlayerCoords.yPos - distanceAway}`;
			const newNearbyPos8 = `${previousPlayerCoords.xPos - distanceAway}-${previousPlayerCoords.yPos + distanceAway}`;
			if (tileList.includes(newNearbyPos1) && !playerPositions.includes(newNearbyPos1)) {
				availableTile = newNearbyPos1;
			} else if (tileList.includes(newNearbyPos2) && !playerPositions.includes(newNearbyPos2)) {
				availableTile = newNearbyPos2;
			} else if (tileList.includes(newNearbyPos3) && !playerPositions.includes(newNearbyPos3)) {
				availableTile = newNearbyPos3;
			} else if (tileList.includes(newNearbyPos4) && !playerPositions.includes(newNearbyPos4)) {
				availableTile = newNearbyPos4;
			} else if (tileList.includes(newNearbyPos5) && !playerPositions.includes(newNearbyPos5)) {
				availableTile = newNearbyPos5;
			} else if (tileList.includes(newNearbyPos6) && !playerPositions.includes(newNearbyPos6)) {
				availableTile = newNearbyPos6;
			} else if (tileList.includes(newNearbyPos7) && !playerPositions.includes(newNearbyPos7)) {
				availableTile = newNearbyPos7;
			} else if (tileList.includes(newNearbyPos8) && !playerPositions.includes(newNearbyPos8)) {
				availableTile = newNearbyPos8;
			} else {
				distanceAway++;
			}
		}
		return availableTile;
	}

	/**
	 * For dungeons only:
	 * If PC hasn't visited the current tile,
	 * gets a collection of the lit tiles surrounding PC,
	 * since only visited tiles are lit
	 * @param newCoords: Object (xPos, yPos)
	 * @param id: string (activePc Id)
	 * @returns Object (containing tile coords)
	 * @private
	 */
	_findNewVisitedTiles(newCoords, id) {
		const visitedTile = convertCoordsToPos(newCoords);
		let surroundingTilesCoords = {};
		const surroundingLitTiles = this._getLitSurroundingTiles([{id, pos: visitedTile}]);

		for (const tilesAtDistance of Object.values(surroundingLitTiles)) {
			for (const tilesOfOneType of Object.values(tilesAtDistance)) {
				for (const pos of Object.keys(tilesOfOneType)) {
					if (this.state.mapLayout[pos].lightStrength > 0) {
						surroundingTilesCoords[pos] = convertPosToCoords(pos);
					}
				}
			}
		}

		surroundingTilesCoords[visitedTile] = convertPosToCoords(visitedTile);
		return surroundingTilesCoords;
	}

	/**
	 * Copies scripted dialog info to App state from GameLocations
	 * @param dialogs object (deepcopy of dialogs data from gameLocations)
	 * @private
	 */
	_setScriptedDialogs(dialogs) {
		let storyProgress = deepCopy(this.props.storyProgress);
		for (const [dialogId, dialogInfo] of Object.entries(dialogs)) {
			storyProgress.dialogs[dialogId] = {...dialogInfo, triggered: false};
		}
		this.props.updateStoryProgress(storyProgress);
	}

	/**
	 * Sets to state the positions for static exits or randomized exits for dungeons
	 * For randomized (nextArea or previousArea exit - exit where pcs spawn), exits can't be in secret areas
	 * If previousArea exit, must be in a room (to help prevent pcs from getting separated)
	 * @param callback : function
	 * @private
	 */
	_setExitPosition(callback) {
		let exits;
		if (this.state.usingSavedMapData) {
			const savedMapData = this.props.savedMaps[this.props.currentLocation].floors[this.props.currentFloor];
			exits = {...savedMapData.exits};
		} else if (!this.state.currentLocationData.floors[this.props.currentFloor].isRandom) {
			const exitTypes = this.state.currentLocationData.floors[this.props.currentFloor].exits;
			exits = {staticExits: true, stairs: {
				up: (exitTypes.stairs && exitTypes.stairs.up) ? [...exitTypes.stairs.up] : null,
				down: (exitTypes.stairs && exitTypes.stairs.down) ? [...exitTypes.stairs.down] : null,
				doors: exitTypes.doors ? [...exitTypes.doors] : null
			}};
		//todo: if we have a setPiece with exits, will need to add another else if here for setPieces
		} else {
			exits = {randomExits: true, nextAreaExitCoords: {}, previousAreaExitCoords: {}, enteredFrom: this.state.currentLocationData.enteredFrom};
			const currentFloorData = this.state.currentLocationData.floors[this.props.currentFloor];
			const tilePositions = Object.keys(this.state.mapLayout).filter(tilePos => {
				const tileData = this.state.mapLayout[tilePos];
				let isValidExit = false;
				if (tileData.piece.includes('room') && (!currentFloorData.setPiece || currentFloorData.setPiece.pieceName !== tileData.piece)) {
					const adjacentTiles = this._getAllSurroundingTilesToRange(tilePos, 1)['1Away'].filter(pos => this.state.mapLayout[pos].type === 'floor');
					isValidExit = adjacentTiles.length >= 3;
				}
				return tileData.type === 'floor' && !tileData.piece.includes('secret') && isValidExit;
			});
			let exitPosition = tilePositions[Math.floor(Math.random() * tilePositions.length)];
			exits.previousAreaExitCoords = convertPosToCoords(exitPosition);
			tilePositions.splice(tilePositions.indexOf(exitPosition), 1);
			if (this.props.currentFloor < this.state.currentLocationData.numOfFloors) {
				exits.nextAreaExitCoords = convertPosToCoords(tilePositions[Math.floor(Math.random() * tilePositions.length)]);
				// for testing: to put two stairs next to each other, uncomment below
				// exits.nextAreaExitCoords = {xPos: exits.previousAreaExitCoords.xPos+1, yPos: exits.previousAreaExitCoords.yPos};
			}
		}
		this.setState({exits, exitPlaced: true}, callback);
	}

	/**
	 * Sets to state coordinates for all PCs when map first loads,
	 * then moves the map to center on active PC
	 * @param initialSetupCallback: Function
	 * @private
	 */
	_setInitialCharacterCoords(initialSetupCallback) {
		let updatedPlayerData = deepCopy(this.props.playerCharacters);
		const savedMapData = this.state.usingSavedMapData ? this.props.savedMaps[this.props.currentLocation].floors[this.props.currentFloor] : null;
		let playerVisited = savedMapData ? deepCopy(savedMapData.playerVisited) : {};
		let previousPlayerCoords = null;
		let playerPositions = [];
		const updatePlayerStatesInMap = () => {
			this.setState({
				playerVisited,
				playerPlaced: true
			}, () => {
				if (initialSetupCallback) {
					this._moveMap(initialSetupCallback);
				}
			});
		}

		if (savedMapData && this.pageFirstLoaded) {
			updatePlayerStatesInMap();
		} else {
			for (const playerID of Object.keys(this.props.playerCharacters)) {
				let tilePos = '';
				let newCoords = {};
				const currentFloorMapData = this.state.currentLocationData.floors[this.props.currentFloor];
				// placing lead investigator
				if (!previousPlayerCoords) {
					let startingCoords = {};
					// starting new static area (likely only applies to beginning of the game)
					if (!this.props.previousFloor && !currentFloorMapData.isRandom) {
						startingCoords = {...currentFloorMapData.initialSpawn};
					} else if (currentFloorMapData.isRandom) {
						// starting new dungeon or going to next dungeon level
						if (this.props.previousFloor <= this.props.currentFloor) {
							startingCoords = {...this.state.exits.previousAreaExitCoords};
						} else {
						// if player went back up a floor, then spawn at exit going down to next floor
							startingCoords = {...savedMapData.exits.nextAreaExitCoords};
						}
					// changing location (new location is static) or reloading game with saved data
					} else {
						if (savedMapData && savedMapData.partyExitCoords && savedMapData.partyExitCoords[playerID]) {
							startingCoords = {...savedMapData.partyExitCoords[playerID]};
						} else {
							// find exit in new location whose destination matches previous location
							const allExits = [
								...currentFloorMapData.stairs.up,
								...currentFloorMapData.stairs.down,
								...currentFloorMapData.doors];
							let exitCounter = 0;
							while (exitCounter < allExits.length) {
								if (allExits[exitCounter].destination === this.props.previousLocation) {
									startingCoords = convertPosToCoords(allExits[exitCounter].pos);
									exitCounter = allExits.length;
								} else {
									exitCounter++;
								}
							}
						}
					}
					tilePos = convertCoordsToPos(startingCoords);
					newCoords = {...startingCoords};
				} else {
					if (savedMapData && savedMapData.partyExitCoords && savedMapData.partyExitCoords[playerID]) {
						newCoords = {...savedMapData.partyExitCoords[playerID]};
					} else {
						// look for empty nearby tile to place 2nd/3rd PC
						tilePos = this._findNearbyAvailableTile(previousPlayerCoords, playerPositions);
						newCoords = convertPosToCoords(tilePos);
					}
				}
				playerPositions.push(tilePos);
				previousPlayerCoords = newCoords;
				if (!savedMapData) {
					playerVisited = Object.assign(playerVisited, this._findNewVisitedTiles(newCoords, playerID));
				}
				updatedPlayerData[playerID].coords = newCoords;
			}
			this.props.updateCharacters('player', updatedPlayerData, null, false, false, true, updatePlayerStatesInMap);
		}
	}

	/**
	 * Only loads npcs for the current location and floor
	 * @param callback
	 * @private
	 */
	_setInitialNpcData(callback) {
		const currentFloorData = this.state.currentLocationData.floors[this.props.currentFloor];
		let npcs = {};
		if (this.state.usingSavedMapData) {
			npcs = deepCopy(this.props.savedMaps[this.props.currentLocation].floors[this.props.currentFloor].npcs);
		} else {
			if (currentFloorData.npcs) {
				for (const [id, data] of Object.entries(currentFloorData.npcs)) {
					if (id !== this.props.createdCharData.id) {
						// player companion npcs for museum are first initialized in App when starting new game or restored when loading from fb
						// but still need to add initial coords from location data
						npcs[id] = this.props.npcs[id] ? {...this.props.npcs[id], ...deepCopy(data)} : {...deepCopy(data)};
					}
				}
			}
			if (currentFloorData.setPiece) {
				for (const [id, data] of Object.entries(currentFloorData.setPiece.npcs)) {
					npcs[id] = {...deepCopy(data)};
					npcs[id].coords.xPos += this.firstMapPieceCoords.xPos;
					npcs[id].coords.yPos += this.firstMapPieceCoords.yPos;
				}
			}
		}
		this.props.updateNpcs(npcs, null, () => {
			this.setState({npcsPlaced: true}, callback);
		});
	}

	/**
	 * Creates initial creature data, giving them starting HP and coords as well as basic stats, etc.,
	 * then saves to App state, after which turn order is set up (in App)
	 * Then calls _setInitialObjectData as its callback
	 * @param callback
	 * @private
	 */
	_setInitialCreatureData(callback) {
		if (!this.props.gameOptions.spawnCreatures) {
			this.setState({creaturesPlaced: true}, () => {
				callback();
			});
		} else {
			const currentFloorData = this.state.currentLocationData.floors[this.props.currentFloor];
			let mapCreatures = {};
			if (this.state.usingSavedMapData) {
				const creatureSource = deepCopy(this.props.savedMaps[this.props.currentLocation].floors[this.props.currentFloor].mapCreatures);
				for (const [creatureId, creatureData] of Object.entries(creatureSource)) {
					const props = {isSavedData: true, ...creatureData};
					mapCreatures[creatureId] = new Creature(props);
				}
			} else {
				if (currentFloorData.setPiece) {
					for (const [genericId, spawnInfo] of Object.entries(currentFloorData.setPiece.creatures)) {
						for (let i=0; i < spawnInfo.number; i++) {
							const creatureId = genericId + i;
							const relatedMission = spawnInfo.relatedMission;
							const coords = {
								xPos: spawnInfo.coords[i].xPos + this.firstMapPieceCoords.xPos,
								yPos: spawnInfo.coords[i].yPos + this.firstMapPieceCoords.yPos
							};
							mapCreatures[creatureId] = new Creature({
								...CreatureData[genericId],
								id: creatureId,
								coords,
								relatedMission
							});
						}
					}
				}
				let creatureCoords = {};
				if (currentFloorData.creatures) {
					for (const [genericId, countInfo] of Object.entries(currentFloorData.creatures)) {
						if (countInfo.number > 0 || countInfo.variation > 0) {
							const mapCreatureIds = Object.keys(mapCreatures);
							const existingCreatureHighestIdVal = mapCreatureIds.reduce((highestValue, currentId) => {
								const match = currentId.includes(genericId) ? +currentId.match(/\d+/)[0] : null;
								return match !== null && (!highestValue || match > highestValue) ? match : highestValue;
							}, null);
							const startingIdBaseNum = existingCreatureHighestIdVal !== null ? existingCreatureHighestIdVal + 1 : 0;
							const zeroOrPosOrNeg = diceRoll(3); // roll 1 = -1, roll 2 = 0, roll 3 = 1
							const variation = (countInfo.variation > 0 && zeroOrPosOrNeg !== 2) ? diceRoll(countInfo.variation) * (zeroOrPosOrNeg === 1 ? -1 : 1) : 0;
							const count = (countInfo.number + variation) >= 0 ? countInfo.number + variation : 0;
							for (let i=0; i < count; i++) {
								const coords = convertPosToCoords(this._generateRandomLocation(creatureCoords, 'floor', 'creature'));
								// need parens around number calc so it's calculated before conversion to string
								const creatureId = genericId + (startingIdBaseNum + i);
								mapCreatures[creatureId] = new Creature({...CreatureData[genericId], id: creatureId});
								mapCreatures[creatureId].coords = coords;
								creatureCoords[creatureId] = coords;
							}
						}
					}
				}
			}
			this.props.updateCharacters('creature', mapCreatures, null, false, true, false, () => {
				this.setState({creaturesPlaced: true}, () => {
					callback();
				});
			});
		}
	}

	/**
	 * Sets initial data for objects appearing on the map, then calls _setInitialEnvObjectData as its callback
	 * @param callback
	 * @private
	 */
	_setInitialObjectData(callback) {
		let mapItems = {};
		if (this.state.usingSavedMapData) {
			mapItems = deepCopy(this.props.savedMaps[this.props.currentLocation].floors[this.props.currentFloor].mapObjects);
		} else {
			const currentFloorData = this.state.currentLocationData.floors[this.props.currentFloor];
			if (currentFloorData.setPiece && currentFloorData.setPiece.objects) {
				for (const [objectType, objectInfo] of Object.entries(currentFloorData.setPiece.objects)) {
					for (const [itemName, itemPlacementInfo] of Object.entries(objectInfo)) {
						for (let i = 0; i < itemPlacementInfo.number; i++) {
							const itemInfo = objectType === 'Weapon' ? WeaponTypes[itemName] : ItemTypes[itemName];
							const lowerCaseName = itemName.slice(0, 1).toLowerCase() + itemName.slice(1, itemName.length).replaceAll(' ', '');
							const itemID = lowerCaseName + i;
							const gunType = objectType === 'Weapon' && itemInfo.gunType ? itemInfo.gunType : null;
							const weaponCurrentRounds = gunType ? Math.round(Math.random() * itemInfo.rounds) : objectType === 'Weapon' ? 1 : null;
							mapItems[itemID] = {
								...itemInfo,
								id: itemID,
								name: itemName,
								isIdentified: objectType !== 'Relic',
								currentRounds: weaponCurrentRounds,
								coords: {
									xPos: itemPlacementInfo.coords[i].xPos + this.firstMapPieceCoords.xPos,
									yPos: itemPlacementInfo.coords[i].yPos + this.firstMapPieceCoords.yPos
								}
							};
						}
					}
				}
			}
			let itemCoords = {};
			for (const [objectType, objectTypesInfo] of Object.entries(currentFloorData.objects)) {
				const alwaysOnTheLookoutSkillInfo = this.props.playerCharacters.archaeologist ? this.props.playerCharacters.archaeologist.skills.alwaysOnTheLookout : null;
				let relicChance = alwaysOnTheLookoutSkillInfo ? alwaysOnTheLookoutSkillInfo.modifier[alwaysOnTheLookoutSkillInfo.level] : 0;
				for (const [itemName, itemCountInfo] of Object.entries(objectTypesInfo)) {
					if (itemCountInfo.number > 0 || itemCountInfo.variation > 0) {
						if (objectType === 'Relic') {
							relicChance = (relicChance + itemCountInfo.chance) * 100;
						}
						if (objectType !== 'Relic' || (objectType === 'Relic' && (diceRoll(100) <= relicChance))) {
							const mapItemIds = Object.keys(mapItems);
							const existingItemHighestIdVal = mapItemIds.reduce((highestValue, currentId) => {
								const match = currentId.includes(itemName) ? +currentId.match(/\d+/)[0] : null;
								return match !== null && (!highestValue || match > highestValue) ? match : highestValue;
							}, null);
							const startingIdBaseNum = existingItemHighestIdVal !== null ? existingItemHighestIdVal + 1 : 0;
							const zeroOrPosOrNeg = diceRoll(3); // roll 1 = -1, roll 2 = 0, roll 3 = 1
							const variation = (itemCountInfo.variation > 0 && zeroOrPosOrNeg !== 2) ? diceRoll(itemCountInfo.variation) * (zeroOrPosOrNeg === 1 ? -1 : 1) : 0;
							const count = (itemCountInfo.number + variation) >= 0 ? itemCountInfo.number + variation : 0;
							for (let i=0; i < count; i++) {
								const itemInfo = objectType === 'Weapon' ? WeaponTypes[itemName] : ItemTypes[itemName];
								const tileType = itemName === 'Torch' ? 'wall' : 'floor';
								const lowerCaseName = itemName.slice(0, 1).toLowerCase() + itemName.slice(1, itemName.length).replaceAll(' ', '');
								// need parens around number calc so it's calculated before conversion to string
								const itemID = lowerCaseName + (startingIdBaseNum + i);
								const gunType = objectType === 'Weapon' && itemInfo.gunType ? itemInfo.gunType : null;
								const weaponCurrentRounds = gunType ? Math.round(Math.random() * itemInfo.rounds) : objectType === 'Weapon' ? 1 : null;
								// use this.props.playerCharacters['privateEye'].coords instead to easily test objects
								const coords = convertPosToCoords(this._generateRandomLocation(itemCoords, tileType, 'object'));
								mapItems[itemID] = {
									...itemInfo,
									id: itemID,
									name: itemName,
									isIdentified: objectType !== 'Relic',
									currentRounds: weaponCurrentRounds,
									coords
								};
								mapItems[itemID].amount =
									objectType === 'Ammo' ? Math.floor(Math.random() * 10) + 2 :
									itemName === 'Oil' ? Math.floor(Math.random() * 90) + 10 :
									objectType === 'Medicine' || objectType === 'Component' ? 1 : null;
								itemCoords[itemID] = coords;
							}
						}
					}
				}
			}
		}
		this.props.updateMapObjects(mapItems, false, () => {
			this.setState({objectsPlaced: true}, callback);
		});
	}

	/**
	 * Sets initial data for env objects appearing on the map, then calls _calculateLighting as its callback
	 * @param callback
	 * @private
	 */
	_setInitialEnvObjectData(callback) {
		let envObjects = {};
		const currentFloorData = this.state.currentLocationData.floors[this.props.currentFloor];
		if (this.state.usingSavedMapData) {
			envObjects = deepCopy(this.props.savedMaps[this.props.currentLocation].floors[this.props.currentFloor].envObjects);
		} else if (currentFloorData.isRandom) {
			if (currentFloorData.setPiece && currentFloorData.setPiece.envObjects) {
				for (const [itemId, objectInfo] of Object.entries(currentFloorData.setPiece.envObjects)) {
					for (let i = 0; i < objectInfo.number; i++) {
						//todo: add containers?
						const envItemInfo = EnvObjectTypes[itemId];
						const lowerCaseName = itemId.slice(0, 1).toLowerCase() + itemId.slice(1, itemId.length).replaceAll(' ', '');
						const uniqueItemId = lowerCaseName + i;
						envObjects[uniqueItemId] = {
							...envItemInfo,
							name: itemId,
							isIdentified: true,
							isDestroyed: false,
							coords: {
								xPos: objectInfo.coords[i].xPos + this.firstMapPieceCoords.xPos,
								yPos: objectInfo.coords[i].yPos + this.firstMapPieceCoords.yPos
							}
						};
					}
				}
			}
			let itemCoords = {};
			for (const [itemId, objCountInfo] of Object.entries(currentFloorData.envObjects)) {
				if (objCountInfo.number > 0 || objCountInfo.variation > 0) {
					const envObjIds = Object.keys(envObjects);
					const existingItemHighestIdVal = envObjIds.reduce((highestValue, currentId) => {
						const match = currentId.includes(itemId) ? +currentId.match(/\d+/)[0] : null;
						return match !== null && (!highestValue || match > highestValue) ? match : highestValue;
					}, null);
					const startingIdBaseNum = existingItemHighestIdVal !== null ? existingItemHighestIdVal + 1 : 0;
					const zeroOrPosOrNeg = diceRoll(3); // roll 1 = -1, roll 2 = 0, roll 3 = 1
					const variation = (objCountInfo.variation > 0 && zeroOrPosOrNeg !== 2) ? diceRoll(objCountInfo.variation) * (zeroOrPosOrNeg === 1 ? -1 : 1) : 0;
					const count = (objCountInfo.number + variation) >= 0 ? objCountInfo.number + variation : 0;
					for (let i = 0; i < count; i++) {
						const envItemInfo = EnvObjectTypes[itemId];
						const lowerCaseName = itemId.slice(0, 1).toLowerCase() + itemId.slice(1, itemId.length).replaceAll(' ', '');
						// need parens around number calc so it's calculated before conversion to string
						const uniqueItemId = lowerCaseName + (startingIdBaseNum + i);
						const coords = convertPosToCoords(this._generateRandomLocation(itemCoords, 'floor', 'envObject', envItemInfo.isPassable)); // this.props.playerCharacters['privateEye'].coords (to easily test objects)
						let containerContents = [];
						if (envItemInfo.type === 'container' || envItemInfo.type === 'mineable') {
							// adding null option so container could have nothing
							const itemNames = [...Object.keys(envItemInfo.mayContain), null];
							const selectedItemIndex = diceRoll(itemNames.length) - 1;
							if (itemNames[selectedItemIndex]) {
								const selectedItemName = itemNames[selectedItemIndex];
								const selectedItemUniqueId = selectedItemName.slice(0, 1).toLowerCase() + selectedItemName.slice(1, selectedItemName.length).replaceAll(' ', '') + '0';
								const objectType = ItemTypes[selectedItemName] ? 'item' : 'weapon';
								const selectedItemBaseInfo = objectType === 'item' ? ItemTypes[selectedItemName] : WeaponTypes[selectedItemName];
								let selectedItemInfo = {
									...selectedItemBaseInfo,
									id: selectedItemUniqueId,
									name: selectedItemName,
									isIdentified: selectedItemBaseInfo.itemType !== 'Relic',
									coords
								};
								const count = diceRoll(envItemInfo.mayContain[selectedItemName].max);
								if (objectType === 'item' && selectedItemBaseInfo.stackable) {
									selectedItemInfo.amount = count;
								} else if (objectType === 'weapon' && (selectedItemBaseInfo.stackable || selectedItemBaseInfo.rounds)) {
									selectedItemInfo.currentRounds = count
								}
								containerContents = [selectedItemInfo];
							}
						}
						envObjects[uniqueItemId] = {
							...envItemInfo,
							name: itemId,
							isIdentified: true,
							isDestroyed: false,
							containerContents,
							isOpen: envItemInfo.type === 'container' ? false : null,
							coords
						};
						if (envItemInfo.isHidden) {
							envObjects[uniqueItemId].isDiscovered = false;
						}
						itemCoords[uniqueItemId] = coords;
					}
				}
			}
		} else {
			// for static maps
			for (const [itemName, itemPositions] of Object.entries(currentFloorData.envObjects)) {
				const envItemInfo = EnvObjectTypes[itemName];
				itemPositions.forEach((pos, i) => {
					const lowerCaseName = itemName.slice(0, 1).toLowerCase() + itemName.slice(1, itemName.length).replaceAll(' ', '');
					const uniqueItemId = lowerCaseName + i;
					envObjects[uniqueItemId] = {
						...envItemInfo,
						name: itemName,
						coords: convertPosToCoords(pos)
					};
				});
			}
		}
		this.props.updateMapEnvObjects(envObjects, null, () => {
			this.setState({envObjectsPlaced: true}, callback);
		});
	}

	/**
	 * Can be used to place any character/object
	 * Makes list of all tiles, chooses one by one at random,
	 * and checks them for other creatures, players, and objects to find an empty one
	 * A char and object can occupy same tile, but env obj is placed with nothing else (even if passable)
	 * If placing env obj, needs to check if canHaveObject, and if so, objectMustBePassable and objectCanBeImpassable
	 * Note: during map setup, players get placed first, then creatures, then items, then env objects
	 * @param objectCoords Object (collection of objects/chars being placed by calling function, before they've been set to state)
	 * @param tileType String (either 'floor' or 'wall')
	 * @param objectType String ('creature', 'object', or 'envObject')
	 * @param isPassable Boolean (true if object can be walked over)
	 * @returns {string}
	 * @private
	 */
	_generateRandomLocation(objectCoords = {}, tileType, objectType, isPassable) {
		const isEnvObj = objectType === 'envObject';
		let emptyLocFound = false;
		// list of available tiles, in str format, on which to place stuff
		let tileList = Object.keys(this.state.mapLayout).filter(tilePos => {
			// only use floor if desired type is floor, wall if desired type is wall,
			// and if it's a creature or obj, don't place in a scripted room
			// (creatures are already designated in gameLocations, and since envobjs get placed after objs, obj could get placed in scripted envObj coords which aren't checked in this func)
			return (
				(objectType === 'envObject' || this.state.mapLayout[tilePos].piece !== 'roomScripted') &&
				((tileType === 'floor' && this.state.mapLayout[tilePos].type === 'floor') ||
				(tileType === 'wall' && (this.state.mapLayout[tilePos].classes === 'left-wall' || this.state.mapLayout[tilePos].classes === 'right-wall' || this.state.mapLayout[tilePos].classes === 'top-wall')))
			);
		});
		let newObjectList = Object.values(objectCoords).length > 0 ? Object.values(objectCoords).map(object => convertCoordsToPos(object)) : null;
		let randomIndex = 0;
		let tilePos = '';
		const nextExitPos = this.state.exits.nextAreaExitCoords ? convertCoordsToPos(this.state.exits.nextAreaExitCoords) : null;
		const prevExitPos = this.state.exits.previousAreaExitCoords ? convertCoordsToPos(this.state.exits.previousAreaExitCoords) : null;
		let allCharacterPos = [];
		const listOfMapObjectsPos = isEnvObj ? Object.values(this.props.mapObjects).map(object => convertCoordsToPos(object.coords)) : null;

		if (Object.keys(this.props.playerCharacters).length > 0) {
			this.props.getAllCharactersPos('player', 'pos').forEach(player => {
				allCharacterPos.push(player.pos);
			});
		}
		if (Object.keys(this.props.mapCreatures).length > 0) {
			this.props.getAllCharactersPos('creature', 'pos').forEach(creature => {
				allCharacterPos.push(creature.pos);
			});
		}
		while (!emptyLocFound && tileList.length > 0) {
			randomIndex = Math.floor(Math.random() * tileList.length);
			tilePos = tileList[randomIndex];
			const canHaveObject = this.state.mapLayout[tilePos].canHaveObject;
			const objectMustBePassable = this.state.mapLayout[tilePos].objectMustBePassable;
			let noAdjacentImpassables = true;
			const tileHasNoMapObjects = isEnvObj ? !listOfMapObjectsPos.includes(tilePos) : null;

			if (isEnvObj && newObjectList) {
				const adjacentTiles = this._getAllSurroundingTilesToRange(tilePos, 1)['1Away'];
				let posIndex = 0;
				while (noAdjacentImpassables && posIndex < adjacentTiles.length) {
					if (newObjectList.includes(adjacentTiles[posIndex])) {
						noAdjacentImpassables = false;
					} else {
						posIndex++;
					}
				}
			}

			// If tilePos is not the exit, not where an obj is, not where a character is, obj either isn't env obj,
			// or if it is env obj, and tile is allowed to have an env obj, and tile has no items, and
			// no other env objs adjacent, and obj passability matches tile passibility attr,
			// then loc is good to use
			// First two comparisons formatted like !(a && b) because 'null && false' equals null, not false, while '!(null && true)' equals true
			if ((!nextExitPos || tilePos !== nextExitPos) &&
				(!prevExitPos || tilePos !== prevExitPos) &&
				(!newObjectList || !newObjectList.includes(tilePos)) &&
				!allCharacterPos.includes(tilePos) &&
				(!isEnvObj ||
					(isEnvObj &&
					canHaveObject &&
					tileHasNoMapObjects &&
					noAdjacentImpassables &&
					((objectMustBePassable && isPassable) || !objectMustBePassable)))
			) {
				emptyLocFound = true;
			} else {
				// remove tile from list of available locations
				tileList.splice(randomIndex, 1);
			}
		}
		return tilePos;
	}

	/**
	 * For checking if any pc can see a specific tile (used for checking if a tile lit by a map light source is in view)
	 * @param pos: string
	 * @param playerPositions: array (of Objects {id: coords})
	 * @returns {boolean}
	 */
	tileSeenByAnyPc(pos, playerPositions) {
		const numberPCs = playerPositions.length;
		let tileIsSeen = false;
		let playerIndex = 0;
		while (!tileIsSeen && playerIndex < numberPCs) {
			const playerPos = playerPositions[playerIndex].pos;
			tileIsSeen = this.isInLineOfSight(playerPos, pos, false);
			playerIndex++;
		}
		return tileIsSeen;
	}

	/**
	 * Finds all light objects in the map
	 * @returns {*[]}
	 */
	findMapLights() {
		let mapLights = [];
		for (const [id, objInfo] of Object.entries({...this.props.mapObjects, ...this.props.envObjects})) {
			if ((objInfo.itemType && objInfo.itemType === 'Light') || (objInfo.type && objInfo.type === 'light')) {
				const light = {id, pos: convertCoordsToPos(objInfo.coords), range: objInfo.range};
				mapLights.push(light);
			}
		}
		return mapLights;
	}

	/**
	 * Adds range attribute to each light info object in passed in array,
	 * and removes any light object whose light has expired (or if no light equipped)
	 * @param allLights: Array (of objects: {id, pos})
	 * @return {*[]}
	 * @private
	 */
	_getActiveLightRanges(allLights) {
		let allLightPos = [...allLights];
		let idsToRemove = [];

		// add range info for player lights or remove from array if light expired
		allLightPos.forEach((light, index, lightsArray) => {
			// check if light belongs to player (instead of map)
			const player = this.props.playerCharacters[light.id];
			if (player) {
				if (player.lightTime === 0 || !player.equippedLight) {
					idsToRemove.push(light.id);
				} else {
					lightsArray[index].range = player.lightRange;
				}
			}
		});
		if (idsToRemove.length > 0) {
			idsToRemove.forEach(id => {
				let matchingId = allLightPos.findIndex(light => id === light.id);
				if (matchingId >= 0) {
					allLightPos.splice(matchingId, 1);
				}
			});
		}
		return allLightPos;
	}

	/**
	 * Calculates lighting for each tile from map lights and pc lights
	 * @param callback
	 * @private
	 */
	_calculateLighting(callback) {
		const playerPositions = this.props.getAllCharactersPos('player', 'pos');
		let mapLights = this.findMapLights();
		let allLightPos = [...playerPositions, ...mapLights];
		const lightStrengthByTile = {};
		const mapLayout = deepCopy(this.state.mapLayout);
		const capLightStrength = (pos) => {
			if (lightStrengthByTile[pos] > this.maxLightStrength) {
				lightStrengthByTile[pos] = this.maxLightStrength;
			}
		}

		for (const tileData of Object.values(mapLayout)) {
			tileData.lightStrength = 0;
		}

		// add range info for player lights or remove from array if light expired
		allLightPos = this._getActiveLightRanges(allLightPos);

		// get all lit floors/walls around each player and map light that are in LOS of a player
		// lineOfSightTiles are tiles in LOS from their own source
		let lineOfSightTiles = this._getLitSurroundingTiles(allLightPos);
		// now need to check which map light lit tiles are viewable by PCs
		const mapLightsLitTiles = this._getLitSurroundingTiles(mapLights);
		for (const [distance, floorsAndWalls] of Object.entries(mapLightsLitTiles)) {
			for (const [tileType, positions] of Object.entries(floorsAndWalls)) {
				for (const litTilePos of Object.keys(positions)) {
					if (!this.tileSeenByAnyPc(litTilePos, playerPositions)) {
						delete lineOfSightTiles[distance][tileType][litTilePos];
					}
				}
			}
		}

		// Calculate light strengths for each lit tile (except source tiles) based on all light sources
		const distValues = {'1Away': 1, '2Away': 2, '3Away': 3, '4Away': 4, '5Away': 5};
		for (const [distance, tiles] of Object.entries(lineOfSightTiles)) {
			for (const positions of Object.values(tiles)) {
				for (const [pos, ranges] of Object.entries(positions)) {
					// add together each light source range minus its distance from source (ie. if a 4 str light at dist of 2 and 3 str light at dist of 2, total str is 3)
					lightStrengthByTile[pos] = (lightStrengthByTile[pos] || 0) + ranges.reduce((accumulator, value) => accumulator + value - distValues[distance], 0);
						capLightStrength(pos);
					mapLayout[pos].lightStrength = lightStrengthByTile[pos];
				}
			}
		}

		// now add source tile strengths
		allLightPos.forEach(source => {
			let mapLightIsSeen = false;
			if (mapLights.some(mapLight => mapLight.id === source.id)) {
				mapLightIsSeen = this.tileSeenByAnyPc(source.pos, playerPositions);
			}
			if (this.props.playerCharacters[source.id] || mapLightIsSeen) {
				lightStrengthByTile[source.pos] = (lightStrengthByTile[source.pos] || 0) + source.range;
				capLightStrength(source.pos);
				mapLayout[source.pos].lightStrength = lightStrengthByTile[source.pos];
			}
		});

		const allLitTiles = this._getAllLitTiles(mapLayout);
		const playerVisited = Object.assign(this.state.playerVisited, allLitTiles);

		this.setState({mapLayout, lightingCalculated: true, playerVisited}, () => {
			if (callback) callback();
		});
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
		let allClasses = this.props.currentLocation;
		const tileData = this.state.mapLayout[tilePos];
		const xPos = (tileData.xPos * this.tileSize) + 'px';
		const yPos = (tileData.yPos * this.tileSize) + 'px';
		const size = this.tileSize + 'px';
		const tileStyle = {
			transform: `translate(${xPos}, ${yPos})`,
			width: size,
			height: size
		};
		const tileLightStr = tileData.lightStrength;

		if (tileData.classes && tileData.classes !== '') {
			allClasses += ` ${tileData.classes}`;
			if (tileData.isSecretDoor && !tileData.isDiscovered) {
				allClasses += ' secret';
			}
		} else if (tileData.type === 'floor') {
			allClasses += ' floor'
		}

		return (<Tile
			key={tilePos}
			tileType={tileData.type}
			styleProp={tileStyle}
			tilePos={convertCoordsToPos(tileData)}
			classStr={allClasses}
			dataLightStr={tileLightStr}
			moveCharacter={(tilePos, e) => {
				if (this.contextMenuOpen) {
					this.contextMenuOpen = false;
					this.props.updateContextMenu(null);
				} else if (!this.isDraggingWorld) {
					const activePcCoords = this.props.playerCharacters[this.props.activeCharacter].coords;
					const movementDistance = getDistanceBetweenTargets(convertPosToCoords(tilePos), activePcCoords);
					if (tileData.type === 'door' && tileData.doorIsOpen && movementDistance === 1) {
						this.props.updateContextMenu('close-door', tilePos, e);
					} else {
						this.checkIfTileOrObject(tilePos, null);
					}
				}
			}} />);
	}

	/**
	 * Called by render() and spawns all PCs and NPCs/creatures on the map, creating a Character component for each one
	 * @returns Array (of Character components)
	 */
	addCharacters = () => {
		let npcs = {};
		for (const [id, npcData] of Object.entries(this.props.npcs)) {
			if (npcData.location === this.props.currentLocation && npcData.floor === this.props.currentFloor) {
				npcs[id] = npcData;
			}
		}
		const characters = {...this.props.playerCharacters, ...this.props.mapCreatures, ...npcs};
		const characterIDs = Object.keys(characters);
		let characterList = [];
		let characterTransform = null;
		let characterCoords = {};
		let creatureNotRendered = false;

		characterIDs.forEach(id => {
			characterCoords = characters[id].coords;
			const characterPos = convertCoordsToPos(characterCoords);
			const actionButtonSelected = this.props.actionButtonSelected;
			const activeCharIsPlayer = this.props.activeCharacter ? this.props.playerCharacters[this.props.activeCharacter] : null;
			const characterType = characters[id].type;
			const isDyingPc = characterType === 'player' && characters[id].currentHealth <= 0;
			let targetIsInRange = false;
			let companionIsAdjacent = false;
			let activePlayerPos = '';
			let adjacentTiles = {};
			let isResuscitateSkill = false;
			let otherCharisOnTopOfPc = false;

			if (characterType === 'player') {
				characterTransform = this._calculateObjectTransform(characterCoords.xPos, characterCoords.yPos);
			} else {
				// hide all creatures from rendering unless creature is in sight of any PC or map light
				creatureNotRendered = this.state.mapLayout[characterPos].lightStrength === 0;
				characterTransform = this._calculateObjectTransform(characterCoords.xPos, characterCoords.yPos);
			}

			// check if character is standing on top of (dead/insane) pc
			const partyData = Object.values(this.props.playerCharacters);
			let pcCounter = 0;
			while (!otherCharisOnTopOfPc && pcCounter < partyData.length && id !== partyData[pcCounter].id) {
				if (characterPos === convertCoordsToPos(partyData[pcCounter].coords) &&
					characters[id].currentHealth > 0 &&
					(partyData[pcCounter].currentHealth <= 0 || partyData[pcCounter].currentSanity <= 0))
				{
					otherCharisOnTopOfPc = true;
				} else {
					pcCounter++;
				}
			}

			if (actionButtonSelected) {
				const actionItemType = actionButtonSelected.stats.itemType;
				const actionSkillType = actionButtonSelected.stats.skillType;
				// currentCharType is player and action is either skill or non-Relic item
				if (characterType === 'player' && ((actionSkillType && actionButtonSelected.stats.name !== 'Disarm Trap') || (actionItemType && actionItemType !== 'Relic'))) {
					const buttonName = actionButtonSelected.buttonName;
					isResuscitateSkill = buttonName && buttonName === 'Resuscitate';
					let adjacentCompanionIsDying = false;
					activePlayerPos = convertCoordsToPos(activeCharIsPlayer.coords);
					adjacentTiles = this._getAllSurroundingTilesToRange(activePlayerPos, 1);
					for (const positions of Object.values(adjacentTiles)) {
						if (positions.includes(characterPos)) {
							adjacentCompanionIsDying = isDyingPc;
							companionIsAdjacent = true;
						}
					}
					const pcNeedsHealth = buttonName === 'First Aid Kit' && (characters[id].currentHealth < characters[id].startingHealth) && characters[id].currentHealth > 0;
					const pcNeedsSanity = buttonName === 'Pharmaceuticals' && (characters[id].currentSanity < characters[id].startingSanity) && characters[id].currentSanity > 0;
					const isHealTypeSkill = buttonName === 'First Aid Kit' || buttonName === 'Pharmaceuticals';
					targetIsInRange = activeCharIsPlayer && (
						((activePlayerPos === characterPos || companionIsAdjacent) && (pcNeedsHealth || pcNeedsSanity)) ||
						(companionIsAdjacent && ((!isResuscitateSkill && !isHealTypeSkill) || (isResuscitateSkill && adjacentCompanionIsDying))) ||
						(!isResuscitateSkill && !isHealTypeSkill && activePlayerPos === characterPos));
				// either attacking a creature or using a Relic on an old one
				} else if (characterType === 'creature' && !actionSkillType && (!actionItemType || (actionItemType && actionItemType === 'Relic' && characters[id].isOldOne))) {
					targetIsInRange = activeCharIsPlayer &&
						(actionButtonSelected.buttonName !== 'Holy Water' || characters[id].race === 'Undead') &&
						characters[id].currentHealth > 0 &&
						this.isCreatureInRange(id, actionButtonSelected);
				}
			}

			this.charRefs[id] = createRef();
			const idConvertedToClassName = convertObjIdToClassId(id);
			characterList.push(
				<Character
					id={id}
					key={id}
					charRef={this.charRefs[id]}
					characterType={characterType}
					idClassName={idConvertedToClassName}
					isHidden={creatureNotRendered || characters[id].isRemoved}
					isInvisible={characters[id].statuses.invisible}
					isSelected={characters[id].isSelected}
					isStealthy={id === 'thief' && characters[id].statuses.stealthy}
					isDying={isDyingPc}
					isDead={characters[id].currentHealth <= 0 && !isDyingPc}
					isCatatonic={characters[id].currentSanity <= 0 && characters[id].currentHealth > 0}
					isInRange={actionButtonSelected && targetIsInRange}
					isLineOfSight={this.isInLineOfSight}
					isOtherCharOnTop={otherCharisOnTopOfPc}
					charPos={characterPos}
					updateContextMenu={this.checkForDragging}
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
	 * Creates list of item components from props.mapObjects
	 * @returns {*[]}
	 */
	addItems = () => {
		let items = [];
		let tileIsVisible = true;

		for (const [id, info] of Object.entries(this.props.mapObjects)) {
			let idConvertedToClassName = convertObjIdToClassId(id);
			const objPos = convertCoordsToPos(info.coords);

			// to prevent clicking on items not visible
			tileIsVisible = this.state.mapLayout[objPos].lightStrength > 0;

			if (idConvertedToClassName === 'torch') {
				const pos = convertCoordsToPos(info.coords);
				switch (this.state.mapLayout[pos].classes) {
					case 'top-wall': idConvertedToClassName = 'torch-top-wall';
						break;
					case 'left-wall': idConvertedToClassName = 'torch light-left-wall';
						break;
					case 'right-wall': idConvertedToClassName = 'torch light-right-wall';
						break;
				}
			}
			items.push((<Item
				key={id}
				objectInfo={{id, ...info}}
				class={idConvertedToClassName}
				tilePos={convertCoordsToPos(info.coords)}
				tileIsVisible={tileIsVisible}
				updateContextMenu={this.checkForDragging}
				styles={{
					transform: `translate(${this._calculateObjectTransform(info.coords.xPos, info.coords.yPos)})`,
					width: this.tileSize + 'px',
					height: this.tileSize + 'px'
				}}
			/>))
		}
		return items;
	}

	/**
	 * Wrapper called by render() to run all env object spawning functions
	 * that will add their returned components to an array
	 * @returns Array (of object components)
	 */
	addAllEnvObjects = () => {
		let allObjects = [];
		allObjects.push(...this._addDoors(), this._addExits(), ...this._addEnvObjects());

		return allObjects;
	}

	_addEnvObjects() {
		let objects = [];
		let tileIsVisible = true;

		for (const [id, info] of Object.entries(this.props.envObjects)) {
			let idConvertedToClassName = convertObjIdToClassId(id);
			const objPos = convertCoordsToPos(info.coords);
			const isTargetForDisarm = info.type === 'trap' &&
				this.props.skillModeActive === 'disarmTrap' &&
				this.props.actionButtonSelected.stats.targetData.find(target => convertCoordsToPos(target.coords) === objPos);

			if (info.type === 'light') {
				const pos = convertCoordsToPos(info.coords);
				switch (this.state.mapLayout[pos].classes) {
					case 'top-wall': idConvertedToClassName = 'fancy-wall-light-top-wall';
						break;
					case 'left-wall' : idConvertedToClassName = 'fancy-wall-light light-left-wall';
						break;
					case 'right-wall' : idConvertedToClassName = 'fancy-wall-light light-right-wall';
						break;
					case 'bottom-left-inverse-wall' : idConvertedToClassName = 'fancy-wall-light light-bottom-left-inverse-wall';
						break;
					case 'bottom-right-inverse-wall' : idConvertedToClassName = 'fancy-wall-light light-bottom-right-inverse-wall';
						break;
					case 'top-left-inverse-wall' : idConvertedToClassName = 'fancy-wall-light light-top-left-inverse-wall';
						break;
					case 'top-right-inverse-wall' : idConvertedToClassName = 'fancy-wall-light light-top-right-inverse-wall';
						break;
				}
			}
			// to prevent clicking on objects not visible
			tileIsVisible = this.state.mapLayout[objPos].lightStrength > 0;

			objects.push((<EnvObject
				key={id}
				objectInfo={{id, ...info}}
				class={idConvertedToClassName}
				tilePos={convertCoordsToPos(info.coords)}
				tileIsVisible={tileIsVisible}
				isDiscovered={info.isDiscovered}
				isContainerOpen={info.isOpen}
				isDestroyed={info.isDestroyed}
				isSprung={info.isSprung}
				isTargetForDisarm={isTargetForDisarm}
				isUnselectable={info.unselectable}
				updateContextMenu={this.checkForDragging}
				styles={{
					transform: `translate(${this._calculateObjectTransform(info.coords.xPos, info.coords.yPos)})`
				}}
			/>))
		}
		return objects;
	}

	/**
	 * Creates Exit components for nextArea and previousArea
	 * @returns Array of JSX.Element (Exit components)
	 * @private
	 */
	_addExits() {
		let exits = [];
		if (this.state.exits.randomExits) {
			if (this.state.exits.previousAreaExitCoords) {
				exits.push({class: `${this.props.currentLocation} stairs-up`, coords: this.state.exits.previousAreaExitCoords});
			}
			if (this.state.exits.nextAreaExitCoords) {
				exits.push({class: `${this.props.currentLocation} stairs-down`, coords: this.state.exits.nextAreaExitCoords});
			}
		} else if (this.state.exits.stairs) {
			// only need to do this for stairs, not doors (that will be handled by checkForExit)
			if (this.state.exits.stairs.up) {
				this.state.exits.stairs.up.forEach(stairsInfo => {
					exits.push({class: `${this.props.currentLocation} stairs-up`, coords: convertPosToCoords(stairsInfo.pos)});
				});
			}
			if (this.state.exits.stairs.down) {
				this.state.exits.stairs.down.forEach(stairsInfo => {
					exits.push({class: `${this.props.currentLocation} stairs-down`, coords: convertPosToCoords(stairsInfo.pos)});
				});
			}
		}
		return exits.map(info => {
			return (<Exit
				key={'exit-' + convertCoordsToPos(info.coords)}
				class={info.class}
				style={{
					transform: `translate(${this._calculateObjectTransform(info.coords.xPos, info.coords.yPos)})`,
					width: this.tileSize + 'px',
					height: this.tileSize + 'px'
				}}
			/>);
		});
	}

	/**
	 * Creates and transforms Door components
	 * @returns Array (of Door components)
	 * @private
	 */
	_addDoors() {
		let objects = [];

		for (const [tilePos, tileData] of Object.entries(this.state.mapLayout)) {
			const tileCoords = convertPosToCoords(tilePos);
			if (tileData.type === 'door') {
				let doorClass = this.props.currentLocation + ' door';
				let topStyle = '';
				let leftStyle = '';
				const isSecret = tileData.isSecretDoor;
				const isDiscovered = tileData.isDiscovered;
				if (tileData.classes.includes('top-bottom-door')) {
					if (tileData.doorIsOpen) {
						doorClass += isSecret ? ' secret-front-door-open' : ' front-door-open';
					} else {
						doorClass += isSecret && !isDiscovered ? ' secret-front-door' : isSecret && isDiscovered ? ' secret-front-door-discovered' : ' front-door';
					}
					// todo: can remove?
					// doorClass += tileData.doorIsOpen ? ' front-door-open' : isSecret ? ' secret-front-door' : ' front-door';
					if (doorClass.includes('open') && !isSecret) {
						topStyle = (this.tileSize / 2) + 'px';
						leftStyle = -(this.tileSize / 2) + 'px';
					}
				} else if (tileData.classes.includes('left-door')) {
					if (tileData.doorIsOpen) {
						doorClass += isSecret ? ' secret-side-door-open' : ' left-side-door-open';
					} else {
						doorClass += isSecret && !isDiscovered ? ' secret-left-side-door' : isSecret && isDiscovered ? ' secret-side-door-discovered' : ' side-door';
					}
					// todo: can remove?
					// doorClass += tileData.doorIsOpen ? ' left-side-door-open' : isSecret ? ' secret-left-side-door' : ' side-door';
					if (doorClass.includes('open') && !isSecret) {
						topStyle = -(this.tileSize / 2) + 'px';
						leftStyle = -(this.tileSize / 2) + 'px';
					}
				} else if (tileData.classes.includes('right-door')) {
					if (tileData.doorIsOpen) {
						doorClass += isSecret ? ' secret-side-door-open' : ' right-side-door-open';
					} else {
						doorClass += isSecret && !isDiscovered ? ' secret-right-side-door' : isSecret && isDiscovered ? ' secret-side-door-discovered' : ' side-door';
					}
					// todo: can remove?
					// doorClass += tileData.doorIsOpen ? ' right-side-door-open' : isSecret ? ' secret-right-side-door' : ' side-door';
					if (doorClass.includes('open') && !isSecret) {
						topStyle = -(this.tileSize / 2) + 'px';
						leftStyle = (this.tileSize / 2) + 'px';
					}
				}
				objects.push(
					<Door
						key={`object-${tilePos}`}
						isDiscovered={tileData.isDiscovered}
						styleProp={{
							transform: `translate(${this._calculateObjectTransform(tileCoords.xPos, tileCoords.yPos)})`,
							width: this.tileSize + 'px',
							height: this.tileSize + 'px',
							top: topStyle,
							left: leftStyle
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
	 * as lit by map lights and PC lights
	 * @returns Array (of LightElement components)
	 */
	addLighting = () => {
		let tiles = [];
		const playerPositions = this.props.getAllCharactersPos('player', 'pos').map(pc => pc.pos);

		for (const [tilePos, tileData] of Object.entries(this.state.mapLayout)) {
			let allClasses = 'light-tile';
			const tileLightStr = tileData.lightStrength;

			if (tileLightStr <= this.maxLightStrength && tileLightStr >= 1) {
				allClasses += ` light-strength-${tileLightStr} black-light`;
			} else if (playerPositions.includes(tilePos)) {
				// if lightStr is 0 for tile, make class str minStr (2) so user can see pc
				allClasses += ` light-strength-${this.minPcTileLightStrength} black-light`;
			} else if (this.state.playerVisited[tilePos] || this.state.currentLocationData.floors[this.props.currentFloor].allTilesAtLeastAmbientLit) {
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
				tileName={convertCoordsToPos(this.state.mapLayout[tilePos])}
				classes={allClasses} />);
		}

		return tiles;
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
	 * @param actionType: String ('close-door' or 'move', from user clicking on context menu after clicking on open door)
	 */
	checkIfTileOrObject = (tilePos, direction, actionType = null) => {
		let tileData = this.state.mapLayout[tilePos];
		let newPos = tilePos;
		const activePCCoords = this.props.playerCharacters[this.props.activeCharacter].coords;

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
			tileData = this.state.mapLayout[newPos];
		}

		if (this.props.currentLocation === 'museum' && this.props.currentFloor === 1 &&
			this.props.npcs.professorNymian.conversationStatus.nextMessageKey === 'professor-1' && !this.props.skipIntroConversation) {
			// allow time to show pc moving before conv starts
			setTimeout(() => {
				this.props.setConversationTarget({id: 'professorNymian', targetType: 'npc'});
			}, 500);
		} else if (tileData) {
			const newCoords = convertPosToCoords(newPos);
			const movementDistance = getDistanceBetweenTargets(newCoords, activePCCoords);
			const lockedDoors = this.state.currentLocationData.floors[this.props.currentFloor].lockedDoors;
			const doorIsLocked = lockedDoors && lockedDoors.includes(newPos);

			// todo: need to add info when clicked door is an exit?
			if (tileData.type === 'door' && movementDistance === 1 && (!tileData.doorIsOpen || actionType === 'close-door')) {
				if (actionType === 'close-door' || !doorIsLocked) {
					this.toggleDoor(newPos);
				} else if (doorIsLocked) {
					this.props.setShowDialogProps(true, this.props.lockedDoorDialogProps);
				}
			} else if (tileData.type !== 'wall') {
				const pathData = this._pathFromAtoB(this.props.playerCharacters[this.props.activeCharacter].coords, newCoords);
				this.moveCharacter(pathData);
			}
		}
	}

	/**
	 * Checks to see if player char is on exit tile and if so, shows dialog to give player choice of action
	 * @private
	 */
	_checkForExit() {
		const activePCpos = convertCoordsToPos(this.props.playerCharacters[this.props.activeCharacter].coords);
		const nextAreaExitPos = this.state.exits.nextAreaExitCoords ? convertCoordsToPos(this.state.exits.nextAreaExitCoords) : null;
		const previousAreaExitPos = this.state.exits.previousAreaExitCoords ? convertCoordsToPos(this.state.exits.previousAreaExitCoords) : null;
		const exitIsDoor = this.state.exits.doors ? this.state.exits.doors.find(doorInfo => doorInfo.pos === activePCpos) : null;
		const exitIsStairsDown = (this.state.exits.stairs && this.state.exits.stairs.down) ? this.state.exits.stairs.down.find(stairsInfo => stairsInfo.pos === activePCpos) : null;
		const exitIsStairsUp = (this.state.exits.stairs && this.state.exits.stairs.up) ? this.state.exits.stairs.up.find(stairsInfo => stairsInfo.pos === activePCpos) : null;
		const exitToLocation =
			(previousAreaExitPos === activePCpos && this.props.currentFloor === 1) ? this.state.exits.enteredFrom :
			exitIsStairsDown ? exitIsStairsDown.destination :
			exitIsStairsUp ? exitIsStairsUp.destination :
			exitIsDoor ? exitIsDoor.destination : null;
		let goingToNewArea = false;

		if (nextAreaExitPos === activePCpos || previousAreaExitPos === activePCpos || exitIsStairsDown || exitIsStairsUp || exitIsDoor) {
			goingToNewArea = true;
		}
		if (goingToNewArea) {
			let dialogProps = {};
			if (this.props.threatList.length > 0) {
				dialogProps = {
					dialogContent: "You can't exit the level while in combat.",
					closeButtonText: 'Ok',
					closeButtonCallback: null,
					disableCloseButton: false,
					actionButtonVisible: false,
					actionButtonText: '',
					actionButtonCallback: null,
					dialogClasses: ''
				};
			} else if (this.props.inTacticalMode && !this.props.partyIsNearby) {
				dialogProps = {
					dialogContent: "All party members need to be in sight of each other before exiting.",
					closeButtonText: 'Ok',
					closeButtonCallback: null,
					disableCloseButton: false,
					actionButtonVisible: false,
					actionButtonText: '',
					actionButtonCallback: null,
					dialogClasses: ''
				};
			} else if (exitToLocation) {
				dialogProps = {
					dialogContent: `Do you want to take the exit to the ${exitToLocation} or stay here?`,
					closeButtonText: 'Stay here',
					closeButtonCallback: null,
					disableCloseButton: false,
					actionButtonVisible: true,
					actionButtonText: `Go to the ${exitToLocation}`,
					actionButtonCallback: () => {
						this.saveAllData(this.resetMap, 1, exitToLocation);
					},
					dialogClasses: ''
				};
			} else {
				dialogProps = {
					dialogContent: `Do you want to take the stairs or stay here?`,
					closeButtonText: 'Stay here',
					closeButtonCallback: null,
					disableCloseButton: false,
					actionButtonVisible: true,
					actionButtonText: 'Take the stairs',
					actionButtonCallback: () => {
						this.saveAllData(this.resetMap, nextAreaExitPos === activePCpos ? this.props.currentFloor + 1 : this.props.currentFloor - 1);
					},
					dialogClasses: ''
				};
			}
			const showDialog = true;
			this.props.setShowDialogProps(showDialog, dialogProps);
		}
	}

	/**
	 * Checks if location has a scripted conv with triggers (char ids) that match those in list of encountered chars
	 * @param newEncounters array (ids of encountered chars (usually creatures))
	 * @param updateThreatsCallback function (calls updateThreatList in App - check for added/removed threats already done in Map's calling function)
	 * @private
	 */
	_checkForScriptedConversation(newEncounters, updateThreatsCallback) {
		const floorMapData = this.state.currentLocationData.floors[this.props.currentFloor];
		let conversation = '';
		if (floorMapData.setPiece && floorMapData.setPiece.dialogs) {
			let i = 0;
			for (const convInfo of Object.values(floorMapData.setPiece.dialogs)) {
				while (!conversation && i < newEncounters.length) {
					if (convInfo.triggers.includes(newEncounters[i])) {
						conversation = convInfo.conversation;
					}
					i++;
				}
			}
		}
		if (conversation && this.props.threatList.length === 0 && !this.props.storyProgress.dialogs[conversation].triggered) {
			this.props.setConversationTarget({id: conversation, targetType: 'npc', updateThreatsCallback});
		} else if (updateThreatsCallback) {
			updateThreatsCallback();
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
		const activePlayerPos = convertCoordsToPos(activePlayerCoords);
		let isInRangedWeaponRange = false;
		let isInMeleeRange = false;

		if (creatureCoords) {
			if (weaponData.stats.ranged) {
				const creaturePos = convertCoordsToPos(creatureCoords);
				const visibleTiles = this._getAllLitTiles();

				if (visibleTiles[creaturePos] && this.isInLineOfSight(activePlayerPos, creaturePos, true)) {
					isInRangedWeaponRange = true;
				}
			} else if (Math.abs(creatureCoords.xPos - activePlayerCoords.xPos) <= 1 && Math.abs(creatureCoords.yPos - activePlayerCoords.yPos) <= 1) {
				isInMeleeRange = true;
			}
		}
		return isInRangedWeaponRange || isInMeleeRange;
	}

	/**
	 * Searches tiles between start and end to find a clear path (no PCs, no creatures, no objects, no walls)
	 * Does this by looking at all 8 connections around a tile, prioritized by most direct route to least direct
	 * Tiles are rated by distance (x+y) to the end, lower being better, or 0 if it's blocked
	 * Tile positions and their ratings are temp stored in order to reference/return to them should a path become blocked.
	 * @param startTileCoords: Object (of x and y values)
	 * @param endTileCoords: Object (of x and y values)
	 * @returns Array (of strings (positions))
	 * @private
	 */
	_pathFromAtoB(startTileCoords, endTileCoords) {
		const allPcPos = this.props.getAllCharactersPos('player', 'pos');
		const allCreaturePos = this.props.getAllCharactersPos('creature', 'pos');
		const allNpcPos = this.props.getAllCharactersPos('npc', 'pos');
		const allEnvObjectPos = [];
		const endTilePos = convertCoordsToPos(endTileCoords);

		for (const envObjData of Object.values(this.props.envObjects)) {
			allEnvObjectPos.push({pos: convertCoordsToPos(envObjData.coords), isPassable: envObjData.isPassable});
		}

		let pathData = {
			tilePath: [],
			blocker: ''
		}
		let tilePath = [];
		let isBlocked = '';
		let startingPos = convertCoordsToPos(startTileCoords);
		let currentX = startTileCoords.xPos;
		let currentY = startTileCoords.yPos;
		let closestDistanceToEnd = getDistanceBetweenTargets(startTileCoords, endTileCoords); // Math.abs(endTileCoords.xPos - currentX) + Math.abs(endTileCoords.yPos - currentY);
		let currentDistanceToEnd = closestDistanceToEnd;
		const startXDelta = Math.abs(endTileCoords.xPos - startTileCoords.xPos);
		const startYDelta = Math.abs(endTileCoords.yPos - startTileCoords.yPos);
		const startRating = startXDelta + startYDelta;
		let checkedTiles = {[startingPos]: {rating: startRating}};
		let noPathAvail = false;

		const isTileBlocked = (testPos) => {
			return this.state.mapLayout[testPos].type === 'wall' ||
				(this.state.mapLayout[testPos].type === 'door' && !this.state.mapLayout[testPos].doorIsOpen) ||
				(allPcPos.find(pc => pc.pos === testPos) && this.props.inTacticalMode) ||
				allCreaturePos.find(creature => creature.pos === testPos) ||
				allNpcPos.find(npc => npc.pos === testPos) ||
				allEnvObjectPos.find(obj => (obj.pos === testPos && !obj.isPassable));
		}

		const checkForCleanPath = (currentPos, coords, rating) => {
			let testPos = convertCoordsToPos(coords);
			let isTestPosOk = true;
			currentDistanceToEnd = getDistanceBetweenTargets(coords, endTileCoords); // Math.abs(endTileCoords.xPos - coords.xPos) + Math.abs(endTileCoords.yPos - coords.yPos);
			if (currentDistanceToEnd < closestDistanceToEnd) {
				closestDistanceToEnd = currentDistanceToEnd;
			}
			isBlocked = isTileBlocked(testPos);
			if (isBlocked) {
				// if this is the closest we've gotten to the end (it's the bestPath), remember this blocker
				if (currentDistanceToEnd === closestDistanceToEnd) {
					pathData.blocker = testPos === endTilePos ? 'justBeforeEnd' : true;
				}
				// rated 0 for blocked tile
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
			}
			return isTestPosOk;
		}

		const modifierPairs = [
			{x: -1, y: -1}, // 0
			{x: 0, y: -1}, // 1
			{x: 1, y: -1}, // 2
			{x: 1, y: 0}, // 3
			{x: 1, y: 1}, // 4
			{x: 0, y: 1}, // 5
			{x: -1, y: 1}, // 6
			{x: -1, y: 0} // 7
		];
		while (!noPathAvail && (currentX !== endTileCoords.xPos || currentY !== endTileCoords.yPos)) {
			let xDelta = endTileCoords.xPos - currentX;
			let yDelta = endTileCoords.yPos - currentY;
			const rating = Math.abs(xDelta) + Math.abs(yDelta);
			const initialXmod = xDelta < 0 ? -1 : xDelta > 0 ? 1 : 0;
			const initialYmod = yDelta < 0 ? -1 : yDelta > 0 ? 1 : 0;
			// find index in modifierPairs for which x,y values match initial x,y mods
			const modifiersIndex = modifierPairs.findIndex(pair => pair.x === initialXmod && pair.y === initialYmod);
			// setting up indexes for modifierPairs to provide mods (coordsToCheck) for 6 other directions besides directly toward destination - opposite direction is not included
			// with those other directions ordered from nearest to farthest from mod going directly toward destination
			const secondaryMods = {
				2: modifiersIndex === 0 ? 7 : modifiersIndex - 1,
				3: modifiersIndex === 7 ? 0 : modifiersIndex + 1,
				4: modifiersIndex === 0 ? 6 : modifiersIndex === 1 ? 7 : modifiersIndex - 2,
				5: modifiersIndex === 7 ? 1 : modifiersIndex === 6 ? 0 : modifiersIndex + 2,
				6: modifiersIndex === 0 ? 5 : modifiersIndex === 1 ? 6 : modifiersIndex === 2 ? 7 : modifiersIndex - 3,
				7: modifiersIndex === 7 ? 2 : modifiersIndex === 6 ? 1 : modifiersIndex === 5 ? 0 : modifiersIndex + 3
				// 8: modifiersIndex === 7 ? 3 : modifiersIndex === 6 ? 2 : modifiersIndex === 5 ? 1 : modifiersIndex === 4 ? 0 : modifiersIndex + 4
			};
			const coordsToCheck = [
				{xPos: currentX + initialXmod, yPos: currentY + initialYmod},
				{xPos: currentX + modifierPairs[secondaryMods[2]].x, yPos: currentY + modifierPairs[secondaryMods[2]].y},
				{xPos: currentX + modifierPairs[secondaryMods[3]].x, yPos: currentY + modifierPairs[secondaryMods[3]].y},
				{xPos: currentX + modifierPairs[secondaryMods[4]].x, yPos: currentY + modifierPairs[secondaryMods[4]].y},
				{xPos: currentX + modifierPairs[secondaryMods[5]].x, yPos: currentY + modifierPairs[secondaryMods[5]].y},
				{xPos: currentX + modifierPairs[secondaryMods[6]].x, yPos: currentY + modifierPairs[secondaryMods[6]].y},
				{xPos: currentX + modifierPairs[secondaryMods[7]].x, yPos: currentY + modifierPairs[secondaryMods[7]].y}
				// {xPos: currentX + modifierPairs[secondaryMods[8]].x, yPos: currentY + modifierPairs[secondaryMods[8]].y}
			];
			let tileIndex = 0;
			let newPos = null;
			let newCoords = {};
			let backwardMoves = 0;
			// loop through coordsToCheck to find first one that's not blocked
			while (tileIndex < coordsToCheck.length && !newPos) {
				startingPos = `${currentX}-${currentY}`;
				newCoords = coordsToCheck[tileIndex];
				newPos = convertCoordsToPos(newCoords);
				// should never revisit checked tile (except through backtracking 12 lines below)
				if (checkedTiles[newPos] || !checkForCleanPath(startingPos, newCoords, rating)) {
					newPos = null;
					// on first blockage, figure out which of the next two options is better (shorter path and not blocked)
					if (tileIndex === 0) {
						const distance1 = getDistanceBetweenTargets(endTileCoords, coordsToCheck[tileIndex + 1]);
						const distance2 = getDistanceBetweenTargets(endTileCoords, coordsToCheck[tileIndex + 2]);
						const option1isClear = !isTileBlocked(convertCoordsToPos(coordsToCheck[tileIndex + 1]));
						const option2isClear = !isTileBlocked(convertCoordsToPos(coordsToCheck[tileIndex + 2]));
						tileIndex = (distance1 <= distance2 && option1isClear) || (distance1 > distance2 && !option2isClear) ? 1 : 2;
					} else {
						tileIndex++;
					}
				} else {
					currentX = newCoords.xPos;
					currentY = newCoords.yPos;
				}
			}
			// shouldn't need more than 2 backward moves
			if (newPos && backwardMoves < 3) {
				// if moving away from goal, add to backward moves count
				if (tileIndex >= 5) {
					backwardMoves++;
				}
				startingPos = newPos;
				tilePath.push(newPos);

				// closestDistanceToEnd is updated to equal currentDistanceToEnd (for newPos) in checkForCleanPath if currentDistanceToEnd is less
				if (currentDistanceToEnd <= closestDistanceToEnd) {
					pathData.tilePath = [...tilePath];
				}
			} else if (tilePath.length === 0) {
				noPathAvail = true;
			} else {
				// backtracking: if current startingPos is a dead end, then we didn't find a lower rated pos and need to back up
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
							const newCoords = convertPosToCoords(lowestRatedPos);
							currentX = newCoords.xPos;
							currentY = newCoords.yPos;
							i = -1;
						} else {
							// all tile's connections are 0
							pathCopy.pop();
							// if not back to the beginning of the path
							if (i > 0) {
								checkedTiles[tilePath[i-1]][tilePath[i]] = 0;
							} else {
								checkedTiles[convertCoordsToPos(startTileCoords)][tilePath[i]] = 0;
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

		if (pathData.tilePath[tilePath.length - 1] === endTilePos) {
			pathData.blocker = false;
		}

		return pathData;
	}

	/**
	 * Checks the most linear path from start to end for wall, closed door, or creature to see if path is blocked
	 * Used for ranged attacks, checking for threats, and for checking if party members are in LoS before starting Follow mode
	 * (doesn't check for PCs, as assumed that a PC in the way would duck or shooting PC would shoot around)
	 * @param startPos: string
	 * @param endPos: string
	 * @param checkForCreatures: boolean (whether or not to check for creature blocking path - true for ranged attacks, false for lighting checks and threat checks)
	 * @returns {boolean}
	 */
	isInLineOfSight = (startPos, endPos, checkForCreatures) => {
		const endingCoords = convertPosToCoords(endPos);
		const startingCoords = convertPosToCoords(startPos);
		const tileSizeMinusOne = this.tileSize - 1;
		const halfTileSize = this.tileSize / 2;
		const topLeftXPixelValue = startingCoords.xPos * this.tileSize;
		const topLeftYPixelValue = startingCoords.yPos * this.tileSize;
		// All corner coords and deltas are in pixel values, not tile values
		const startTilePoints = {
			center: {xPos: topLeftXPixelValue + halfTileSize, yPos: topLeftYPixelValue + halfTileSize},
			topLeft: {xPos: topLeftXPixelValue, yPos: topLeftYPixelValue},
			topRight: {xPos: topLeftXPixelValue + tileSizeMinusOne, yPos: topLeftYPixelValue},
			bottomLeft: {xPos: topLeftXPixelValue, yPos: topLeftYPixelValue + tileSizeMinusOne},
			bottomRight: {xPos: topLeftXPixelValue + tileSizeMinusOne, yPos: topLeftYPixelValue + tileSizeMinusOne}
		};
		const endTileCenterPoint = {
			xPos: (endingCoords.xPos * this.tileSize) + halfTileSize,
			yPos: (endingCoords.yPos * this.tileSize) + halfTileSize
		};
		const tilePointNames = ['center', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
		const xDelta = endTileCenterPoint.xPos - startTilePoints.center.xPos;
		const yDelta = endTileCenterPoint.yPos - startTilePoints.center.yPos;
		const absXDelta = Math.abs(xDelta);
		const absYDelta = Math.abs(yDelta);
		// longer refers to longer side (axis) of triangle made up of the two axes and the path/delta
		let longerAxis = absXDelta < absYDelta ? absYDelta : absXDelta;
		let longerAxisStartingPos = longerAxis === absYDelta ? 'yPos': 'xPos';
		let shorterAxisStartingPos = longerAxis === absYDelta ? 'xPos': 'yPos';
		let longerDelta = absYDelta >= absXDelta ? yDelta : xDelta;
		let shorterDelta = absYDelta < absXDelta ? yDelta : xDelta;
		const numChecks = longerAxis / this.tileSize; // check done at each tile to see if ray (delta) is blocked
		const longerAxisCheckLength = longerDelta < 0 ? -this.tileSize : this.tileSize;
		// subtract 1 so if shorterAxisNewPos would normally equal an integer (instead of decimal),
		// which would mean the position is right between two tiles
		// (which causes calculation to always move choice toward the positive, regardless of whether delta moves in neg or pos direction),
		// then the -1 will nudge the position to one side or the other (pos or neg)
		const shorterAxisCheckLength = shorterDelta === 0 ? 0 : (shorterDelta / numChecks) - 1;
		let numOfClearPaths = 5;
		let checkNum = 1;
		let clearPaths = {
			center: true,
			topLeft: true,
			topRight: true,
			bottomLeft: true,
			bottomRight: true
		}
		const minClearPaths = 2;
		// 'numChecks - 1' here because don't need to check the end tile, but still need full value for computing shorterAxisCheckLength
		while (numOfClearPaths >= minClearPaths && checkNum <= (numChecks - 1)) {
			tilePointNames.forEach(pointName => {
				if (clearPaths[pointName]) {
					// next 5 lines are to find the next tile along the ray (delta) that we need to check using _isCurrentTileBlocked
					const longerAxisNewPos = roundTowardZero((startTilePoints[pointName][longerAxisStartingPos] + (longerAxisCheckLength * checkNum)) / this.tileSize);
					// need to Math.floor shorter (which roundTowardZero does), as pos could be between tile coords (and round would shift coord to next tile)
					const shorterAxisNewPos = roundTowardZero((startTilePoints[pointName][shorterAxisStartingPos] + (shorterAxisCheckLength * checkNum)) / this.tileSize);
					const xPos = longerAxisStartingPos === 'xPos' ? longerAxisNewPos : shorterAxisNewPos;
					const yPos = shorterAxisStartingPos === 'yPos' ? shorterAxisNewPos : longerAxisNewPos;
					const newPos = `${xPos}-${yPos}`;

					//TODO: need to come up with a way to allow pc to have a clear path from around a corner
					if (this._isCurrentTileBlocked(newPos, checkForCreatures)) {
						numOfClearPaths--;
						clearPaths[pointName] = false;
					}
				}
			});
			checkNum++;
		}
		return numOfClearPaths >= minClearPaths;
	}

	/**
	 * Checks if position is blocked (the tile is a wall, a closed door, or has a creature on it (if check param is true))
	 * @param currentPos: string
	 * @param checkForCreature: boolean
	 * @returns {boolean}
	 */
	_isCurrentTileBlocked(currentPos, checkForCreature) {
		let allCreaturePos = [];
		if (checkForCreature) {
			allCreaturePos = this.props.getAllCharactersPos('creature', 'pos');
		}

		return (!this.state.mapLayout[currentPos] || (this.state.mapLayout[currentPos].type === 'door' && !this.state.mapLayout[currentPos].doorIsOpen)) ||
			this.state.mapLayout[currentPos].type === 'wall' || (checkForCreature && allCreaturePos.some(creature => creature.pos === currentPos));
	}

	/**
	 * Find tiles out to 'range' that have unblocked lines of sight(LOS) to the center
	 * Used for lighting and creature movement
	 * @param centerTilePos: string (position of player (ex. '1-2'))
	 * @param range: number (perception/light radius)
	 * @param checkForCreatures: boolean (whether to check for creatures blocking paths (used for creature movement))
	 * @returns object {
	 *  {
	 *      '1Away': {floors: {[tilePosString]: [range]}, walls: {[tilePosString]: [range]}},
	 *      '2Away': {floors: {[tilePosString]: [range]}, walls: {[tilePosString]: [range]}},
	 *      '3Away': {floors: {[tilePosString]: [range]}, walls: {[tilePosString]: [range]}},
	 *      etc
	 *  }
	 * }
	 * @private
	 */
	_unblockedPathsToNearbyTiles(centerTilePos, range, checkForCreatures = false) {
		const numToStr = [null, '1', '2', '3', '4', '5'];
		let lineOfSightTiles = {};
		let surroundingTiles = [];

		for (let i=1; i <= range; i++) {
			const distance = `${numToStr[i]}Away`;
			lineOfSightTiles[distance] = {floors: {}, walls: {}};
		}
		surroundingTiles = this._getAllSurroundingTilesToRange(centerTilePos, range);
		for (const [distance, positions] of Object.entries(surroundingTiles)) {
			positions.forEach(tilePos => {
				if (this.isInLineOfSight(centerTilePos, tilePos, checkForCreatures)) {
					const tileData = this.state.mapLayout[tilePos];
					// if a floor tile or open door
					if (tileData.type === 'floor' || (tileData.type === 'door' && tileData.doorIsOpen)) {
						lineOfSightTiles[distance].floors[tilePos] = [range];
					// else is a wall tile
					} else {
						lineOfSightTiles[distance].walls[tilePos] = [range];
					}
				}
			});
		}

		return lineOfSightTiles;
	}

	/**
	 * Find all tiles out to 'range' number of rings surrounding center
	 * Includes all tile types
	 * @param centerPos: string
	 * @param range: number
	 * @returns object:
	 *  {
	 *      '1Away': [tilePosStrings],
	 *      '2Away': [tilePosStrings],
	 *      '3Away': [tilePosStrings],
	 *      etc
	 *  }
	 * @private
	 */
	_getAllSurroundingTilesToRange(centerPos, range) {
		const numToStr = [null, '1Away', '2Away', '3Away', '4Away', '5Away'];
		let surroundingTiles = {};
		const centerCoords = convertPosToCoords(centerPos);
		for (let i=1; i <= range; i++) {
			const distance = numToStr[i];
			surroundingTiles[distance] = [];
			for (let x=-i; x <= i; x++) {
				for (let y=-i; y <= i; y++) {
					if (Math.abs(x) === i || Math.abs(y) === i) {
						const tilePos = `${centerCoords.xPos + x}-${centerCoords.yPos + y}`;
						if (tilePos !== centerPos && this.state.mapLayout[tilePos]) {
							surroundingTiles[distance].push(tilePos);
						}
					}
				}
			}
		}
		return surroundingTiles;
	}

	findNearestTileForSpawn = () => {
		const maxRangeToLook = 2;
		const surroundingTiles = this._getAllSurroundingTilesToRange(this.props.creatureSpawnInfo.pos, maxRangeToLook);
		const allCharsPos = this.props.getAllCharactersPos('all', 'pos');
		let allThingsPos = [];
		let freeTileFound = null;

		allCharsPos.forEach(posInfo => {
			allThingsPos.push(posInfo.pos);
		});
		for (const envObjInfo of Object.values(this.props.envObjects)) {
			allThingsPos.push(convertCoordsToPos(envObjInfo.coords));
		}
		let distance = 1;
		let posIndex = 0;
		while (!freeTileFound && distance <= maxRangeToLook) {
			let newPos = surroundingTiles[distance + 'Away'][posIndex];
			if (!allThingsPos.includes(newPos) && this.state.mapLayout[newPos].type === 'floor') {
				freeTileFound = newPos;
			} else {
				posIndex++;
				if (posIndex === surroundingTiles[distance + 'Away'].length) {
					distance++;
					posIndex = 0;
				}
			}
		}
		this.props.spawnCreature(freeTileFound);
	}

	/**
	 * Finds all visible/lit tiles within LOS of all PCs and/or other map lights
	 * @param allLightPos: array of objects ({id: string (pc ID), pos: string, (optional: range - used for map lights)}
	 * @returns object {combined floors/walls from _unblockedPathsToNearbyTiles for all PCs}
	 * @private
	 */
	_getLitSurroundingTiles(allLightPos) {
		let lineOfSightTiles = {};
		// get all floors/walls around each light source
		allLightPos.forEach(object => {
			const sourceRange = object.range ? object.range : this.props.playerCharacters[object.id].lightRange;
			const tempTiles = this._unblockedPathsToNearbyTiles(object.pos, sourceRange);
			for (const [distance, tiles] of Object.entries(tempTiles)) {
				if (!lineOfSightTiles[distance]) {
					lineOfSightTiles[distance] = {floors: tiles.floors, walls: tiles.walls};
				} else {
					for (const [tileType, positions] of Object.entries(tiles)) {
						for (const [pos, range] of Object.entries(positions)) {
							const tilePosRanges = lineOfSightTiles[distance][tileType][pos];
							if (!tilePosRanges) {
								lineOfSightTiles[distance][tileType][pos] = [...range];
							} else {
								lineOfSightTiles[distance][tileType][pos] = tilePosRanges.concat(range);
							}
						}
					}
				}
			}
		});
		return lineOfSightTiles;
	}

	/**
	 * Update threatLists in App, usually any time lighting is changed or monsters are added
	 * @param callback function
	 * @private
	 */
	_updateThreatLists(callback) {
		const playerPositions = this.props.getAllCharactersPos('player', 'pos');
		const creaturePositions = this.props.getAllCharactersPos('creature', 'pos');
		const threatLists = this._findChangesToNearbyThreats(playerPositions, creaturePositions);
		const updateThreats = () => {
			this.props.updateThreatList(threatLists.threatListToAdd, threatLists.threatListToRemove, callback, this.isInLineOfSight);
		};
		if (threatLists.threatListToAdd.length > 0) {
			this._checkForScriptedConversation(threatLists.threatListToAdd, updateThreats);
		} else if (threatLists.threatListToRemove.length > 0) {
			updateThreats();
		} else if (callback) {
			callback();
		}
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
		const tilesInView = this._getAllLitTiles();
		let threatLists = {
			threatListToAdd: [],
			threatListToRemove: [...this.props.threatList]
		};
		creaturePositions.forEach(creature => {
			if (tilesInView[creature.pos]) {
				if (!this.props.threatList.includes(creature.id)) {
					playerPositions.forEach(player => {
						if (!threatLists.threatListToAdd.includes(creature.id) && this.isInLineOfSight(player.pos, creature.pos, false)) {
							threatLists.threatListToAdd.push(creature.id);
						}
					});
				// any creatures that are in view, remove from the threatListToRemove (thus, don't remove from the App's threatList)
				} else if (threatLists.threatListToRemove.includes(creature.id)) {
					threatLists.threatListToRemove.splice(threatLists.threatListToRemove.indexOf(creature.id), 1);
				}
			}
		});
		return threatLists;
	}

	/**
	 * Collects all tile data for tiles that have any amount of light
	 * @param mapData: object (optional)
	 * @return {{}}
	 * @private
	 */
	_getAllLitTiles(mapData = this.state.mapLayout) {
		let litTiles = {};
		for (const [pos, tileData] of Object.entries(mapData)) {
			if (tileData.lightStrength > 0) {
				litTiles[pos] = tileData;
			}
		}
		return litTiles;
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
	 * Checks if active player char is within 1 tile of clicked object
	 * @param objCoords: object (xPos, yPos)
	 * @returns {boolean}
	 */
	isActivePlayerNearObject = (objCoords) => {
		const playerCoords = this.props.playerCharacters[this.props.activeCharacter].coords;
		return Math.abs(playerCoords.xPos - objCoords.xPos) <= 1 && Math.abs(playerCoords.yPos - objCoords.yPos) <= 1;
	}

	isActivePlayerNearWindowEdge() {
		const activePcEl = this.charRefs[this.props.activeCharacter].current.getBoundingClientRect();
		return activePcEl.top < this.uiPadding || activePcEl.left < this.uiPadding || activePcEl.bottom > (window.innerHeight - this.uiPadding) || activePcEl.right > (window.innerWidth - this.uiPadding);
	}

	/**
	 * Not currently working - was going to be a replacement to using setTimeout, but animation speed was inconsistent
	 * @param callback function (next move function call)
	 */
	// slowMovementAnimation = (callback) => {
	// 	this.animFrameTimeLimit = 500;
	// 	this.animFrameCallback = () => {
	// 		this.animFrameStartTime = 0;
	// 		callback();
	// 	}
	// 	window.requestAnimationFrame(this.stepByAnimFrame);
	// }

	/**
	 * Determines if user's key/tap/click movement command is valid, and if so, updates coords for the active PC,
	 * then calls _moveMap to keep the active PC centered on screen,
	 * then if in combat, updates the threatList, and if not, calls moveCharacter again to move followers
	 * @param pathData: object ({
	 * 		tilePath: [] (of pos (String) - only used for leader/active pc),
	 * 		blocker: boolean or string (true/false or 'justBeforeEnd' if on 2nd to last tile in path and last tile is blocked)
	 * 	})
	 * @param newPos: String (optional - for moving followers)
	 * @param followerId: String (optional - ID of follower to move)
	 */
	moveCharacter = (pathData, newPos = null, followerId = null) => {
		const newTilePos = newPos || pathData.tilePath[0];
		if (this.props.inTacticalMode && this.props.actionsCompleted.moves >= this.props.playerLimits.moves) {
			this.props.setShowDialogProps(true, this.props.noMoreMovesDialogProps);
			return;
		}
		if (pathData.blocker && pathData.tilePath.length === 0 && !followerId) {
			if (pathData.blocker !== 'justBeforeEnd') {
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
			return;
		}
		if (!followerId && pathData.tilePath.length > 0) {
			pathData.tilePath.shift();
		}
		let newCoords = convertPosToCoords(newTilePos);
		let playerPositions = this.props.getAllCharactersPos('player', 'pos');
		const activePC = this.props.inTacticalMode || !followerId ? this.props.activeCharacter : followerId;
		let inFollowMode = !this.props.inTacticalMode && this.props.partyIsNearby;

		let followModePositions = inFollowMode ? [...this.props.followModePositions] : [];
		// only update followModePositions if we're moving the leader
		// newest pos at front, oldest pos at end of array
		if (inFollowMode && activePC === this.props.activeCharacter) {
			followModePositions.unshift(convertCoordsToPos(this.props.playerCharacters[activePC].coords));
			if (followModePositions.length === 3) {
				followModePositions.pop();
			}
		}

		// only search when the activeChar moves in tactical mode or the leader moves in follow mode
		// to try to avoid duplicate announcements for finding something (and improve performance a bit)
		// but _searchForHiddenSecrets could still get called a 2nd time before results of 1st time are set to state
		// todo: try to find a way to prevent _searchForHiddenSecrets from getting called again before its previous results are set to state
		if (this.props.inSearchMode && activePC === this.props.activeCharacter) {
			const foundTrap = this._searchForHiddenSecrets();
			if (foundTrap) return;
		}

		const activePlayerData = this.props.playerCharacters[activePC];
		let updateData = deepCopy(activePlayerData);
		updateData.coords = {...newCoords};

		// check if in darkness and in follow mode (for tactical mode, checked in componentDidUpdate), if so, reduce sanity
		const newPosLighting = this.state.mapLayout[newTilePos].lightStrength;
		if (newPosLighting === 0 && !this.props.inTacticalMode && !this.state.currentLocationData.floors[this.props.currentFloor].allTilesAtLeastAmbientLit) {
			updateData.currentSanity--;
		}

		// reduce light time remaining and range if time is really low
		let lightingHasChanged = false;
		if (activePlayerData.equippedLight && activePlayerData.lightTime > 0) {
			updateData.items = activePlayerData.items;
			const lightCost = this.props.inSearchMode ? this.props.lightTimeCosts.search : this.props.lightTimeCosts.move;
			const lightChanges = this.props.calcPcLightChanges(activePC, lightCost);
			updateData.items[activePlayerData.equippedLight] = {...lightChanges.equippedLightItem};
			updateData.lightTime = lightChanges.lightTime;
			updateData.lightRange = lightChanges.lightRange;
			lightingHasChanged = lightChanges.lightingHasChanged;
		}

		// check if pc moved onto trap that hasn't been disarmed or sprung, then trigger it if so
		let updatedEnvObjects = {};
		let trapSprung = false;
		const objIds = Object.keys(this.props.envObjects);
		let objCounter = 0;
		while (!trapSprung && objCounter < objIds.length) {
			const objId = objIds[objCounter];
			const objInfo = this.props.envObjects[objId];
			if (objInfo.type === 'trap' && !objInfo.isDestroyed && !objInfo.isSprung && newTilePos === convertCoordsToPos(objInfo.coords)) {
				updatedEnvObjects = deepCopy(this.props.envObjects);
				const damage = diceRoll(objInfo.damage.diceType) + objInfo.damage.modifier;
				updateData.currentHealth = damage > activePlayerData.currentHealth ? 0 : activePlayerData.currentHealth - damage;
				trapSprung = true;
				updatedEnvObjects[objId].isSprung = true;
				updatedEnvObjects[objId].isDiscovered = true;
				this.props.updateLog(`${activePlayerData.name.first} has triggered a ${objInfo.name} and taken damage!`);
				pathData.tilePath = [];
			}
			objCounter++;
		}
		this.props.updateCharacters('player', updateData, activePC, lightingHasChanged, false, false, () => {
			this._calculateLighting(() => {
				if (activePC === this.props.activeCharacter && this.isActivePlayerNearWindowEdge()) {
					this._moveMap();
				}
				if (pathData.tilePath.length === 0) {
					this._checkForExit();
				}
				if (trapSprung) {
					this.props.updateMapEnvObjects(updatedEnvObjects);
				}

				const updatePlayerMovesAndPartyStatus = () => {
					this.props.updateActivePlayerMoves();
					// if not in combat, check if party is nearby
					if (this.props.threatList.length === 0) {
						this.props.updateIfPartyIsNearby(this.isInLineOfSight);
					}
				};
				const activePlayerIndex = playerPositions.findIndex(element => element.id === activePC);
				playerPositions[activePlayerIndex].pos = newTilePos;
				let threatLists = {threatListToAdd: [], threatListToRemove: []};
				const checkForThreats = () => {
					// Find any creatures in range that could be a threat
					const creaturePositions = this.props.getAllCharactersPos('creature', 'pos');
					if (creaturePositions.length > 0) {
						threatLists = this._findChangesToNearbyThreats(playerPositions, creaturePositions);
					}
					const updateThreats = () => {
						this.props.updateThreatList(threatLists.threatListToAdd, threatLists.threatListToRemove, null, this.isInLineOfSight);
					};
					if (threatLists.threatListToAdd.length > 0) {
						this._checkForScriptedConversation(threatLists.threatListToAdd, updateThreats);
					} else if (threatLists.threatListToRemove.length > 0) {
						updateThreats();
					}
				};
				this.props.updateFollowModePositions(followModePositions, () => {
					// If either in combat or not in combat but party not nearby
					if (this.props.inTacticalMode) {
						checkForThreats();
						updatePlayerMovesAndPartyStatus();
					// can do follow mode as long as not in tactical mode either from before most recent move or after
					} else {
						// this.slowMovementAnimation(() => { // <- function not working well

						// TODO: find temp path using pathAtoB to get follower to pos behind leader in order to prevent followers jumping tiles

						// if leader has moved, there is at least 1 follower, and pc just moved was the leader,
						// then call moveCharacter to update first follower to next avail pos in followModePositions array
						if (this.props.followModePositions.length >= 1 && this.props.playerFollowOrder.length >= 2 && !followerId) {
							// to force characters to move one space at a time
							setTimeout(() => {
								this.moveCharacter(pathData, this.props.followModePositions[0], this.props.playerFollowOrder[1]);
							}, this.state.shortMovementDelay);

						// if leader has moved 2x, there are 2 followers, and 1st follower was just moved,
						// then call moveCharacter to update second follower to next avail pos in followModePositions array
						} else if (this.props.followModePositions.length >= 2 && this.props.playerFollowOrder.length === 3 && followerId === this.props.playerFollowOrder[1]) {
							// to force characters to move one space at a time
							setTimeout(() => {
								this.moveCharacter(pathData, this.props.followModePositions[1], this.props.playerFollowOrder[2]);
							}, this.state.shortMovementDelay);
						// otherwise, moving to next tile in path or alert user to blocker
						} else if (pathData.tilePath.length > 0 || pathData.blocker) {
							checkForThreats();
							if (threatLists.threatListToAdd.length === 0) {
								// to force characters to move one space at a time
								setTimeout(() => {
									this.moveCharacter(pathData);
								}, this.state.leaderMovementDelay);
							}
						} else {
							checkForThreats();
						}
						// }); // <- block end for slowMovementAnimation
					}
				});
			});
		});
	}

	/**
	 * Checks all hidden objects and env objects on lit tiles within sight of pcs to see if they're found by the pcs
	 * Then sets to state it's discovered in respective collection
	 * @return {boolean} (if a found object is a trap)
	 * @private
	 */
	_searchForHiddenSecrets() {
		let allPcLightPos = this.props.getAllCharactersPos('player', 'pos');
		allPcLightPos = this._getActiveLightRanges(allPcLightPos);
		const litTilesAroundPcs = this._getLitSurroundingTiles(allPcLightPos);
		const envObjects = deepCopy(this.props.envObjects);
		const mapLayout = deepCopy(this.state.mapLayout);
		const keenInvestSkill = this.props.playerCharacters.privateEye ? this.props.playerCharacters.privateEye.skills.keenInvestigation : null;
		let keenInvestBonus = keenInvestSkill ? keenInvestSkill.modifier[keenInvestSkill.level] : 0;
		let hiddenSecrets = {};
		let mapObjFound = false;
		let envObjFound = '';

		for (const [objId, objInfo] of Object.entries(envObjects)) {
			if (!objInfo.isDiscovered) {
				hiddenSecrets[convertCoordsToPos(objInfo.coords)] = {objId, baseChanceOfFinding: objInfo.baseChanceOfFinding};
			}
		}

		for (const [tilePos, tileInfo] of Object.entries(mapLayout)) {
			if (tileInfo.isSecretDoor && !tileInfo.isDiscovered) {
				hiddenSecrets[tilePos] = {tilePos, baseChanceOfFinding: tileInfo.baseChanceOfFinding};
			}
		}

		for (const floorsAndWalls of Object.values(litTilesAroundPcs)) {
			for (const positions of Object.values(floorsAndWalls)) {
				for (const litTilePos of Object.keys(positions)) {
					const tileLightStrength = this.state.mapLayout[litTilePos].lightStrength;
					const hiddenSecretInfo = hiddenSecrets[litTilePos];
					if (hiddenSecretInfo) {
						// determine if found
						// tileLightStrength has a range of 0 to this.maxLightStrength
						keenInvestBonus = tileLightStrength === 0 ? 0 : keenInvestBonus;
						const chanceOfFinding = (tileLightStrength * hiddenSecretInfo.baseChanceOfFinding) + keenInvestBonus;
						const secretFound = diceRoll(100) <= (chanceOfFinding * 100);
						if (secretFound) {
							if (hiddenSecretInfo.objId) {
								const foundObj = envObjects[hiddenSecretInfo.objId];
								foundObj.isDiscovered = true;
								envObjFound = foundObj.type;
								this.props.updateLog(`The investigators found a ${foundObj.name}!`);
							} else {
								mapLayout[hiddenSecretInfo.tilePos].isDiscovered = true;
								mapObjFound = true;
								this.props.updateLog('The investigators found a secret door!');
							}
						}
					}
				}
			}
		}
		if (envObjFound) {
			this.props.updateMapEnvObjects(envObjects);
		}
		if (mapObjFound) {
			this.setState({mapLayout});
		}
		return envObjFound === 'trap';
	}

	/**
	 * Used to determine if player/creature can move to specified tile (ie. not already occupied, not wall, not closed door)
	 * @param tileCoords: Object
	 * @returns {boolean}
	 * @private
	 */
	_tileIsFreeToMove(tileCoords) {
		let tileIsAvail = true;
		const tilePos = convertCoordsToPos(tileCoords);
		const tile = this.state.mapLayout[tilePos];
		const allCharPos = [...this.props.getAllCharactersPos('all', 'pos')];
		let envObjectsPos = {};

		for (const objData of Object.values(this.props.envObjects)) {
			const objPos = convertCoordsToPos(objData.coords);
			envObjectsPos[objPos] = objData.isPassable;
		}

		let i = 0;
		// if no tile, tile is a wall, tile has impassable object, or tile is a door and door is closed, then tile is unavailable
		if (!tile || tile.type === 'wall' || (envObjectsPos[tilePos] !== undefined && envObjectsPos[tilePos] === false) || (tile.type === 'door' && !tile.doorIsOpen)) {
			tileIsAvail = false;
		} else {
			while (tileIsAvail && i < allCharPos.length) {
				if (allCharPos[i].pos === tilePos) {
					tileIsAvail = false;
				}
				i++;
			}
		}
		return tileIsAvail;
	}

	/**
	 * Finds tile for char to move to that is either toward (directionModifier = 1) a target
	 * or away from (directionModifier = -1) all targets of a type (PC or creature)
	 * If no options available, returns char's current coords
	 * @param currentCharCoords: Object
	 * @param directionModifier: Integer (1 or -1)
	 * @param targetType: String ('player' or 'creature' - type that char is moving toward/away from)
	 * @param targetPos: String (optional - pos of target to move toward - only passed in if directionModifier === 1)
	 * @returns {{yPos, xPos}}
	 * @private
	 */
	_findNewCoordsRelativeToChar(currentCharCoords, directionModifier, targetType, targetPos = null) {
		const calcModifiers = (xValue, yValue, xComparison, yComparison)=> {
			let mods = {};
			if (xValue < xComparison) {
				mods = yValue < yComparison ? {option0: {x: -1, y: -1}, option1: {x: -1, y: 0}, option2: {x: 0, y: -1}, option3: {x: -1, y: 1}, option4: {x: 1, y: -1}, option5: {x: 1, y: 0}, option6: {x: 0, y: 1}} :
					yValue === yComparison ? {option0: {x: -1, y: 0}, option1: {x: -1, y: 1}, option2: {x: -1, y: -1}, option3: {x: 0, y: 1}, option4: {x: 0, y: -1}, option5: {x: 1, y: -1}, option6: {x: 1, y: 1}} :
					{option0: {x: -1, y: 1}, option1: {x: -1, y: 0}, option2: {x: 0, y: 1}, option3: {x: -1, y: -1}, option4: {x: 1, y: 1}, option5: {x: 0, y: -1}, option6: {x: 1, y: 0}};
			} else if (xValue === xComparison) {
				mods = yValue < yComparison ? {option0: {x: 0, y: -1}, option1: {x: -1, y: -1}, option2: {x: 1, y: -1}, option3: {x: -1, y: 0}, option4: {x: 1, y: 0}, option5: {x: -1, y: 1}, option6: {x: 1, y: 1}} :
					{option0: {x: 0, y: 1}, option1: {x: -1, y: 1}, option2: {x: 1, y: 1}, option3: {x: -1, y: 0}, option4: {x: 1, y: 0}, option5: {x: -1, y: -1}, option6: {x: 1, y: -1}};
			} else {
				mods = yValue < yComparison ? {option0: {x: 1, y: -1}, option1: {x: 0, y: -1}, option2: {x: 1, y: 0}, option3: {x: -1, y: -1}, option4: {x: 1, y: 1}, option5: {x: -1, y: 0}, option6: {x: 0, y: 1}} :
					yValue === yComparison ? {option0: {x: 1, y: 0}, option1: {x: 1, y: -1}, option2: {x: 1, y: 1}, option3: {x: 0, y: -1}, option4: {x: 0, y: 1}, option5: {x: -1, y: -1}, option6: {x: -1, y: 1}} :
					{option0: {x: 1, y: 1}, option1: {x: 1, y: 0}, option2: {x: 0, y: 1}, option3: {x: 1, y: -1}, option4: {x: -1, y: 1}, option5: {x: 0, y: -1}, option6: {x: -1, y: 0}};
			}
			return mods;
		};
		let newCharCoords = {xPos: currentCharCoords.xPos, yPos: currentCharCoords.yPos};
		let modifiers = {};

		// move toward target PC
		if (directionModifier === 1) {
			const targetCoords = convertPosToCoords(targetPos);
			const newDistX = targetCoords.xPos - currentCharCoords.xPos;
			const newDistY = targetCoords.yPos - currentCharCoords.yPos;
			modifiers = calcModifiers(newDistX, newDistY, 0, 0);

		// move away from all targets of type targetType
		} else {
			//todo: for creature running away, should only look at pcs that are in sight (currently looking at all)
			const allCharsCoords = targetType === 'player' ? this.props.getAllCharactersPos('player', 'coords').map(info => info.coords) : this.props.threatList.map(id => this.props.mapCreatures[id].coords);
			let avgXCoord = 0;
			let avgYCoord = 0;
			let numPCs = allCharsCoords.length;
			allCharsCoords.forEach(char => {
				avgXCoord += char.xPos;
				avgYCoord += char.yPos;
			});
			avgXCoord = avgXCoord / numPCs;
			avgYCoord = avgYCoord / numPCs;
			modifiers = calcModifiers(currentCharCoords.xPos, currentCharCoords.yPos, avgXCoord, avgYCoord);
		}

		let optionNum = 0
		let tileIsFree = false;
		let newX = 0;
		let newY = 0;
		// for moving toward target, look at all 7 options, if moving away, only look at first 5 options
		while (!tileIsFree && ((directionModifier === 1 && optionNum < 7) || (directionModifier === -1 && optionNum < 5))) {
			newX = currentCharCoords.xPos + modifiers['option' + optionNum].x;
			newY = currentCharCoords.yPos + modifiers['option' + optionNum].y;
			if (this._tileIsFreeToMove({xPos: newX, yPos: newY})) {
				tileIsFree = true;
				newCharCoords.xPos = newX;
				newCharCoords.yPos = newY;
			} else {
				optionNum++;
			}
		}

		return newCharCoords;
	}

	/**
	 * Saves to state (in App using props.updateCharacters) new coords for a char, then either recursively calls again to save next coords in array
	 * or updates char data in App (which then calls callback if there is one)
	 * @param charID: String
	 * @param newCoords: Array (of coord objects representing each of a char's moves)
	 * @param callback: Function (generally either updating current turn or doing creature attack and then updating turn)
	 * @private
	 */
	_storeNewCharCoords(charID, newCoords, callback) {
		const charType = this.props.playerCharacters[charID] ? 'player' : 'creature';
		let newCoordsArray = newCoords;
		const nextCoords = newCoordsArray.shift();
		const lightingChanged = charType === 'player';
		const charData = charType === 'creature' ? deepCopy(this.props.mapCreatures[charID]) : deepCopy(this.props.playerCharacters[charID]);
		charData.coords = nextCoords;

		this.props.updateCharacters(charType, charData, charID, lightingChanged, false, false, () => {
			if (charType === 'player') {
				this.props.updateActivePlayerMoves(callback);
			}
			//TODO: will need to add _calculateLighting here if we add creature that changes lighting during movement
			setTimeout(() => {
				if (newCoordsArray.length > 0) {
					this._storeNewCharCoords(charID, newCoordsArray, callback);
				} else if (callback) {
					callback();
				}
			}, this.creatureMovementDelay);
		});
	}

	/**
	 * Used by moveCreature to check for a skill to use instead of attacking
	 * @param creatureData: object
	 * @param targetStatuses: object (statuses of target pc)
	 * @param skillProps: object (defined in moveCreature and updated directly (not passed back))
	 * @param targetPlayerDistance: number (number of tiles target pc is away from creature)
	 * @return creatureSkillToUse string
	 * @private
	 */
	_checkForUsableSkill(creatureData, targetStatuses, skillProps, targetPlayerDistance) {
		// if creature has skills, if skill priority list exists, check list in order, otherwise just check single skill
		// if skill applies a status and target doesn't already have that status and if enough spirit, use that skill
		// else if enough spirit, use skill
		let creatureSkillToUse = null;
		let creatureSkillNameToCheck = '';
		let creatureSkillToCheck = {};
		const numOfSkills = creatureData.skillPriority.length;

		const checkIfSkillCanBeUsed = () => {
			creatureSkillToCheck = creatureData.skills[creatureSkillNameToCheck];
			const hasEnoughSpirit = creatureData.currentSpirit >= creatureSkillToCheck.spirit;
			const targetInRange = creatureSkillToCheck.range && (creatureSkillToCheck.targetSelf || targetPlayerDistance <= creatureSkillToCheck.range);
			const targetDoesNotHaveStatus = creatureSkillToCheck.status && !targetStatuses[creatureSkillToCheck.status];

			if (hasEnoughSpirit && (targetInRange || !creatureSkillToCheck.range)) {
				if (!creatureSkillToCheck.status || (creatureSkillToCheck.targetSelf && !creatureData.statuses[creatureSkillToCheck.status])) {
					creatureSkillToUse = creatureSkillNameToCheck;
					if (creatureSkillToCheck.multipleTargets) {
						skillProps.pcData = {};
						const pcPositions = this.props.getAllCharactersPos('player', 'coords');
						pcPositions.forEach(coordData => {
							const distance = getDistanceBetweenTargets(coordData.coords, creatureData.coords);
							// if skill has a range and pc is within range or no range but pc is within creature perception range
							// and if skill targets all targets in range or limited number of targets but haven't reached that number of targets yet
							if (((creatureSkillToCheck.range && distance <= creatureSkillToCheck.range) || distance <= creatureData.perception) &&
								(creatureSkillToCheck.multipleTargets === 'all' || Object.keys(skillProps.pcData).length <= creatureSkillToCheck.multipleTargets))
							{
								skillProps.pcData[coordData.id] = deepCopy(this.props.playerCharacters[coordData.id]);
							}
						});
					}
				} else if (targetDoesNotHaveStatus && !creatureSkillToCheck.targetSelf) {
					creatureSkillToUse = 'attemptToApplyStatus';
					skillProps.skillName = creatureSkillNameToCheck;
				}
			}
		}
		let skillNum = 0;
		while (!creatureSkillToUse && skillNum < numOfSkills) {
			creatureSkillNameToCheck = creatureData.skillPriority[skillNum];
			checkIfSkillCanBeUsed(creatureSkillNameToCheck);
			skillNum++;
		}
		return creatureSkillToUse;
	}

	/**
	 * Reduce pc's sanity from being in total darkness (called from componentDidUpdate)
	 * @private
	 */
	_updateSanityForDarkness() {
		const activePcData = deepCopy(this.props.playerCharacters[this.props.activeCharacter]);
		activePcData.currentSanity--;
		this.props.updateCharacters('player', activePcData, this.props.activeCharacter, false, false, false);
	}

	/**
	 * AI for creature behavior
	 * Basically a creature with a PC in view will either move toward it and/or attack it if in range
	 * or move away from it if its HP is below a threshold (set by this.creatureSurvivalHpPercent)
	 * @private
	 */
	_moveCreature() {
		const creatureID = this.props.activeCharacter;
		const creatureData = deepCopy(this.props.mapCreatures[creatureID]);
		let creatureDidAct = false;

		if (creatureData.currentHealth > 0) {
			let creatureCoords = creatureData.coords;
			const creaturePos = convertCoordsToPos(creatureCoords);
			const lineOfSightTiles = this._unblockedPathsToNearbyTiles(creaturePos, creatureData.perception, false);
			const tilesToSearch = Object.values(lineOfSightTiles);
			if (tilesToSearch.length === 0) {
				return;
			}

			let newCreatureCoordsArray = [];
			let playerPos = '';
			let targetPlayerPos = '';
			let targetPlayerDistance = null;
			let targetPlayerData = {};
			let needToRecopyData = true;
			const updateSpiritAndCurrentTurn = () => {
				// need new copy of data if creature used skill or moved (but not if only attacked)
				const updatedCreatureData = needToRecopyData ? deepCopy(this.props.mapCreatures[creatureID]) : creatureData;
				if (updatedCreatureData.currentSpirit < updatedCreatureData.startingSpirit) {
					const regeneratedSpirit = updatedCreatureData.currentSpirit + updatedCreatureData.spiritRegeneration;
					updatedCreatureData.currentSpirit = regeneratedSpirit > updatedCreatureData.startingSpirit ? updatedCreatureData.startingSpirit : regeneratedSpirit;
					this.props.updateCharacters('creature', updatedCreatureData, creatureID, false, false, false, this.props.updateCurrentTurn);
				} else {
					this.props.updateCurrentTurn();
				}
			};

			// find closest player within creature's perception for creature to focus on
			for (const playerData of Object.values(this.props.playerCharacters)) {
				//todo: save unconscious target as a backup in case another target isn't available
				if (playerData.currentHealth > 0 && playerData.currentSanity > 0 && !playerData.statuses.unconscious) {
					playerPos = convertCoordsToPos(playerData.coords);
					let playerDistance = 0;
					let searchDistance = 0;
					let tileAtSearchDistance = tilesToSearch[searchDistance];
					while (playerDistance === 0 && searchDistance < tilesToSearch.length) {
						// if searchDistance is within creature perception and a player is there, found a target
						if (creatureData.perception >= (searchDistance + 1) && tileAtSearchDistance.floors[playerPos]) {
							playerDistance = searchDistance + 1;
						}
						searchDistance++;
						tileAtSearchDistance = tilesToSearch[searchDistance];
					}

					// if this is first target found or target is closer than previous target, update target for focus
					if (playerDistance > 0 && (!targetPlayerDistance || playerDistance < targetPlayerDistance)) {
						targetPlayerDistance = playerDistance;
						targetPlayerPos = playerPos;
						targetPlayerData = playerData;
					}
				}
			}
			targetPlayerData = deepCopy(targetPlayerData);

			// if a nearby PC was found
			if (targetPlayerDistance) {
				creatureDidAct = true;
				let skillProps = {
					pcData: targetPlayerData,
					creatureData,
					updateCharacters: this.props.updateCharacters,
					updateLog: this.props.updateLog,
					toggleAudio: this.props.toggleAudio,
					updateTurnCallback: updateSpiritAndCurrentTurn,
				};
				let creatureSkillToUse = this._checkForUsableSkill(creatureData, targetPlayerData.statuses, skillProps, targetPlayerDistance);
				let creatureBestRange = creatureData.range;

				for (const skillData of Object.values(creatureData.skills)) {
					if (skillData.range && skillData.range > creatureData.range) {
						creatureBestRange = skillData.range;
					}
				}

				// if creature is low on health
				if (creatureData.currentHealth < (creatureData.startingHealth * this.creatureSurvivalHpPercent)) {
					const moveAfterActing = () => {
						// now move away from player after attacking/using skill
						// todo: if creature is flyingPolyp, try to use Phase skill
						this._runAway(creatureID, creatureCoords, creatureData.moveSpeed, 'player', updateSpiritAndCurrentTurn);
					}
					// if player char is within attack range, then use skill or attack
					if (targetPlayerDistance <= creatureBestRange) {
						if (creatureSkillToUse) {
							skillProps.updateTurnCallback = moveAfterActing;
							creatureData[creatureSkillToUse](skillProps);
						} else {
							creatureData.attack(targetPlayerData, this.props.updateCharacters, this.props.updateLog, this.props.toggleAudio, moveAfterActing);
						}
					} else {
						moveAfterActing();
					}
				// or if player is out of attack range, move closer
				} else if (targetPlayerDistance > creatureBestRange) {
					let moves = 1;
					while (moves <= creatureData.moveSpeed && targetPlayerDistance > creatureBestRange) {
						creatureCoords = this._findNewCoordsRelativeToChar(creatureCoords, 1, 'player', targetPlayerPos);
						newCreatureCoordsArray.push(creatureCoords);
						moves++;
						const xDistance = Math.abs(targetPlayerData.coords.xPos - creatureCoords.xPos);
						const yDistance = Math.abs(targetPlayerData.coords.yPos - creatureCoords.yPos);
						targetPlayerDistance = xDistance > yDistance ? xDistance : yDistance;
					}
					this._storeNewCharCoords(creatureID, newCreatureCoordsArray, () => {
						// if player char is within attack range, then use skill or attack
						if (targetPlayerDistance <= creatureBestRange) {
							if (creatureSkillToUse) {
								// need new copy as data changed (from move) since copying at beginning of moveCreature
								skillProps.creatureData = deepCopy(this.props.mapCreatures[creatureID]);
								creatureData[creatureSkillToUse](skillProps);
							} else {
								creatureData.attack(targetPlayerData, this.props.updateCharacters, this.props.updateLog, this.props.toggleAudio, () => {
									this._updateThreatLists(updateSpiritAndCurrentTurn);
								});
							}
						} else {
							this._updateThreatLists(updateSpiritAndCurrentTurn);
						}
					});
				// otherwise player is in attack range, so use skill or attack
				} else {
					if (creatureSkillToUse) {
						creatureData[creatureSkillToUse](skillProps);
					} else {
						// for use in updateSpiritAndCurrentTurn - don't need to recopy data just for an attack (only for skills or movement)
						needToRecopyData = false;
						creatureData.attack(targetPlayerData, this.props.updateCharacters, this.props.updateLog, this.props.toggleAudio, updateSpiritAndCurrentTurn);
					}
				}
			} else if (!creatureData.relatedMission) {
				creatureDidAct = true;
				this._moveRandomly();
				const playerPositions = this.props.getAllCharactersPos('player', 'pos');
				const creaturePositions = this.props.getAllCharactersPos('creature', 'pos');
				const threatLists = this._findChangesToNearbyThreats(playerPositions, creaturePositions);
				if (this.props.logText[this.props.logText.length -1] !== 'Something moves in the darkness...') {
					this.props.updateLog('Something moves in the darkness...');
				}
				if (threatLists.threatListToAdd.length > 0) {
					this.props.updateThreatList(threatLists.threatListToAdd, threatLists.threatListToRemove, this.props.updateCurrentTurn, null);
				} else {
					this.props.updateCurrentTurn();
				}
			}

			// For creatures that don't act, still need to advance turn
			if (!creatureDidAct) {
				this.props.updateCurrentTurn();
			}
		}
	}

	/**
	 * Automatically moves pc/creature char away from threats
	 * @param charId string
	 * @param charCoords object
	 * @param charMoveSpeed number
	 * @param targetType string ('player' or 'creature' - type that char is running from)
	 * @param callback function
	 * @private
	 */
	_runAway(charId, charCoords, charMoveSpeed, targetType, callback) {
		const charType = this.props.playerCharacters[charId] ? 'pc' : 'creature';
		const moves = charType === 'pc' ? charMoveSpeed - this.props.actionsCompleted.moves : charMoveSpeed;
		let newCoords = {...charCoords};
		let newCoordsArray = [];
		for (let i = 1; i <= moves; i++) {
			newCoords = this._findNewCoordsRelativeToChar(newCoords, -1, targetType);
			newCoordsArray.push(newCoords);
		}
		if (charType === 'pc') {
			this.props.updateLog(`${this.props.playerCharacters[charId].name.first} is panicking and running away!`);
		}
		this._storeNewCharCoords(charId, newCoordsArray, () => {
			this._updateThreatLists(callback);
		});
	}

	/**
	 * Moves a pc/creature in random direction
	 * (looking at all surrounding tiles, first choice to examine is random, then cycles through remaining options in order)
	 * @param callback function (either takeActionCallback passed from _randomizeTurn to call takeAction again if necessary
	 * or updateThreatAndCurrentTurn callback from moveCreature)
	 * @private
	 */
	_moveRandomly(callback = null) {
		const activeCharID = this.props.activeCharacter;
		const charData = this.props.mapCreatures[activeCharID] || this.props.playerCharacters[activeCharID];
		const characterCoords = charData.coords;
		let surroundingCoords = [
			{xPos: characterCoords.xPos + 1, yPos: characterCoords.yPos},
			{xPos: characterCoords.xPos - 1, yPos: characterCoords.yPos},
			{xPos: characterCoords.xPos + 1, yPos: characterCoords.yPos + 1},
			{xPos: characterCoords.xPos - 1, yPos: characterCoords.yPos + 1},
			{xPos: characterCoords.xPos + 1, yPos: characterCoords.yPos - 1},
			{xPos: characterCoords.xPos - 1, yPos: characterCoords.yPos - 1},
			{xPos: characterCoords.xPos + 1, yPos: characterCoords.yPos + 1},
			{xPos: characterCoords.xPos + 1, yPos: characterCoords.yPos - 1}
		];
		const numOptions = surroundingCoords.length;
		let randomIndex = Math.floor(Math.random() * numOptions);
		// check each surrounding tile; if not avail, set that tile to null in the array and look at the next one
		while (surroundingCoords[randomIndex] && !this._tileIsFreeToMove(surroundingCoords[randomIndex])) {
			surroundingCoords[randomIndex] = null;
			randomIndex = randomIndex === (numOptions - 1) ? 0 : randomIndex + 1;
		}
		// if tile with current randomIndex value isn't null, then it's available to move
		if (surroundingCoords[randomIndex]) {
			if (charData.type === 'player') {
				const updatedData = deepCopy(charData);
				updatedData.coords = {...surroundingCoords[randomIndex]};
				this.props.updateCharacters('player', updatedData, activeCharID, updatedData.lightTime > 0, false, false, () => {
					this.props.updateActivePlayerMoves(callback);
				});
			} else {
				const willPlaySound = charData.type !== 'player' && diceRoll(10) <= this.chanceForCreatureSound;
				if (willPlaySound) {
					this.props.toggleAudio('characters', removeIdNumber(activeCharID), {useVolume: true, useReverb: true, soundCoords: characterCoords});
				}
				this._storeNewCharCoords(activeCharID, [surroundingCoords[randomIndex]], callback);
			}
		} else if (callback) {
			callback();
		}
	}

	/**
	 * For making a pc take random actions and moves (for when it has a confused or other similar status)
	 * Options are to move, attack, or use a healing item
	 * @private
	 */
	_randomizeTurn() {
		let activePcData = this.props.playerCharacters[this.props.activeCharacter];
		const equippedItems = activePcData.equippedItems.loadout1;
		const leftHandWeapon = activePcData.weapons[equippedItems.left];
		const rightHandWeapon = activePcData.weapons[equippedItems.right];
		const chosenWeapon = leftHandWeapon && rightHandWeapon ? (diceRoll(2) === 1 ? equippedItems.right : equippedItems.left) : (leftHandWeapon ? equippedItems.left : equippedItems.right);
		let actionsRemaining = this.props.playerLimits.actions - this.props.actionsCompleted.actions;
		let movesRemaining = this.props.playerLimits.moves - this.props.actionsCompleted.moves;
		// options are 'move', {attack: chosenWeapon}, or {heal: healItem}
		let availableOptions = {};

		if (movesRemaining > 0) {
			availableOptions.move = true;
		}
		if (actionsRemaining > 0) {
			availableOptions.doNothing = null;
			if ((leftHandWeapon && (!leftHandWeapon.isRanged || leftHandWeapon.currentRounds > 0)) ||
				(rightHandWeapon && (!rightHandWeapon.isRanged || rightHandWeapon.currentRounds > 0)))
			{
				availableOptions.attack = chosenWeapon;
			}
		}

		const optionsKeys = Object.keys(availableOptions);
		const randomIndex = diceRoll(optionsKeys.length) - 1;
		const chosenActName = optionsKeys[randomIndex];
		const weaponId = availableOptions[chosenActName];
		const takeActionCallback = () => {
			actionsRemaining = this.props.playerLimits.actions - this.props.actionsCompleted.actions;
			movesRemaining = this.props.playerLimits.moves - this.props.actionsCompleted.moves;
			if ((actionsRemaining + movesRemaining) === 0) {
				this.props.updateCurrentTurn();
			} else {
				// allow pause to show pc animation
				setTimeout(() => {
					this._randomizeTurn();
				}, this.playerAutoTurnDelay);
			}
		};

		// do the first move/action (rest will be called recursively from within takeAction
		if (chosenActName === 'doNothing') {
			this.props.takeAutomaticAction(chosenActName, null, null, null, takeActionCallback);
		} else if (chosenActName !== 'move') {
			let target = null;
			// find target
			let nearbyChars = [];
			const allCharactersCoords = this.props.getAllCharactersPos('all', 'coords');
			// collect all PCs and creatures (that are threats) in LOS
			allCharactersCoords.forEach(nearbyChar => {
				if (nearbyChar.id !== this.props.activeCharacter) {
					const charIsPc = this.props.playerCharacters[nearbyChar.id];
					const charIsThreatCreature = this.props.threatList.includes(nearbyChar.id);
					const nearbyCharPos = convertCoordsToPos(charIsPc ? charIsPc.coords : nearbyChar.coords);
					if ((charIsPc || charIsThreatCreature) && this.isInLineOfSight(convertCoordsToPos(activePcData.coords), nearbyCharPos, true)) {
						const distanceToChar = getDistanceBetweenTargets(activePcData.coords, convertPosToCoords(nearbyCharPos));
						const nearbyCharData = charIsPc || this.props.mapCreatures[nearbyChar.id];
						nearbyChars.push({distance: distanceToChar, nearbyCharData});
					}
				}
			});
			if (nearbyChars.length > 0) {
				// sort collection based on distance keys
				nearbyChars.sort((char1, char2) => char1.distance - char2.distance);
				const weaponIsRanged = activePcData.weapons[chosenWeapon].ranged;
				let i = 0;
				// assign nearest target that can be hit by equipped weapon
				while (!target && i < nearbyChars.length) {
					if (weaponIsRanged || (!weaponIsRanged && nearbyChars[i].distance === 1)) {
						target = deepCopy(nearbyChars[i].nearbyCharData);
					}
					i++;
				}
			}
			this.props.takeAutomaticAction(chosenActName, weaponId, target, this.isInLineOfSight, takeActionCallback);
		} else {
			this.props.updateLog(`Confused, ${activePcData.name.first} wanders aimlessly.`);
			this._moveRandomly(takeActionCallback);
		}
	}


	/**
	 * For moving world element to put active character in center of screen
	 * @param initialSetupCallback: function
	 * @private
	 */
	_moveMap(initialSetupCallback) {
		this.clickedOnWorld = false;
		this.isDraggingWorld = false;
		const screenData = this.props.screenData;
		const screenZoom = this.props.gameOptions.screenZoom;
		const halfCharIconSize = Math.round((this.tileSize * screenZoom) / 2);
		const activePc = this.props.playerCharacters[this.props.activeCharacter] || this.props.playerCharacters[this.props.playerFollowOrder[0]];
		const pcCoords = activePc.coords;
		const mapViewXcenter = this.props.screenData.isShort ? Math.round((screenData.width - this.props.objectPanelWidth) / 2) + this.props.objectPanelWidth : Math.round(screenData.width / 2);
		this.worldTransform.x = Math.round(-pcCoords.xPos * this.tileSize * screenZoom) + mapViewXcenter - halfCharIconSize;
		this.worldTransform.y = Math.round(-pcCoords.yPos * this.tileSize * screenZoom) + Math.round(screenData.height / 2) - halfCharIconSize;
		this.worldRef.current.style.transform = `translate(${this.worldTransform.x}px, ${this.worldTransform.y}px) scale(${screenZoom})`;

		if (initialSetupCallback) {
			setTimeout(() => {
				this.setState({mapMoved: true}, initialSetupCallback);
			}, 1000);
		}
	}

	/**
	 * Toggles door opens/closed (and plays the sound effect for it)
	 * @param doorTilePos: string
	 */
	toggleDoor = (doorTilePos) => {
		this.props.toggleAudio('environments', this.props.currentLocation + 'Door', {useReverb: true});
		this.setState(prevState => ({
			mapLayout: {
				...prevState.mapLayout,
				[doorTilePos]: {
					...prevState.mapLayout[doorTilePos],
					doorIsOpen: !prevState.mapLayout[doorTilePos].doorIsOpen
				}
			}
		}), () => {
			this._calculateLighting(() => {
				const playerPositions = this.props.getAllCharactersPos('player', 'pos');
				const creaturePositions = this.props.getAllCharactersPos('creature', 'pos');
				let threatLists = {threatListToAdd: [], threatListToRemove: []};
				if (creaturePositions.length > 0) {
					threatLists = this._findChangesToNearbyThreats(playerPositions, creaturePositions);
				}
				const doorNowOpen = this.state.mapLayout[doorTilePos].doorIsOpen;
				const updateThreats = () => {
					this.props.updateThreatList(threatLists.threatListToAdd, threatLists.threatListToRemove, null, this.isInLineOfSight);
				};
				if (threatLists.threatListToAdd.length > 0) {
					this._checkForScriptedConversation(threatLists.threatListToAdd, updateThreats);
				} else if (threatLists.threatListToRemove.length > 0) {
					updateThreats();
				} else if ((doorNowOpen && !this.props.partyIsNearby) || (!doorNowOpen && this.props.partyIsNearby)) {
					this.props.updateIfPartyIsNearby(this.isInLineOfSight, () => {
						if (!this.props.partyIsNearby && !this.props.inTacticalMode) {
							this.props.toggleTacticalMode(true);
						}
					});
				}
			});
		});
	}

	dragWorld = (evt, previousEvt) => {
		if (this.clickedOnWorld) {
			if (this.contextMenuOpen) {
				this.contextMenuOpen = false;
				this.props.updateContextMenu(null);
			}
			const screenData = this.props.screenData;
			const edgeBuffer = 100;
			let mapLeftEdge = screenData.isShort ? this.props.objectPanelWidth : 0;

			const movementX = evt.clientX - previousEvt.clientX;
			const movementY = evt.clientY - previousEvt.clientY;
			const worldEdges = this.worldRef.current.getBoundingClientRect();
			// already dragged world as far left as it can go (right edge is at right edge of screen)
			const atLeftLimit = worldEdges.right <= (screenData.width - edgeBuffer) && movementX < 0;
			// already dragged world as far right as it can go (left edge is at left edge of screen)
			const atRightLimit = worldEdges.left >= (mapLeftEdge + edgeBuffer) && movementX > 0;
			// already dragged world as far up as it can go (bottom edge is at bottom edge of screen)
			const atTopLimit = worldEdges.bottom <= (screenData.height - edgeBuffer) && movementY < 0;
			// already dragged world as far down as it can go (top edge is at top edge of screen)
			const atBottomLimit = worldEdges.top >= edgeBuffer && movementY > 0;

			// to prevent isDraggingWorld from being set just from clicking without dragging (but possibly slight movement by accident)
			if (movementX > 1 || movementY > 1) {
				this.isDraggingWorld = true;
			}
			this.worldTransform.x += atLeftLimit || atRightLimit ? 0 : movementX;
			this.worldTransform.y += atTopLimit || atBottomLimit ? 0 : movementY;
			this.worldRef.current.style.transform = `translate(${this.worldTransform.x}px, ${this.worldTransform.y}px) scale(${this.props.gameOptions.screenZoom})`;
		}
	}

	endDragging = () => {
		this.clickedOnWorld = false;
		// need slight pause so if pointerup event is picked up by handler for objects/characters/tiles
		this.animFrameTimeLimit = 2;
		this.animFrameCallback = () => {
			this.isDraggingWorld = false;
			this.animFrameTimeLimit = 0;
			this.animFrameStartTime = 0;
		}
		window.requestAnimationFrame(this.stepByAnimFrame);
	}

	/**
	 * Intercepting handler to ensure click is valid and not a result from 'pointerUp' handling from dragging
	 * @param actionType
	 * @param tilePos
	 * @param evt
	 * @param actionInfo
	 */
	checkForDragging = (actionType, tilePos, evt, actionInfo) => {
		if (!this.isDraggingWorld) {
			if (this.contextMenuOpen) {
				this.contextMenuOpen = false;
				this.props.updateContextMenu(null);
			} else {
				const contextMenuNeeded = this.props.isContextMenuNeeded(actionType, tilePos, evt, actionInfo);
				if (contextMenuNeeded.menuNeeded) {
					this.contextMenuOpen = true;
				}
				this.props.updateContextMenu(actionType, tilePos, evt, actionInfo, contextMenuNeeded);
			}
		}
	}

	stepByAnimFrame = (timestamp) => {
		if (this.animFrameStartTime === 0) {
			this.animFrameStartTime = timestamp;
		}
		const timeElapsed = timestamp - this.animFrameStartTime;
		if (timeElapsed < this.animFrameTimeLimit) {
			window.requestAnimationFrame(this.stepByAnimFrame);
		} else {
			this.animFrameCallback();
		}
	}


	/***********************
	 * ELEMENTS AND EVENTS
	 ***********************/

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
		// Map doesn't remount when changing location/floor
		// Need this check to prevent running twice, as StrictMode causes components to mount twice
		if (!this.componentMounted) {
			const setupMap = () => {
				this.layoutPieces();

				// note: this won't play until user interacts with page
				// (which will happen with prod version but not testing if login and char creation are skipped)
				this.props.toggleAudio('environments', this.props.currentLocation + 'Background', null, 'start');
				this.props.toggleMusic('environments', this.props.currentLocation, 'start');
			}

			if (this.props.savedMaps[this.props.currentLocation] && this.props.savedMaps[this.props.currentLocation].floors[this.props.currentFloor]) {
				this.setState({usingSavedMapData: true}, setupMap);
			} else if (this.state.currentLocationData.floors[this.props.currentFloor].isRandom) {
				setupMap();
			} else {
				this._loadStaticMap().then(() => {
					setupMap();
				});
			}
		}
		this.componentMounted = true;
	}

	componentDidUpdate(prevProps, prevState, snapShot) {
		const activePc = this.props.playerCharacters[this.props.activeCharacter];
		if (prevProps.activeCharacter !== this.props.activeCharacter) {
			// move creature
			if (this.props.mapCreatures[this.props.activeCharacter]) {
				// timeout to allow UI to provide visible updates to player, like creatures moving in turn and turn indicator to show 'enemies moving'
				setTimeout(() => {
					this._moveCreature();
				}, this.state.shortMovementDelay);
			// move map to center on active pc
			} else if (activePc) {
				// at beginning of a pc's turn, update sanity if pc is in darkness
				if (this.props.inTacticalMode && this.state.mapLayout[convertCoordsToPos(activePc.coords)].lightStrength === 0) {
					this._updateSanityForDarkness();
				}
				this._moveMap();
			}
		}
		const activePcPrevProps = prevProps.playerCharacters[this.props.activeCharacter];
		// check if panicking or confused
		if (this.props.inTacticalMode && activePc) {
			if (activePc.statuses.panicking && (!activePcPrevProps.statuses.panicking || prevProps.activeCharacter !== this.props.activeCharacter)) {
				this._runAway(this.props.activeCharacter, activePc.coords, activePc.moveSpeed, 'creature');
			}
			if (activePc.statuses.confused && (!activePcPrevProps.statuses.confused || prevProps.activeCharacter !== this.props.activeCharacter)) {
				this._randomizeTurn();
			}
		}
		// selected context menu item
		if (this.props.contextMenuChoice && prevProps.contextMenuChoice !== this.props.contextMenuChoice) {
			this.checkIfTileOrObject(this.props.contextMenuChoice.tilePos, null, this.props.contextMenuChoice.actionType);
		}
		// close context menu
		if (prevProps.contextMenu && !this.props.contextMenu) {
			this.contextMenuOpen = false;
		}
		// lighting sources changed, so recalculate lighting
		if (this.props.lightingHasChanged && !prevProps.lightingHasChanged) {
			this._calculateLighting(() => {
				this._updateThreatLists(() => this.props.toggleLightingHasChanged(false));
			});
		}
		// player clicked button to center on active pc
		if (this.props.centerOnPlayer && !prevProps.centerOnPlayer) {
			this._moveMap();
			this.props.toggleCenterOnPlayer();
		}
		// screen was resized or device rotated
		if (prevProps.screenData.width !== this.props.screenData.width ||
			prevProps.screenData.height !== this.props.screenData.height ||
			prevProps.screenData.isSmall !== this.props.screenData.isSmall ||
			prevProps.screenData.isNarrow !== this.props.screenData.isNarrow ||
			prevProps.screenData.isShort !== this.props.screenData.isShort ||
			prevProps.gameOptions.screenZoom !== this.props.gameOptions.screenZoom)
		{
			this._moveMap();
		}
		// new creature spawned (ie. from coffin)
		if (this.props.creatureSpawnInfo && prevProps.creatureSpawnInfo !== this.props.creatureSpawnInfo) {
			this.findNearestTileForSpawn();
		}
		// saving data either from location change or options menu button
		if (this.props.needToSaveData && prevProps.needToSaveData !== this.props.needToSaveData) {
			if (this.props.locationChange) {
				this.saveAllData(this.resetMap, this.props.locationChange.floor, this.props.locationChange.location)
			} else {
				this.saveAllData();
			}
		}
	}

	// shouldComponentUpdate(nextProps, nextState, nextContext) {
		// if (nextState.mapLayoutDone !== this.state.mapLayoutDone ||
		// 	nextState.creaturesPlaced !== this.state.creaturesPlaced ||
		// 	nextState.objectsPlaced !== this.state.objectsPlaced ||
		// 	nextState.exitPlaced !== this.state.exitPlaced)
		// {
		// 	return false;
		// }
		// return true;
	// }

	// Add below for testing: <button onClick={this.resetMap}>Reset</button>
	render() {
		let previousPointerEvt = null;
		window.addEventListener('pointerup', () => {
			previousPointerEvt = null;
			this.endDragging();
		});
		const creatures = this.state.currentLocationData.floors[this.props.currentFloor].creatures;
		const npcs = this.state.currentLocationData.floors[this.props.currentFloor].npcs;
		const creaturesInMap = !creatures || (creatures && this.state.creaturesPlaced);
		const npcsInMap = !npcs || (npcs && this.state.npcsPlaced);

		return (
			<div id='world'
			     ref={this.worldRef}
			     style={{width: `${this.state.worldWidth}px`, height: `${this.state.worldHeight}px`, filter: `brightness(${this.props.gameOptions.brightness})`}}
			     onPointerDown={() => this.clickedOnWorld = true}
			     onPointerMove={evt => {
					 if (!previousPointerEvt) {
						 previousPointerEvt = evt;
					 }
					 this.dragWorld(evt, previousPointerEvt);
					 previousPointerEvt = evt;
				 }}
			>
				<div className='map' draggable={false}>
					{ this.state.mapLayoutDone && this.state.lightingCalculated && <this.createAllMapPieces /> }
				</div>
				<div className='objects' draggable={false}>
					{ this.state.exitPlaced && this.state.objectsPlaced && <this.addItems /> }
				</div>
				<div className='env-objects' draggable={false}>
					{ this.state.exitPlaced && this.state.envObjectsPlaced && <this.addAllEnvObjects /> }
				</div>
				<div className='lighting' draggable={false}>
					{ this.state.exitPlaced && this.state.envObjectsPlaced && this.state.lightingCalculated && <this.addLighting />}
				</div>
				<div className='characters' draggable={false}>
					{ this.state.mapLayoutDone && this.state.playerPlaced && creaturesInMap && npcsInMap && <this.addCharacters /> }
				</div>
				<MapCover styleProp={{opacity: this.state.mapMoved ? '0' : '1.0'}} />
			</div>
		);
	}
}

export default Map;
