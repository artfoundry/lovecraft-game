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
 * Find all tiles out to 3 rings surrounding center,
 * then find tiles of those that have unblocked lines of sight(LOS) to the center
 * @param mapLayout {object} : map layout from state
 * @param centerTilePos {string} : position of player (ex. '1-2')
 * @returns {
 *  {
 *      oneAway: {floors: {tilePosString: {xPos, yPos}}, walls: {tilePosString: {xPos, yPos}}},
 *      twoAway: {floors: {tilePosString: {xPos, yPos}}, walls: {tilePosString: {xPos, yPos}}},
 *      threeAway: {floors: {tilePosString: {xPos, yPos}}, walls: {tilePosString: {xPos, yPos}}}
 *  }
 * }
 */
export function unblockedPathsToNearbyTiles(mapLayout, centerTilePos) {
	const centerTile = mapLayout[centerTilePos];
	let nearbyTiles = {
		twoAway: {floors: {}, walls: {}},
		threeAway: {floors: {}, walls: {}}
	};
	let lineOfSightTiles = {
		oneAway: {floors: {}, walls: {}},
		twoAway: {floors: {}, walls: {}},
		threeAway: {floors: {}, walls: {}}
	};
	let minXBoundary = (centerTile.xPos - 3) < 0 ? 0 : centerTile.xPos - 3;
	let minYBoundary = (centerTile.yPos - 3) < 0 ? 0 : centerTile.yPos - 3;

	// collect all tiles that are 1-3 tiles away from center
	for (let xCount = minXBoundary; xCount <= centerTile.xPos + 3; xCount++) {
		for (let yCount = minYBoundary; yCount <= centerTile.yPos + 3; yCount++) {
			const tilePos = xCount + '-' + yCount;
			const currentTile = mapLayout[tilePos];
			if (currentTile && tilePos !== centerTilePos) {
				const horizDeltaFromCenter = Math.abs(centerTile.xPos - currentTile.xPos);
				const vertDeltaFromCenter = Math.abs(centerTile.yPos - currentTile.yPos);

				if (horizDeltaFromCenter <= 1 && vertDeltaFromCenter <= 1) {
					if (currentTile.type === 'wall' || (currentTile.type === 'door' && !currentTile.doorIsOpen)) {
						lineOfSightTiles.oneAway.walls[tilePos] = currentTile;
					} else {
						lineOfSightTiles.oneAway.floors[tilePos] = currentTile;
					}
				} else if (horizDeltaFromCenter <= 2 && vertDeltaFromCenter <= 2) {
					if (currentTile.type === 'wall' || (currentTile.type === 'door' && !currentTile.doorIsOpen)) {
						nearbyTiles.twoAway.walls[tilePos] = currentTile;
					} else {
						nearbyTiles.twoAway.floors[tilePos] = currentTile;
					}
				} else if (horizDeltaFromCenter <= 3 && vertDeltaFromCenter <= 3) {
					if (currentTile.type === 'wall' || (currentTile.type === 'door' && !currentTile.doorIsOpen)) {
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
				if (twoAwayTileData.type === 'wall' || (twoAwayTileData.type === 'door' && !twoAwayTileData.doorIsOpen)) {
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
					if (threeAwayTileData.type === 'wall' || (threeAwayTileData.type === 'door' && !threeAwayTileData.doorIsOpen)) {
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
