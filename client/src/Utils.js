export function convertCamelToKabobCase(str) {
	return str.replace(/([A-Z])/g, match => ('-' + match.toLowerCase()));
}

export function diceRoll(range) {
	return Math.ceil(Math.random() * range);
}

export function randomTileVariant() {
	const types = [
		'-one',
		'-two',
		'-three',
		'-four'
	];
	return types[Math.floor(Math.random() * types.length)];
}

// returns 0, 1, or -1;
export function randomTileMovementValue() {
	return Math.round(Math.random()) * (Math.round(Math.random()) === 0 ? 1 : -1);
}

/**
 * Find all tiles out to 'range' number of rings surrounding center,
 * then find tiles of those that have unblocked lines of sight(LOS) to the center
 * @param mapLayout {object} : map layout from state
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
 */
export function unblockedPathsToNearbyTiles(mapLayout, centerTilePos, range) {
	const centerTile = mapLayout[centerTilePos];
	const numToStr = [null, 'one', 'two', 'three', 'four', 'five'];
	let nearbyTiles = {};
	let lineOfSightTiles = {};
	let minXBoundary = (centerTile.xPos - range) < 0 ? 0 : centerTile.xPos - range;
	let minYBoundary = (centerTile.yPos - range) < 0 ? 0 : centerTile.yPos - range;

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
			const currentTile = mapLayout[tilePos];
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
