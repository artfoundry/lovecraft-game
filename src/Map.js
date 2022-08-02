import React from "react";
import MapData from "./mapData";
import {Exit, LightElement, Player, Tile} from "./VisualElements";

class Map extends React.Component {
	constructor() {
		super();

		this.initialLoad = true;

		this.tileSize = 50;
		this.mapPieces = MapData();
		this.mapPieceLimit = 100
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
			mapLayout: {},
			mapLayoutDone: false,
			mapPosition: {},
			exitPosition: {},
			exitPlaced: false,
			lighting: {}
		};

		this.placePlayer = this.placePlayer.bind(this);
		this.createAllPieces = this.createAllPieces.bind(this);
		this.placeExit = this.placeExit.bind(this);
		this.addLighting = this.addLighting.bind(this);
	}

	layoutPieces = () => {
		let numPosUnavail = 0;
		let attemptedPieces = [];
		const numMapPieces = Object.keys(this.mapPieces).length;

		while (numPosUnavail < numMapPieces && Object.keys(this.mapLayoutTemp).length < this.mapPieceLimit) {
			const {newPiece, pieceName} = this.chooseNewRandomPiece(attemptedPieces);
			attemptedPieces.push(pieceName);
			const {positionFound, updatedPiece, mapOpening, pieceOpening} = this.findNextPiecePosition(newPiece);

			if (positionFound) {
				this.updateMapLayout(updatedPiece, mapOpening, pieceOpening);
				attemptedPieces = [];
				numPosUnavail = 0;
			} else numPosUnavail++;
		}

		this.mapCleanup();
		this.setState({mapLayout: {...this.mapLayoutTemp}, mapLayoutDone: true}, () => {
			this.placePlayer(null, null, () => {
				this.placeExit();
				if (this.initialLoad) {
					this.initialLoad = false;
					this.setupKeyListeners();
				}
			});
		});
	}

	chooseNewRandomPiece(attemptedPieces) {
		const pieceNamesList = Object.keys(this.mapPieces);
		const filteredPiecesList = pieceNamesList.filter(name => attemptedPieces.indexOf(name) < 0);
		const randomIndex = Math.floor(Math.random() * filteredPiecesList.length);
		const newPiece = this.mapPieces[filteredPiecesList[randomIndex]];

		return {newPiece, pieceName: filteredPiecesList[randomIndex]};
	}

	findNextPiecePosition(piece) {
		let positionFound = false;

		if (Object.keys(this.mapLayoutTemp).length === 0) {
			positionFound = true;
			return {positionFound, updatedPiece: piece};
		}

		let pieceOpenings = [];
		let mapOpenings = [];

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
		let pieceAdjustedTilePositions = [];
		let mapTilesAvailableForPiece = 0;
		let mapOpeningsCounter = 0;
		let pieceOpeningsCounter = 0;
		const numOfPieceTiles = Object.keys(piece).length;

		// look through each opening in the map
		while (mapTilesAvailableForPiece < numOfPieceTiles && mapOpeningsCounter < mapOpenings.length) {
			mapOpening = mapOpenings[mapOpeningsCounter];
			const mapOpeningTileCoords = Object.keys(mapOpening)[0].split('-');
			mapOpeningTileCoords.forEach((coord,i,arr) => arr[i] = +coord);

			// for a map opening, check each piece opening to see if piece fits there
			while (mapTilesAvailableForPiece < numOfPieceTiles && pieceOpeningsCounter < pieceOpenings.length) {
				pieceAdjustedTilePositions = [];
				mapTilesAvailableForPiece = 0;  // gets reset for each piece opening
				pieceOpening = pieceOpenings[pieceOpeningsCounter];
				const mapOpeningOpenSide = Object.values(mapOpening)[0];
				const pieceOpeningOpenSide = Object.values(pieceOpening)[0];
				if (pieceOpeningOpenSide === this.OPPOSITE_SIDE[mapOpeningOpenSide]) {
					const pieceOpeningTileCoords = Object.keys(pieceOpening)[0].split('-');
					pieceOpeningTileCoords.forEach((coord,i,arr) => arr[i] = +coord);
					const xAdjust = mapOpeningOpenSide === 'leftSide' ? -1 : mapOpeningOpenSide === 'rightSide' ? 1 : 0;
					const yAdjust = mapOpeningOpenSide === 'topSide' ? -1 : mapOpeningOpenSide === 'bottomSide' ? 1 : 0;
					// these are the coords for where to place the piece's tile containing the opening
					const mapOpeningXOffset = mapOpeningTileCoords[0] + xAdjust;
					const mapOpeningYOffset = mapOpeningTileCoords[1] + yAdjust;
					const adjustedPieceOpeningCoords = mapOpeningXOffset + '-' + mapOpeningYOffset;
					adjustedPieceOpening = {[adjustedPieceOpeningCoords]: pieceOpeningOpenSide};

					for (const [tilePos, tileData] of Object.entries(piece)) {
						const newXPos = mapOpeningXOffset + tileData.xPos - pieceOpeningTileCoords[0];
						const newYPos = mapOpeningYOffset + tileData.yPos - pieceOpeningTileCoords[1];
						pieceAdjustedTilePositions.push({
							[tilePos]: newXPos + '-' + newYPos,
							xPos: newXPos,
							yPos: newYPos
						});
					}

					let tilePosIndex = 0;
					let validPos = true;
					// check if all tiles on map where piece would go are empty
					while (validPos && tilePosIndex < pieceAdjustedTilePositions.length) {
						const adjustedTilePos = pieceAdjustedTilePositions[tilePosIndex];
						const tilePotentialPosInMap = adjustedTilePos.xPos + '-' + adjustedTilePos.yPos;

						if (this.mapLayoutTemp[tilePotentialPosInMap] || adjustedTilePos.xPos < 0 || adjustedTilePos.yPos < 0) {
							validPos = false;
						} else {
							mapTilesAvailableForPiece++;
						}
						tilePosIndex++;
					}
				}
				pieceOpeningsCounter++;
			}
			pieceOpeningsCounter = 0;
			mapOpeningsCounter++;
		}

		let updatedPiece = {};
		if (mapTilesAvailableForPiece === numOfPieceTiles) {
			positionFound = true;
			for (const [tilePos, tileData] of Object.entries(piece)) {
				const matchingUpdate = pieceAdjustedTilePositions.find(adjData => Object.keys(adjData).find(key => key === tilePos));
				const updatedTilePos = matchingUpdate[tilePos];
				updatedPiece[updatedTilePos] = {
					...tileData,
					xPos: +updatedTilePos.split('-')[0],
					yPos: +updatedTilePos.split('-')[1]
				};
			}
		}

		pieceOpening = adjustedPieceOpening;
		return {positionFound, updatedPiece, mapOpening, pieceOpening};
	}

	// newPiece: Object, copy from this.mapPieces but with updated pos for map layout
	// mapOpeningToRemove: Object, {[tileCoords relative to map]: side} - undefined for first piece
	// pieceOpeningToRemove: Object, {[tileCoords relative to piece]: side} - undefined for first piece
	updateMapLayout(newPiece, mapOpeningToRemove, pieceOpeningToRemove) {
		const tilePositions = Object.keys(newPiece);
		let pieceOpeningTile = '';
		let pieceOpeningSide = '';
		let mapOpeningTile = '';
		let mapOpeningSide = '';
		if (mapOpeningToRemove && pieceOpeningToRemove) {
			pieceOpeningTile = Object.keys(pieceOpeningToRemove)[0];
			pieceOpeningSide = pieceOpeningToRemove[pieceOpeningTile];
			mapOpeningTile = Object.keys(mapOpeningToRemove)[0];
			mapOpeningSide = mapOpeningToRemove[mapOpeningTile];
		}

		tilePositions.forEach(tilePos => {
			if (pieceOpeningToRemove && tilePos === pieceOpeningTile) {
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

	mapCleanup() {
		for (const [tileLoc, tileData] of Object.entries(this.mapLayoutTemp)) {
			const tileSides = {
				topSide: tileData.topSide,
				bottomSide: tileData.bottomSide,
				leftSide: tileData.leftSide,
				rightSide: tileData.rightSide
			}
			for (const [tileSide, sideType] of Object.entries(tileSides)) {
				let adjacentTile = {};
				const tileCoords = tileLoc.split('-');
				switch(tileSide) {
					case 'topSide': adjacentTile = this.mapLayoutTemp[`${tileCoords[0]}-${tileCoords[1] - 1}`]; break;
					case 'bottomSide': adjacentTile = this.mapLayoutTemp[`${tileCoords[0]}-${tileCoords[1] + 1}`]; break;
					case 'leftSide': adjacentTile = this.mapLayoutTemp[`${tileCoords[0] - 1}-${tileCoords[1]}`]; break;
					case 'rightSide': adjacentTile = this.mapLayoutTemp[`${tileCoords[0] + 1}-${tileCoords[1]}`];
				}

				const oppositeSide = adjacentTile !== undefined ? adjacentTile[this.OPPOSITE_SIDE[tileSide]] : '';
				if (sideType === 'opening' || (sideType === '' && oppositeSide === 'wall')) {
					this.mapLayoutTemp[tileLoc][tileSide] = 'wall';
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
		const topSideClass = this.state.mapLayout[tilePos].topSide === 'wall' ? ' top-wall' : '';
		const rightSideClass = this.state.mapLayout[tilePos].rightSide === 'wall' ? ' right-wall' : '';
		const bottomSideClass = this.state.mapLayout[tilePos].bottomSide === 'wall' ? ' bottom-wall' : '';
		const leftSideClass = this.state.mapLayout[tilePos].leftSide === 'wall' ? ' left-wall' : '';
		const allClasses = topSideClass + rightSideClass + bottomSideClass + leftSideClass;
		const xPos = (this.state.mapLayout[tilePos].xPos * this.tileSize) + 'px';
		const yPos = (this.state.mapLayout[tilePos].yPos * this.tileSize) + 'px';
		const size = this.tileSize + 'px';
		const tileStyle = {
			transform: `translate(${xPos}, ${yPos})`,
			width: size,
			height: size
		};

		return (<Tile
			key={tilePos}
			styleProp={tileStyle}
			tileNameProp={this.state.mapLayout[tilePos].xPos + '-' + this.state.mapLayout[tilePos].yPos}
			classStrProp={allClasses}
			placePlayerProp={this.placePlayer}></Tile>);
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
				this.state.mapLayout[tileLoc][this.OPPOSITE_SIDE[playerMovementSide[0]]] === 'wall'
				// below is for possibly moving diagonally
				// || this.state.mapLayout[playerLoc][playerMovementSide[1]] === 'wall' ||
				// this.state.mapLayout[tileLoc][this.OPPOSITE_SIDE[playerMovementSide[1]]] === 'wall'
			)
			{
				invalidMove = true;
			}
		} else {
			// new position generated randomly
			const tileList = Object.keys(this.state.mapLayout);
			const randomIndex = Math.floor(Math.random() * tileList.length);
			tileLoc = tileList[randomIndex];
			coords = tileLoc.split('-');
		}

		if (!invalidMove) {
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

			const visitedTile = `${coords[0]}-${coords[1]}`;
			if (!this.state.playerVisited[visitedTile]) {
				this.setState(prevState => ({
					playerVisited: {
						...prevState.playerVisited,
						[visitedTile]: {
							xPos: +coords[0],
							yPos: +coords[1]
						}
					}
				}));
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
			this.resetMap();
		}
	}

	addLighting() {
		let tiles = [];
		const playerPosStr = `${this.state.playerPos.xPos}-${this.state.playerPos.yPos}`;

		for (const tilePos of Object.keys(this.state.mapLayout)) {
			let allClasses = 'light-tile';

			// these tiles are not assigned to anything (and shouldn't - they have the points data)
			let lineOfSightTiles = this.unblockedPathsToNearbyTiles(playerPosStr);
			if (tilePos === playerPosStr) {
				allClasses += ' bright-light bright-yellow-light';
			} else if (lineOfSightTiles.oneAway[tilePos]) {
				allClasses += ' high-light yellow-light';
			} else if (lineOfSightTiles.twoAway[tilePos]) {
				allClasses += ' med-light yellow-light';
			} else if (lineOfSightTiles.threeAway[tilePos]) {
				allClasses += ' low-light yellow-light';
			} else if (this.state.playerVisited[tilePos]) {
				allClasses += ' low-light black-light';
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
				classStrProp={allClasses}></LightElement>);
		}
		return tiles;
	}

	// Find all tiles out to 3 rings surrounding center,
	// then find tiles of those that have unblocked lines of sight(LOS) to the center
	unblockedPathsToNearbyTiles(centerTilePos) {
		const centerTile = this.state.mapLayout[centerTilePos];
		let nearbyTiles = {oneAway: {}, twoAway: {}, threeAway: {}};
		let lineOfSightTiles = {oneAway: {}, twoAway: {}, threeAway: {}};

		// collect all tiles that are 1-3 tiles away from center
		for (const [tilePos, tileData] of Object.entries(this.state.mapLayout)) {
			const currentTile = this.state.mapLayout[tilePos];
			const horizDelta = Math.abs(centerTile.xPos - currentTile.xPos);
			const vertDelta = Math.abs(centerTile.yPos - currentTile.yPos);
			if (horizDelta <= 1 && vertDelta <= 1) {
				nearbyTiles.oneAway[tilePos] = tileData;
			} else if (horizDelta <= 2 && vertDelta <= 2) {
				nearbyTiles.twoAway[tilePos] = tileData;
			} else if (horizDelta <= 3 && vertDelta <= 3) {
				nearbyTiles.threeAway[tilePos] = tileData;
			}
		}

		// uses point system - a tile has a point for each value of delta (if x delta is 2 and y is 1, points = 3)
		// tile must have points -1 number of connected lineOfSight tiles to be line of sight
		// corner tiles must always be examined last

		// find tiles among closest to center that have line of sight to center
		for (const [oneAwayTilePos, oneAwayTileData] of Object.entries(nearbyTiles.oneAway)) {
			const adjacentSides = this.getSidesBetweenAdjacentTiles(centerTilePos, oneAwayTilePos);
			const setOneOfSidesNotWalls = centerTile[adjacentSides[0]] !== 'wall' &&
				oneAwayTileData[this.OPPOSITE_SIDE[adjacentSides[0]]] !== 'wall';
			const setTwoOfSidesNotWalls = centerTile[adjacentSides[1]] !== 'wall' &&
				oneAwayTileData[this.OPPOSITE_SIDE[adjacentSides[1]]] !== 'wall';
			if (adjacentSides.length === 1 && setOneOfSidesNotWalls) {
				// TODO: put points data in separate object

				lineOfSightTiles.oneAway[oneAwayTilePos] = {...oneAwayTileData, points: 1};
			} else if (adjacentSides.length === 2 && setOneOfSidesNotWalls && setTwoOfSidesNotWalls) {
				lineOfSightTiles.oneAway[oneAwayTilePos] = {...oneAwayTileData, points: 2};
			}
		}

		// now find tiles two tiles from center that have line of sight
		for (const [twoAwayTilePos, twoAwayTileData] of Object.entries(nearbyTiles.twoAway)) {
			for (const [oneAwayTilePos, oneAwayTileData] of Object.entries(lineOfSightTiles.oneAway)) {
				const lineOfSightSides = [];
				const deltaX = Math.abs(twoAwayTileData.xPos - oneAwayTileData.xPos);
				const deltaY = Math.abs(twoAwayTileData.yPos - oneAwayTileData.yPos);
				// if one of the 1 away tiles that has line of sight is between the current 2 away tile and center tile...
				if (deltaX <= 1 && deltaY <= 1) {
					// add their in-between sides to the list...
					lineOfSightSides.push(...this.getSidesBetweenAdjacentTiles(oneAwayTilePos, twoAwayTilePos));
				}

				const setOneOfSidesNotWalls = oneAwayTileData[lineOfSightSides[0]] !== 'wall' &&
					twoAwayTileData[this.OPPOSITE_SIDE[lineOfSightSides[0]]] !== 'wall';
				const setTwoOfSidesNotWalls = oneAwayTileData[lineOfSightSides[1]] !== 'wall' &&
					twoAwayTileData[this.OPPOSITE_SIDE[lineOfSightSides[1]]] !== 'wall';
				const middleTileHasLOS = lineOfSightTiles.oneAway[oneAwayTilePos];

				// then check if any of those sides are blocked by walls

				// only 1 matching side means outer and middle tiles are adjacent
				if (lineOfSightSides.length === 1 && setOneOfSidesNotWalls) {
					// 1 point means both tiles are in straight line from center
					if (middleTileHasLOS && middleTileHasLOS.points === 1) {
						lineOfSightTiles.twoAway[twoAwayTilePos] = {...twoAwayTileData, points: 2};
						// 2 points means middle tile is diagonal from center
					} else if (middleTileHasLOS && middleTileHasLOS.points === 2) {
						lineOfSightTiles.twoAway[twoAwayTilePos] = {...twoAwayTileData, points: 3};
					}

					// two matching sides means outer and middle tiles are diagonal
					// only need to check corner tile from set of tiles that are 1 away
				} else if (lineOfSightSides.length === 2 &&
					middleTileHasLOS && middleTileHasLOS.points === 2 &&
					setOneOfSidesNotWalls && setTwoOfSidesNotWalls)
				{
					lineOfSightTiles.twoAway[twoAwayTilePos] = {...twoAwayTileData, points: 4};
				}
			}
		}

		// now find tiles three tiles from center that have line of sight
		for (const [threeAwayTilePos, threeAwayTileData] of Object.entries(nearbyTiles.threeAway)) {
			for (const [twoAwayTilePos, twoAwayTileData] of Object.entries(lineOfSightTiles.twoAway)) {
				const lineOfSightSides = [];
				const deltaX = Math.abs(threeAwayTileData.xPos - twoAwayTileData.xPos);
				const deltaY = Math.abs(threeAwayTileData.yPos - twoAwayTileData.yPos);
				// if one of the 2 away tiles that has line of sight is between the current 3 away tile and center tile...
				if (deltaX <= 1 && deltaY <= 1) {
					// add their in-between sides to the list...
					lineOfSightSides.push(...this.getSidesBetweenAdjacentTiles(twoAwayTilePos, threeAwayTilePos));
				}

				const setOneOfSidesNotWalls = twoAwayTileData[lineOfSightSides[0]] !== 'wall' &&
					threeAwayTileData[this.OPPOSITE_SIDE[lineOfSightSides[0]]] !== 'wall';
				const setTwoOfSidesNotWalls = twoAwayTileData[lineOfSightSides[1]] !== 'wall' &&
					threeAwayTileData[this.OPPOSITE_SIDE[lineOfSightSides[1]]] !== 'wall';
				const middleTileHasLOS = lineOfSightTiles.twoAway[twoAwayTilePos];

				// then check if any of those sides are blocked by walls
				// don't need to save point data for these

				// only 1 matching side means outer and middle tiles are adjacent
				if ((lineOfSightSides.length === 1 && middleTileHasLOS && setOneOfSidesNotWalls) ||
					// two matching sides means outer and middle tiles are diagonal
					// only need to check corner tile from set of tiles that are 1 away
					(lineOfSightSides.length === 2 && middleTileHasLOS && middleTileHasLOS.points === 4 &&
						setOneOfSidesNotWalls && setTwoOfSidesNotWalls))
				{
					lineOfSightTiles.threeAway[threeAwayTilePos] = threeAwayTileData;
				}
			}
		}

		return lineOfSightTiles;
	}

	getSidesBetweenAdjacentTiles(centerTileLoc, adjTileLoc) {
		let sides = [];
		const adjTile = this.state.mapLayout[adjTileLoc];
		const centerTile = this.state.mapLayout[centerTileLoc];

		if (centerTile.xPos - adjTile.xPos === -1) {
			sides.push('rightSide');
		}
		if (centerTile.xPos - adjTile.xPos === 1) {
			sides.push('leftSide');
		}
		if (centerTile.yPos - adjTile.yPos === -1) {
			sides.push('bottomSide');
		}
		if (centerTile.yPos - adjTile.yPos === 1) {
			sides.push('topSide');
		}

		return sides;
	}

	placeExit = () => {
		const tilePositions = Object.keys(this.state.mapLayout);
		const exitPosition = tilePositions[Math.floor(Math.random() * tilePositions.length)];
		const exitCoords = exitPosition.split('-');
		this.setState({exitPosition: {xPos: +exitCoords[0], yPos: +exitCoords[1]}, exitPlaced: true});
	}

	setupKeyListeners() {
		document.addEventListener('keydown', (e) => {
			e.preventDefault();
			this.placePlayer('', e);
		});
	}

	resetMap = () => {
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
		this.layoutPieces();
	}

	componentDidUpdate(prevProps, prevState, snapShot) {

	}

	// Add below for testing: <button onClick={this.resetMap}>Reset</button>
	render() {
		const playerTransform = this.calculatePlayerTransform();
		return (
			<div className="world" style={{width: `${Math.floor(window.outerWidth/this.tileSize) * this.tileSize}px`}}>
				<div className="map" style={this.state.mapPosition}>
					{ this.state.mapLayoutDone &&
					<this.createAllPieces></this.createAllPieces>
					}
					{ this.state.exitPlaced &&
					<Exit styleProp={{transform: `translate(${this.state.exitPosition.xPos * this.tileSize}px, ${this.state.exitPosition.yPos * this.tileSize}px)`}} tileNameProp={this.state.exitPosition.xPos + '-' + this.state.exitPosition.yPos}></Exit>
					}
				</div>
				<div className="lighting" style={this.state.mapPosition}>
					{ this.state.playerPlaced &&
					<this.addLighting></this.addLighting>
					}
				</div>
				{ this.state.mapLayoutDone &&
				<Player dataLocProp={this.state.playerPos}
				        styleProp={{transform: `translate(${playerTransform.xPos}px, ${playerTransform.yPos}px)`}}/>
				}
			</div>
		);
	}
}

export default Map;
