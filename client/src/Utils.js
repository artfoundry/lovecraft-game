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

export function convertCoordsToPos(coords) {
	return `${coords.xPos}-${coords.yPos}`;
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

export function notEnoughSpaceInInventory(numItemsMovingIntoInv, numItemsMovingOutOfInv, currentPCdata) {
	const loadout1Items = currentPCdata.equippedItems.loadout1;
	const maxInvSize = currentPCdata.maxItems;
	let numEquippedItems = 0;
	// if equipped with a two handed weapon or just 1 item
	if ((loadout1Items.right && loadout1Items.left && loadout1Items.right === loadout1Items.left) ||
		(!loadout1Items.right && loadout1Items.left) || (loadout1Items.right && !loadout1Items.left))
	{
		numEquippedItems = 1;
		// otherwise if equipped with two separate items
	} else if (loadout1Items.right && loadout1Items.left) {
		numEquippedItems = 2;
	}
	const playerInvCount = Object.keys(currentPCdata.items).length + Object.keys(currentPCdata.weapons).length - numEquippedItems
	return (playerInvCount + numItemsMovingIntoInv - numItemsMovingOutOfInv) > maxInvSize;
}

export function handleItemOverDropZone(evt) {
	evt.preventDefault();
	evt.dataTransfer.dropEffect = 'move';
}

export function deepCopy(object) {
	let objectCopy = null;

	if (Array.isArray(object)) {
		objectCopy = [];
		object.forEach((arrayItem, index) => {
			objectCopy[index] = deepCopy(arrayItem);
		});
	} else if (!object || typeof object !== 'object') {
		objectCopy = object;
	} else {
		objectCopy = {};
		for (const [key, value] of Object.entries(object)) {
			objectCopy[key] = typeof value === 'object' ? deepCopy(value) : value;
		}
	}

	return objectCopy;
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
