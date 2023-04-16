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
