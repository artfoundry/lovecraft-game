import React from 'react';
import MapData from './mapData.json';
import GameLocations from './gameLocations.json';
import CreatureData from './creatureTypes.json';
import {Exit, LightElement, Character, Tile, Door} from './VisualElements';
import {StoneDoor} from './Audio';
import {unblockedPathsToNearbyTiles} from './Utils';

class Map extends React.Component {
	constructor(props) {
		super(props);

		this.pageFirstLoaded = true;
		this.initialMapLoad = true;
		this.tileSize = 64;
		this.characterSizePercentage = 0.7;
		this.mapTileLimit = 500;
		this.firstPiecePosition = {xPos: 5, yPos: 5};
		this.OPPOSITE_SIDE = {
			topSide: 'bottomSide',
			bottomSide: 'topSide',
			leftSide: 'rightSide',
			rightSide: 'leftSide'
		};

		this.mapLayoutTemp = {};
		this.sfxSelectors = {
			catacombs: {}
		};
		this.currentMapData = GameLocations[this.props.locationProp];

		this.state = {
			playerCharacters: this.props.pcProp,
			playerPos: {},
			playerPlaced: false,
			playerVisited: {},
			mapLayout: {},
			mapLayoutDone: false,
			mapPosition: {},
			exitPosition: {},
			exitPlaced: false,
			lighting: {},
			mapCreatures: {}

		};

		this.showDialog = this.props.showDialogProp;
		this.createAllMapPieces = this.createAllMapPieces.bind(this);
		this.addLighting = this.addLighting.bind(this);
	}

	layoutPieces = () => {
		let numPiecesTried = 0;
		let attemptedPieces = [];
		const numPieceTemplates = Object.keys(MapData).length;

		while (numPiecesTried < numPieceTemplates && Object.keys(this.mapLayoutTemp).length < this.mapTileLimit) {
			const {newPiece, pieceName} = this.chooseNewRandomPiece(attemptedPieces);
			attemptedPieces.push(pieceName);
			const {positionFound, updatedPiece, mapOpening, pieceOpening} = this.findNewPiecePosition(newPiece);

			if (positionFound) {
				this.updateMapLayout(updatedPiece, mapOpening, pieceOpening);
				attemptedPieces = [];
				numPiecesTried = 0;
			} else numPiecesTried++;
		}
		this.mapCleanup();

		if (this.initialMapLoad) {
			this.initialMapLoad = false;
			this.setState({
				mapLayoutDone: true,
				mapLayout: {...this.mapLayoutTemp}
			}, () => {
				this.moveCharacter(null, null, () => {
					this.setExitPosition();
					let mapCreatures = this.setInitialCreatureData();
					this.setState({mapCreatures});
					if (this.pageFirstLoaded) {
						this.pageFirstLoaded = false;
						this.setupKeyListeners();
					}
				});
			});
		}
	}

	chooseNewRandomPiece(attemptedPieces) {
		const pieceNamesList = Object.keys(MapData);
		const filteredPieceNameList = pieceNamesList.filter(name => attemptedPieces.indexOf(name) < 0);
		const randomIndex = Math.floor(Math.random() * filteredPieceNameList.length);
		const newPiece = MapData[filteredPieceNameList[randomIndex]];
		return {newPiece, pieceName: filteredPieceNameList[randomIndex]};
	}

	// For updating coords from original (from mapdata) to map placement position
	updateNeighborCoordinates(tileData, xAdjustment, yAdjustment) {
		let updatedNeighbors = {};
		for (const [type, neighborCoords] of Object.entries(tileData.neighbors)) {
			let neighborPos = [];
			let newXPos = null;
			let newYPos = null;
			updatedNeighbors[type] = [];
			neighborCoords.forEach(coord => {
				neighborPos = coord.split('-');
				newXPos = +neighborPos[0] + xAdjustment;
				newYPos = +neighborPos[1] + yAdjustment;
				updatedNeighbors[type].push(newXPos + '-' + newYPos);
			});
		}
		return updatedNeighbors;
	}

