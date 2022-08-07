function rng() {
	const date = new Date().getTime();
	const dateToStr = date.toString();
	const randomIndex = Math.floor(Math.random() * dateToStr.length);
	return dateToStr[randomIndex] * .1;
}

export {rng};
