function rng() {
	const date = new Date().getTime();
	const dateToStr = date.toString();
	const randomIndex = Math.floor(Math.random() * dateToStr.length);
	return dateToStr[randomIndex] * .1;
}

function randomTileVariant() {
	const types = [
		'-one',
		'-two',
		'-three',
		'-four'
	];
	return types[Math.floor(Math.random() * types.length)];
}

export {rng, randomTileVariant};