	// For updating coords from original (from mapdata) to map placement position
	updateAltClassCoordinates(tileData, xAdjustment, yAdjustment) {
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

	findNewPiecePosition(piece) {
		let positionFound = false;
		let updatedPiece = {};

		// just for placing first piece
		if (Object.keys(this.mapLayoutTemp).length === 0) {
			positionFound = true;
			for (const tileData of Object.values(piece)) {
				const adjustedXPos = this.firstPiecePosition.xPos + tileData.xPos;
				const adjustedYPos = this.firstPiecePosition.yPos + tileData.yPos;
				const adjustedPos = adjustedXPos + '-' + adjustedYPos;
				const updatedAltClasses = this.updateAltClassCoordinates(tileData, this.firstPiecePosition.xPos, this.firstPiecePosition.yPos);
				const updatedNeighbors = this.updateNeighborCoordinates(tileData, this.firstPiecePosition.xPos, this.firstPiecePosition.yPos);
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
					const adjustedPieceOpeningCoords = mapOpeningXOffset + '-' + mapOpeningYOffset;
					adjustedPieceOpening = {[adjustedPieceOpeningCoords]: pieceOpeningOpenSide};

					// now move all other tiles in the piece to go with the opening tile
					// and copy in rest of original tile info
					let isValidPos = true;
					let tilePosIndex = 0;
					const tileList = Object.values(piece);

					while (isValidPos && tilePosIndex < tileList.length) {
						const tileData = tileList[tilePosIndex];
						const newXPos = mapOpeningXOffset + tileData.xPos - +pieceOpeningTileCoords[0];
						const newYPos = mapOpeningYOffset + tileData.yPos - +pieceOpeningTileCoords[1];
						const newPosCoords = newXPos + '-' + newYPos;
						const originalPos = tileData.xPos + '-' + tileData.yPos;
						// check if location on map where tile would go is empty and within bounds
						if (this.mapLayoutTemp[newPosCoords] || newXPos < 0 || newYPos < 0) {
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
								pieceAdjustedTilePositions[newXPos + '-' + newYPos].altClasses = this.updateAltClassCoordinates(tileData, xAdjust, yAdjust);
							}
							if (tileData.neighbors) {
								pieceAdjustedTilePositions[newXPos + '-' + newYPos].neighbors = this.updateNeighborCoordinates(tileData, xAdjust, yAdjust);
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

	// Inserts piece into mapLayoutTemp and
	// clears out the 'opening' type from recently laid piece and matching opening on the map
	// newPiece: Object, copy from MapData but with updated pos for map layout
	// mapOpeningToRemove: Object, {[tileCoords relative to map]: side} - undefined for first piece
	// pieceOpeningToRemove: Object, {[tileCoords relative to piece]: side} - undefined for first piece
	updateMapLayout(newPiece, mapOpeningToRemove, pieceOpeningToRemove) {
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

	// For closing up all remaining openings since map layout is finished
	mapCleanup() {
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

	setInitialCreatureData() {
		let mapCreatures = {};
		for (const [name, stats] of Object.entries(this.currentMapData.creatures)) {
			mapCreatures[name] = {
				...CreatureData[name],
				...stats,
				tileCoords: this.setInitialCreatureCoords(mapCreatures)
			};
		}
		return mapCreatures;
	}

	setInitialCreatureCoords(mapCreatures) {
		const newPosition = this.generateRandomLocation(mapCreatures).split('-');
		return {xPos: +newPosition[0], yPos: +newPosition[1]};
	}

	createAllMapPieces() {
		let tiles = [];
		for (const tilePos of Object.keys(this.state.mapLayout)) {
			tiles.push(this.createMapTile(tilePos));
		}
		return tiles;
	}

	createMapTile(tilePos) {
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

	moveCharacter = (tileLoc, e, initialSetupCallback = null) => {
		let coords = [];
		let invalidMove = false;
		let playerMovementSide = [];
		const playerLoc = `${this.state.playerPos.xPos}-${this.state.playerPos.yPos}`;

		// new position from moving
		if (tileLoc || tileLoc === '') {

			//keyboard input
			if (e.code) {
				tileLoc = {...this.state.playerPos};
				switch(e.code) {
					case 'ArrowLeft':
						tileLoc.xPos -= 1;
						playerMovementSide.push('leftSide');
						break;
					case 'ArrowRight':
						tileLoc.xPos += 1;
						playerMovementSide.push('rightSide');
						break;
					case 'ArrowUp':
						tileLoc.yPos -= 1;
						playerMovementSide.push('topSide');
						break;
					case 'ArrowDown':
						tileLoc.yPos += 1;
						playerMovementSide.push('bottomSide');
						break;
				}
				tileLoc = `${tileLoc.xPos}-${tileLoc.yPos}`;
				coords = tileLoc.split('-');

			} else {
				// mouse/touch input

				coords = tileLoc.split('-');
				const playerXMovementAmount = Math.abs(+coords[0] - this.state.playerPos.xPos);
				const playerYMovementAmount = Math.abs(+coords[1] - this.state.playerPos.yPos);
				playerMovementSide = this.getSidesBetweenAdjacentTiles(playerLoc, tileLoc);

				// Invalid move if movement is more than 1 square or is =1 diagonal square
				if (playerXMovementAmount > 1 || playerYMovementAmount > 1 ||
					(playerXMovementAmount > 0 && playerYMovementAmount > 0))
				{
					invalidMove = true;
				}
			}

			// move is invalid if through a wall
			if (this.state.mapLayout[playerLoc][playerMovementSide[0]] === 'wall' ||
				(this.state.mapLayout[tileLoc].type === 'door' && !this.state.mapLayout[tileLoc].doorIsOpen))
				// below is for possibly moving diagonally
				// || this.state.mapLayout[playerLoc][playerMovementSide[1]] === 'wall' ||
				// this.state.mapLayout[tileLoc][this.OPPOSITE_SIDE[playerMovementSide[1]]] === 'wall'
			{
				invalidMove = true;
			}
		} else {
			// new position generated randomly
			tileLoc = this.generateRandomLocation();
			coords = tileLoc.split('-');
		}

		if (!invalidMove) {
			const visitedTile = `${coords[0]}-${coords[1]}`;
			if (!this.state.playerVisited[visitedTile]) {
				const xMinusOne = (+coords[0] - 1) < 0 ? 0 : +coords[0] - 1;
				const yMinusOne = (+coords[1] - 1) < 0 ? 0 : +coords[1] - 1;
				let surroundingTilesCoords = {};
				// list of surrounding tiles that are walls
				let surroundingTilesList = [
					`${xMinusOne}-${yMinusOne}`,
					`${+coords[0]}-${yMinusOne}`,
					`${+coords[0]+1}-${yMinusOne}`,
					`${xMinusOne}-${+coords[1]}`,
					`${+coords[0]+1}-${+coords[1]}`,
					`${xMinusOne}-${+coords[1]+1}`,
					`${+coords[0]}-${+coords[1]+1}`,
					`${+coords[0]+1}-${+coords[1]+1}`
				].filter(tile => this.state.mapLayout[tile] && this.state.mapLayout[tile].type === 'wall');

				surroundingTilesList.push(visitedTile);
				surroundingTilesList.forEach(tile => {
					surroundingTilesCoords[tile] = {
						xPos: +tile.split('-')[0],
						yPos: +tile.split('-')[1]
					}
				});
				this.setState(prevState => ({
					playerVisited: {
						...prevState.playerVisited,
						...surroundingTilesCoords
					},
					playerPos: {
						xPos: +coords[0],
						yPos: +coords[1]
					},
					playerPlaced: true
				}), () => {
					this.moveMap(initialSetupCallback);
					this.checkForExit();
				});
			} else {
				this.setState({
					playerPos: {
						xPos: +coords[0],
						yPos: +coords[1]
					},
					playerPlaced: true
				}, () => {
					this.moveMap(initialSetupCallback);
					this.checkForExit();
				});
			}
		}
	}

	// mapCreatures is temp list of creature data (before setting state)
	// for checking to make sure random location doesn't already have a creature there
	generateRandomLocation(mapCreatures = {}) {
		let emptyLocFound = false;
		// list of available floor tiles on which to place stuff
		let tileList = Object.keys(this.state.mapLayout).filter(tilePos => this.state.mapLayout[tilePos].type === 'floor');
		let creatureLocList = Object.values(mapCreatures).length > 0 ? Object.values(mapCreatures).map(creature => creature.tileCoords) : null;
		let randomIndex = 0;
		let tilePos = '';
		const exitPos = Object.values(this.state.exitPosition).length > 0 ?`${this.state.exitPosition.xPos}-${this.state.exitPosition.yPos}` : null;
	// will need to include other pc positions
		const playerPos = Object.values(this.state.playerPos).length > 0 ? `${this.state.playerPos.xPos}-${this.state.playerPos.yPos}` : null;

		while (!emptyLocFound && tileList.length > 0) {
			randomIndex = Math.floor(Math.random() * tileList.length);
			tilePos = tileList[randomIndex];
	// also will need to search object locations once I've set up storage for them
			if (!(exitPos && tilePos === exitPos) && !(creatureLocList && creatureLocList.includes(tilePos)) && !(playerPos && tilePos === playerPos)) {
				emptyLocFound = true;
			} else {
				// remove tile from list of available locations
				tileList.splice(randomIndex, 1);
			}
		}
		return tilePos;
	}

	// calculates the middle of the game window for placing main character
	calculatePlayerTransform() {
		return {xPos: Math.floor(window.outerWidth/(this.tileSize * 2)) * this.tileSize,
			yPos: Math.floor(window.innerHeight/(this.tileSize * 2)) * this.tileSize};
	}

	calculateObjectTransform(xPos, yPos) {
		return `${xPos * this.tileSize}px, ${yPos * this.tileSize}px`;
	}

	moveMap = (initialSetupCallback) => {
		const playerTransform = this.calculatePlayerTransform();
		const playerXPos = this.state.playerPos.xPos * this.tileSize;
		const playerYPos = this.state.playerPos.yPos * this.tileSize;
		const newXPos = playerTransform.xPos - playerXPos;
		const newYPos = playerTransform.yPos - playerYPos;

		this.setState({
			mapPosition: {
				transform: `translate(${newXPos}px, ${newYPos}px)`
			}
		}, () => {
			if (initialSetupCallback) {
				initialSetupCallback(); // only for setting up keys listener during setup
			}
		})
	}

	checkForExit() {
		if (this.state.playerPos.xPos === this.state.exitPosition.xPos &&
			this.state.playerPos.yPos === this.state.exitPosition.yPos)
		{
			const dialogText = 'Do you want to descend to the next level?';
			const closeButtonText = 'Stay here';
			const actionButtonVisible = true;
			const actionButtonText = 'Descend';
			const actionButtonCallback = this.resetMap;
			this.showDialog(dialogText, closeButtonText, actionButtonVisible, actionButtonText, actionButtonCallback);
		}
	}

	addCharacters = (props) => {
	// need to loop through 'count' of creatures and unique naming of each to add them all to characters object
		const characters = props.typeProp === 'players' ? {...this.state.playerCharacters} : {...this.state.mapCreatures};
		const characterNames = Object.keys(characters);
		let characterList = [];
		let characterTransform = null;
		characterNames.forEach(name => {
			if (characters[name].type === 'player') {
				// need to make adjustment for each player character
				characterTransform = this.calculatePlayerTransform();
				characterTransform = `${characterTransform.xPos}px, ${characterTransform.yPos}px`;
			} else {
				const creatureCoords = this.state.mapCreatures[name].tileCoords;
				characterTransform = this.calculateObjectTransform(creatureCoords.xPos, creatureCoords.yPos);
			}

			characterList.push(
				<Character
					key={name + Math.random()}
					classesProp={`${characters[name].type} ${name}`}
					dataLocProp={this.state.playerPos}
					styleProp={{
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

	addObjects = () => {
		let allObjects = [];
		allObjects.push(...this.addDoors(), this.addExit());

		return allObjects;
	}

	setExitPosition() {
		const tilePositions = Object.keys(this.state.mapLayout).filter(tilePos => this.state.mapLayout[tilePos].type === 'floor');
		let exitPosition = tilePositions[Math.floor(Math.random() * tilePositions.length)];
		const playerPos = this.state.playerPos.xPos + '-' + this.state.playerPos.yPos;
		while (exitPosition === playerPos) {
			exitPosition = tilePositions[Math.floor(Math.random() * tilePositions.length)];
		}
		const exitCoords = exitPosition.split('-');
		this.setState({exitPosition: {xPos: +exitCoords[0], yPos: +exitCoords[1]}, exitPlaced: true});
	}

	addExit() {
		return (<Exit
			key={'exit-' + this.state.exitPosition.xPos + '-' + this.state.exitPosition.yPos}
			styleProp={{
				transform: `translate(${this.calculateObjectTransform(this.state.exitPosition.xPos, this.state.exitPosition.yPos)})`,
				width: this.tileSize + 'px',
				height: this.tileSize + 'px'
			}} />);
	}

	addDoors() {
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
							transform: `translate(${this.calculateObjectTransform(+tileCoords[0], +tileCoords[1])})`,
						}}
						classProp={doorClass}
					/>
				)
			} else {
				objects.push(
					<div
						key={`object-${tilePos}`}
						style={{
							transform: `translate(${this.calculateObjectTransform(+tileCoords[0], +tileCoords[1])})`,
							width: this.tileSize + 'px',
							height: this.tileSize + 'px'
						}}
						className='object'
					/>
				)
			}
		}
		return objects;
	}

	addLighting() {
		let tiles = [];
		const playerPosStr = this.state.playerPos.xPos + '-' + this.state.playerPos.yPos;
		const lineOfSightTiles = unblockedPathsToNearbyTiles(this.state.mapLayout, playerPosStr);

		for (const tilePos of Object.keys(this.state.mapLayout)) {
			let allClasses = 'light-tile';

			if (tilePos === playerPosStr) {
				allClasses += ' very-bright-light black-light';
			} else if (lineOfSightTiles.oneAway.floors[tilePos] || lineOfSightTiles.oneAway.walls[tilePos]) {
				allClasses += ' bright-light black-light';
			} else if (lineOfSightTiles.twoAway.floors[tilePos] || lineOfSightTiles.twoAway.walls[tilePos]) {
				allClasses += ' med-light black-light';
			} else if (lineOfSightTiles.threeAway.floors[tilePos] || lineOfSightTiles.threeAway.walls[tilePos]) {
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
				styleProp={tileStyle}
				tileNameProp={this.state.mapLayout[tilePos].xPos + '-' + this.state.mapLayout[tilePos].yPos}
				classStrProp={allClasses} />);
		}
		return tiles;
	}

	getSidesBetweenAdjacentTiles(mainTileLoc, adjTileLoc) {
		let sides = [];
		const adjTile = this.state.mapLayout[adjTileLoc];
		const mainTile = this.state.mapLayout[mainTileLoc];

		if (mainTile.xPos - adjTile.xPos === -1) {
			sides.push('rightSide');
		}
		if (mainTile.xPos - adjTile.xPos === 1) {
			sides.push('leftSide');
		}
		if (mainTile.yPos - adjTile.yPos === -1) {
			sides.push('bottomSide');
		}
		if (mainTile.yPos - adjTile.yPos === 1) {
			sides.push('topSide');
		}

		return sides;
	}

	toggleDoor() {
		const playerPos = this.state.playerPos.xPos + '-' + this.state.playerPos.yPos;
		const playerPosTile = this.state.mapLayout[playerPos];
		const playerPosTileSides = [playerPosTile.leftSide, playerPosTile.rightSide, playerPosTile.topSide, playerPosTile.bottomSide];
		const doorLocation = playerPosTileSides.indexOf('door');
		const doorTileDirections = [
			(this.state.playerPos.xPos - 1) + '-' + this.state.playerPos.yPos,
			(this.state.playerPos.xPos + 1) + '-' + this.state.playerPos.yPos,
			this.state.playerPos.xPos + '-' + (this.state.playerPos.yPos - 1),
			this.state.playerPos.xPos + '-' + (this.state.playerPos.yPos + 1)
		];
		if (doorLocation >= 0) {
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

	populateSfxSelectors() {
		this.sfxSelectors.catacombs['door'] = document.getElementById('sfx-stonedoor');
	}

	setupSoundEffects = () => {
		let effects = [];

		effects.push(<StoneDoor key='sfx-stonedoor' idProp='sfx-stonedoor' />);

		return effects;
	}

	setupKeyListeners() {
		document.addEventListener('keydown', (e) => {
			if (e.code.startsWith('Arrow')) {
				e.preventDefault();
				this.moveCharacter('', e);
			} else if (e.code === 'Space') {
				e.preventDefault();
				this.toggleDoor();
			}
		});
	}

	resetMap = () => {
		this.initialMapLoad = true;
		this.mapLayoutTemp = {};

		this.setState({
			playerPos: {},
			playerPlaced: false,
			playerVisited: {},
			currentMap: 'catacombs',
			mapLayout: {},
			mapLayoutDone: false,
			mapPosition: {},
			exitPosition: {},
			exitPlaced: false,
			lighting: {}
		}, () => {
			this.layoutPieces();
		});
	}

	componentDidMount() {
		if (this.initialMapLoad) {
			this.layoutPieces();
			this.populateSfxSelectors();
		}
	}

	// componentDidUpdate(prevProps, prevState, snapShot) {}

	// shouldComponentUpdate(nextProps, nextState, nextContent) {}

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
					{ this.state.mapLayoutDone && <this.addCharacters typeProp='creatures' /> }
				</div>
				{ this.state.mapLayoutDone && <this.addCharacters typeProp='players' /> }
				{ <this.setupSoundEffects /> }
			</div>
		);
	}
}

export default Map;
