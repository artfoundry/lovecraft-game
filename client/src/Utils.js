export function convertCamelToKabobCase(str) {
	return str.replace(/([A-Z])/g, match => ('-' + match.toLowerCase()));
}

export function removeIdNumber(id) {
	const numberInID = id.search(/\d/);
	const idEndIndex = numberInID > -1 ? numberInID : id.length;
	return id.substring(0, idEndIndex);
}

export function convertObjIdToClassId(id) {
	return convertCamelToKabobCase(removeIdNumber(id));
}

export function capitalizeWord(word) {
	return word[0].toUpperCase() + word.substring(1);
}

export function convertPosToCoords(pos) {
	const coordArr = pos.split('-').map(val => parseInt(val));
	return {xPos: coordArr[0], yPos: coordArr[1]};
}

export function convertCoordsToPos(coords) {
	return `${coords.xPos}-${coords.yPos}`;
}

export function getDistanceBetweenTargets(coords1, coords2) {
	const xDelta = Math.abs(coords1.xPos - coords2.xPos);
	const yDelta = Math.abs(coords1.yPos - coords2.yPos);
	return xDelta > yDelta ? xDelta : yDelta;
}

export function articleType(word, isCapital = false) {
	const vowels = ['a', 'e', 'i', 'o', 'u'];
	const firstLetter = word.substring(0,1);
	const articleFirstLetter = isCapital ? 'A' : 'a';
	return articleFirstLetter + (vowels.includes(firstLetter) ? 'n' : '');
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
 * Rounds decimal numbers toward 0 (since Math.floor rounds neg numbers away from 0)
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

// for saving data to firebase, can't save values of undefined, FB removes values of null, and don't need to save functions
export function deepCopy(object, savingForFB = false) {
	let objectCopy = null;

	if (Array.isArray(object)) {
		objectCopy = [];
		object.forEach((arrayItem, index) => {
			objectCopy[index] = deepCopy(arrayItem, savingForFB);
		});
	} else if (savingForFB && object === undefined) {
		objectCopy = 'undefined';
	} else if (savingForFB && typeof object === 'function') {
		// use default value of null (which means FB won't save it)
	} else if (savingForFB && object === null) {
		objectCopy = 'null';
	} else if (!object || typeof object !== 'object') {
		objectCopy = object === 'undefined' ? undefined : object === 'null' ? null : object === 'emptyObject' ? {} : object;
	} else {
		objectCopy = {};
		for (const [key, value] of Object.entries(object)) {
			if (savingForFB && value === undefined) {
				objectCopy[key] = 'undefined';
			} else if (savingForFB && typeof value === 'function') {
				objectCopy[key] = null;
			} else if (savingForFB && value === null) {
				objectCopy[key] = 'null';
			} else {
				objectCopy[key] = typeof value === 'object' ?
					deepCopy(value, savingForFB) : value === 'undefined' ?
					undefined : value === 'null' ?
					null : value === 'emptyObject' ?
					{} : value;
			}
		}
		if (savingForFB && Object.keys(objectCopy).length === 0) {
			objectCopy = 'emptyObject';
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
