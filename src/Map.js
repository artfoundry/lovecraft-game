import React from "react";
import MapData from "./mapData";
import {Exit, LightElement, Player, Tile} from "./VisualElements";

class Map extends React.Component {
	constructor(props) {
		super(props);

		this.pageFirstLoaded = true;
		this.initialMapLoad = true;

		this.tileSize = 32;
		this.mapPieces = MapData();
		this.mapTileLimit = 500;
		this.firstPiecePosition = {xPos: 5, yPos: 5};
		this.OPPOSITE_SIDE = {
			topSide: 'bottomSide',
			bottomSide: 'topSide',
			leftSide: 'rightSide',
			rightSide: 'leftSide'
		};

		this.mapLayoutTemp = {};

		this.state = {
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
		};

		this.showDialog = this.props.showDialogProp;
		this.createAllPieces = this.createAllPieces.bind(this);
		this.addLighting = this.addLighting.bind(this);
	}

	layoutPieces = () => {
		let numPiecesTried = 0;
		let attemptedPieces = [];
		const numPieceTemplates = Object.keys(this.mapPieces).length;

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
			this.setState({mapLayoutDone: true, mapLayout: {...this.mapLayoutTemp}}, () => {
				this.placePlayer(null, null, () => {
					this.placeExit();
					if (this.pageFirstLoaded) {
						this.pageFirstLoaded = false;
						this.setupKeyListeners();
					}
				});
			});
		}
	}

	chooseNewRandomPiece(attemptedPieces) {
		const pieceNamesList = Object.keys(this.mapPieces);
		const filteredPieceNameList = pieceNamesList.filter(name => attemptedPieces.indexOf(name) < 0);
		const randomIndex = Math.floor(Math.random() * filteredPieceNameList.length);
		const newPiece = this.mapPieces[filteredPieceNameList[randomIndex]];
		return {newPiece, pieceName: filteredPieceNameList[randomIndex]};
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
				updatedPiece[adjustedPos] = {...tileData, xPos: adjustedXPos, yPos: adjustedYPos};
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
			mapOpeningTileCoords.forEach((coord,i,arr) => arr[i] = +coord);

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
					pieceOpeningTileCoords.forEach((coord,i,arr) => arr[i] = +coord);
					const xAdjust = mapOpeningOpenSide === 'leftSide' ? -1 : mapOpeningOpenSide === 'rightSide' ? 1 : 0;
					const yAdjust = mapOpeningOpenSide === 'topSide' ? -1 : mapOpeningOpenSide === 'bottomSide' ? 1 : 0;
					// these are the coords for where in the map to place the piece's tile that contains the opening
					const mapOpeningXOffset = mapOpeningTileCoords[0] + xAdjust;
					const mapOpeningYOffset = mapOpeningTileCoords[1] + yAdjust;
					const adjustedPieceOpeningCoords = mapOpeningXOffset + '-' + mapOpeningYOffset;
					adjustedPieceOpening = {[adjustedPieceOpeningCoords]: pieceOpeningOpenSide};

					// now move all other tiles in the piece to go with the opening tile
					// and copy in rest of original tile info
					let isValidPos = true;
					let tilePosIndex = 0;
					const tileList = Object.values(piece);
					while (isValidPos && tilePosIndex < tileList.length) {
						const tileData = tileList[tilePosIndex];
						const newXPos = mapOpeningXOffset + tileData.xPos - pieceOpeningTileCoords[0];
						const newYPos = mapOpeningYOffset + tileData.yPos - pieceOpeningTileCoords[1];
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
							if (tileData.altClasses) {
								let updatedAltClasses = {};
								for (const [pos, classes] of Object.entries(tileData.altClasses)) {
									if (pos === 'both') {
										updatedAltClasses.both = classes;
									} else {
										let neighborPos = {};
										let newXPos = null;
										let newYPos = null;
										neighborPos = pos.split('-');
										newXPos = +neighborPos[0] + mapOpeningXOffset - pieceOpeningTileCoords[0];
										newYPos = +neighborPos[1] + mapOpeningYOffset - pieceOpeningTileCoords[1];
										updatedAltClasses[newXPos + '-' + newYPos] = classes;
									}
								}
								pieceAdjustedTilePositions[newXPos + '-' + newYPos].altClasses = updatedAltClasses;
							}
							if (tileData.neighbors) {
								let updatedNeighbors = {};
								for (const [type, neighborCoords] of Object.entries(tileData.neighbors)) {
									let neighborPos = {};
									let newXPos = null;
									let newYPos = null;
									if (Array.isArray(neighborCoords)) {
										updatedNeighbors[type] = [];
										neighborCoords.forEach(coord => {
											neighborPos = coord.split('-');
											newXPos = +neighborPos[0] + mapOpeningXOffset - pieceOpeningTileCoords[0];
											newYPos = +neighborPos[1] + mapOpeningYOffset - pieceOpeningTileCoords[1];
											updatedNeighbors[type].push(newXPos + '-' + newYPos);
										});
									} else {
										neighborPos = neighborCoords.split('-');
										newXPos = +neighborPos[0] + mapOpeningXOffset - pieceOpeningTileCoords[0];
										newYPos = +neighborPos[1] + mapOpeningYOffset - pieceOpeningTileCoords[1];
										updatedNeighbors[type] = newXPos + '-' + newYPos;
									}
								}
								pieceAdjustedTilePositions[newXPos + '-' + newYPos].neighbors = updatedNeighbors;
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

	// For clearing out the 'opening' type from recently laid piece and matching opening on the map
	// newPiece: Object, copy from this.mapPieces but with updated pos for map layout
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
						// change tile's attributes if it and neighbors won't be deleted, ie. if it's part of a hall, not a room
						if (!tileData.neighbors.toDelete) {
							this.mapLayoutTemp[tileLoc] = {
								...this.mapLayoutTemp[tileLoc],
								type: 'wall',
								walkable: false,
								topSide: 'wall',
								rightSide: 'wall',
								bottomSide: 'wall',
								leftSide: 'wall'
							};
						// or if it and neighbors will be deleted, then change neighboring door to wall
						} else if (tileData.neighbors.toChangeType){
							this.mapLayoutTemp[tileData.neighbors.toChangeType] = {
								...this.mapLayoutTemp[tileData.neighbors.toChangeType],
								type: 'wall',
								walkable: false,
								topSide: 'wall',
								rightSide: 'wall',
								bottomSide: 'wall',
								leftSide: 'wall'
							};
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
			if (newTileClasses.includes('right-wall') && this.mapLayoutTemp[neighborLoc].type === 'floor') {
				console.log(tileData, this.mapLayoutTemp[neighborLoc])
			}
							this.mapLayoutTemp[neighborLoc].classes = newTileClasses;
						});
						if (tileData.neighbors.toDelete) {
							tileData.neighbors.toDelete.forEach(tileToDelete => {
								delete this.mapLayoutTemp[tileToDelete];
							});
						}
						this.mapLayoutTemp[tileData.neighbors.toChangeSideType][tileSide] = 'wall';
					}
				}
			}
		}
	}

	createAllPieces() {
		let tiles = [];
		for (const tilePos of Object.keys(this.state.mapLayout)) {
			tiles.push(this.createMapTile(tilePos));
		}
		return tiles;
	}

	createMapTile(tilePos) {
		let allClasses = this.state.currentMap;
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
			placePlayerProp={this.placePlayer} />);
	}

	placePlayer = (tileLoc, e, callback = null) => {
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
				this.state.mapLayout[tileLoc][this.OPPOSITE_SIDE[playerMovementSide[0]]] === 'wall')
				// below is for possibly moving diagonally
				// || this.state.mapLayout[playerLoc][playerMovementSide[1]] === 'wall' ||
				// this.state.mapLayout[tileLoc][this.OPPOSITE_SIDE[playerMovementSide[1]]] === 'wall'
			{
				invalidMove = true;
			}
		} else {
			// new position generated randomly
			const tileList = Object.keys(this.state.mapLayout).filter(tilePos => this.state.mapLayout[tilePos].walkable);
			const randomIndex = Math.floor(Math.random() * tileList.length);
			tileLoc = tileList[randomIndex];
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
						yPos: +tile.split('-')[0]
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
					this.moveMap(callback);
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
					this.moveMap(callback);
					this.checkForExit();
				});
			}
		}
	}

	calculatePlayerTransform() {
		return {xPos: Math.floor(window.outerWidth/(this.tileSize * 2)) * this.tileSize,
			yPos: Math.floor(window.innerHeight/(this.tileSize * 2)) * this.tileSize};
	}

	moveMap = (callback) => {
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
			if (callback) {
				callback(); // only for setting up keys listener during setup
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

	addLighting() {
		let tiles = [];
		const playerPosStr = this.state.playerPos.xPos + '-' + this.state.playerPos.yPos;
		const lineOfSightTiles = this.unblockedPathsToNearbyTiles(playerPosStr);

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

	// Find all tiles out to 3 rings surrounding center,
	// then find tiles of those that have unblocked lines of sight(LOS) to the center
	unblockedPathsToNearbyTiles(centerTilePos) {
		const centerTile = this.state.mapLayout[centerTilePos];
		let nearbyTiles = {
			twoAway: {floors: {}, walls: {}},
			threeAway: {floors: {}, walls: {}}
		};
		let lineOfSightTiles = {
			oneAway: {floors: {}, walls: {}},
			twoAway: {floors: {}, walls: {}},
			threeAway: {floors: {}, walls: {}}
		};

		// collect all tiles that are 1-3 tiles away from center
		for (let xCount = (centerTile.xPos - 3) < 0 ? 0 : centerTile.xPos - 3; xCount <= centerTile.xPos + 3; xCount++) {
			for (let yCount = (centerTile.yPos - 3) < 0 ? 0 : centerTile.yPos - 3; yCount <= centerTile.yPos + 3; yCount++) {
				const tilePos = xCount + '-' + yCount;
				const currentTile = this.state.mapLayout[tilePos];
				if (currentTile && tilePos !== centerTilePos) {
					const horizDeltaFromCenter = Math.abs(centerTile.xPos - currentTile.xPos);
					const vertDeltaFromCenter = Math.abs(centerTile.yPos - currentTile.yPos);

					if (horizDeltaFromCenter <= 1 && vertDeltaFromCenter <= 1) {
						if (currentTile.type === 'wall') {
							lineOfSightTiles.oneAway.walls[tilePos] = currentTile;
						} else {
							lineOfSightTiles.oneAway.floors[tilePos] = currentTile;
						}
					} else if (horizDeltaFromCenter <= 2 && vertDeltaFromCenter <= 2) {
						if (currentTile.type === 'wall') {
							nearbyTiles.twoAway.walls[tilePos] = currentTile;
						} else {
							nearbyTiles.twoAway.floors[tilePos] = currentTile;
						}
					} else if (horizDeltaFromCenter <= 3 && vertDeltaFromCenter <= 3) {
						if (currentTile.type === 'wall') {
							nearbyTiles.threeAway.walls[tilePos] = currentTile;
						} else {
							nearbyTiles.threeAway.floors[tilePos] = currentTile;
						}
					}
				}
			}
		}

		// now find tiles two tiles from center that have line of sight
		let floorsAndWalls = {...nearbyTiles.twoAway.floors, ...nearbyTiles.twoAway.walls};
		for (const [twoAwayTilePos, twoAwayTileData] of Object.entries(floorsAndWalls)) {
			for (const oneAwayTileData of Object.values(lineOfSightTiles.oneAway.floors)) {
				const deltaXTwoAndOneAway = Math.abs(twoAwayTileData.xPos - oneAwayTileData.xPos);
				const deltaYTwoAndOneAway = Math.abs(twoAwayTileData.yPos - oneAwayTileData.yPos);
				const deltaXOneAwayAndCenter = Math.abs(oneAwayTileData.xPos - centerTile.xPos);
				const deltaYOneAwayAndCenter = Math.abs(oneAwayTileData.yPos - centerTile.yPos);
				const outerTileHasLOS =
					(deltaXTwoAndOneAway <= 1 && deltaXOneAwayAndCenter <= 1 && deltaYTwoAndOneAway === 1) ||
					(deltaYTwoAndOneAway <= 1 && deltaYOneAwayAndCenter <= 1 && deltaXTwoAndOneAway === 1);

				// if one of the 1 away tiles that has line of sight is between the current 2 away tile and center tile...
				if (outerTileHasLOS)
				{
					if (twoAwayTileData.type === 'wall') {
						lineOfSightTiles.twoAway.walls[twoAwayTilePos] = twoAwayTileData;
					} else {
						lineOfSightTiles.twoAway.floors[twoAwayTilePos] = twoAwayTileData;
					}
				}
			}
		}

		// now find tiles three tiles from center that have line of sight
		floorsAndWalls = {...nearbyTiles.threeAway.floors, ...nearbyTiles.threeAway.walls};
		for (const [threeAwayTilePos, threeAwayTileData] of Object.entries(floorsAndWalls)) {
			for (const twoAwayTileData of Object.values(lineOfSightTiles.twoAway.floors)) {
				for (const oneAwayTileData of Object.values(lineOfSightTiles.oneAway.floors)) {
					const deltaXThreeAndTwoAway = Math.abs(threeAwayTileData.xPos - twoAwayTileData.xPos);
					const deltaYThreeAndTwoAway = Math.abs(threeAwayTileData.yPos - twoAwayTileData.yPos);
					const deltaXTwoAndOneAway = Math.abs(twoAwayTileData.xPos - oneAwayTileData.xPos);
					const deltaYTwoAndOneAway = Math.abs(twoAwayTileData.yPos - oneAwayTileData.yPos);
					const outerTileHasLOS =
						(deltaXThreeAndTwoAway <= 1 && deltaXTwoAndOneAway <= 1 && deltaYThreeAndTwoAway === 1) ||
						(deltaYThreeAndTwoAway <= 1 && deltaYTwoAndOneAway <= 1 && deltaXThreeAndTwoAway === 1);

					// if one of the 1 away tiles that has line of sight is between the current 2 away tile and center tile...
					if (outerTileHasLOS)
					{
						if (threeAwayTileData.type === 'wall') {
							lineOfSightTiles.threeAway.walls[threeAwayTilePos] = threeAwayTileData;
						} else {
							lineOfSightTiles.threeAway.floors[threeAwayTilePos] = threeAwayTileData;
						}
					}
				}
			}
		}

		return lineOfSightTiles;
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

	placeExit = () => {
		const tilePositions = Object.keys(this.state.mapLayout).filter(tilePos => this.state.mapLayout[tilePos].walkable);
		let exitPosition = tilePositions[Math.floor(Math.random() * tilePositions.length)];
		const playerPos = this.state.playerPos.xPos + '-' + this.state.playerPos.yPos;
		while (exitPosition === playerPos) {
			exitPosition = tilePositions[Math.floor(Math.random() * tilePositions.length)];
		}
		const exitCoords = exitPosition.split('-');
		this.setState({exitPosition: {xPos: +exitCoords[0], yPos: +exitCoords[1]}, exitPlaced: true});
	}

	setupKeyListeners() {
		document.addEventListener('keydown', (e) => {
			if (e.code.startsWith('Arrow') || e.code === 'Space') {
				e.preventDefault();
			}
			this.placePlayer('', e);
		});
	}

	resetMap = () => {
		this.initialMapLoad = true;
		this.mapLayoutTemp = {};

		this.setState({
			playerPos: {},
			playerPlaced: false,
			playerVisited: {},
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
		}
	}

	// componentDidUpdate(prevProps, prevState, snapShot) {}

	// shouldComponentUpdate(nextProps, nextState, nextContent) {}

	// Add below for testing: <button onClick={this.resetMap}>Reset</button>
	render() {
		const playerTransform = this.calculatePlayerTransform();
		return (
			<div className="world" style={{width: `${Math.floor(window.outerWidth/this.tileSize) * this.tileSize}px`}}>
				<div className="map" style={this.state.mapPosition}>
					{ this.state.mapLayoutDone &&
						<this.createAllPieces />
					}
					{ this.state.exitPlaced &&
						<Exit
							styleProp={{
								transform: `translate(${this.state.exitPosition.xPos * this.tileSize}px, ${this.state.exitPosition.yPos * this.tileSize}px)`,
								width: this.tileSize + 'px',
								height: this.tileSize + 'px'
							}}
							tileNameProp={this.state.exitPosition.xPos + '-' + this.state.exitPosition.yPos} />
					}
				</div>
				<div className="lighting" style={this.state.mapPosition}>
					{ this.state.playerPlaced &&
						<this.addLighting />
					}
				</div>
				{ this.state.mapLayoutDone &&
					<Player dataLocProp={this.state.playerPos}
					        styleProp={{
								transform: `translate(${playerTransform.xPos}px, ${playerTransform.yPos}px)`,
						        width: (this.tileSize * 0.65) + 'px',
						        height: (this.tileSize * 0.65) + 'px',
						        margin: '4px'
							}} />
				}
			</div>
		);
	}
}

export default Map;
