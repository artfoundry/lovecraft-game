export function convertCamelToKabobCase(str) {
	return str.replace(/([A-Z])/g, match => ('-' + match.toLowerCase()));
}

export function convertObjIdToClassId(id) {
	const numberInID = id.search(/\d/);
	const idEndIndex = numberInID > -1 ? numberInID : id.length;
	return convertCamelToKabobCase(id.substring(0, idEndIndex));
}

export function convertPosToCoords(pos) {
	const coordArr = pos.split('-').map(val => parseInt(val));
	return {xPos: coordArr[0], yPos: coordArr[1]};
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
 * Rounds numbers toward 0 (since Math.floor rounds neg numbers away from 0)
 * @param value: decimal number
 * @returns {number}
 */
export function roundTowardZero(value) {
	const sign = value < 0 ? -1 : 1;
	return Math.floor(Math.abs(value)) * sign;
}

// just for testing purposes
export function placeTileDotForTesting(coords) {
	let dot = document.createElement('div');
	dot.style.backgroundColor = 'yellow';
	dot.style.width = '10px';
	dot.style.height = '10px';
	dot.style.position = 'absolute';
	dot.style.transform = `translate(${coords.xPos*this.tileSize}px, ${coords.yPos*this.tileSize}px)`;
	document.querySelector('body').appendChild(dot);
}
