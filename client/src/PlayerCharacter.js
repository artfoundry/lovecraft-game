import React from 'react';

export default class PlayerCharacter extends React.Component {
	constructor() {
		super();

		this.state = {
			profession: '',
			stats: {
				experience: 0,
				health: 0,
				sanity: 0,
				fear: 0,
				str: 0,
				dex: 0,
				int: 0,
				physRes: 0,
				mentalRes: 0,
				movement: 0,
				range: 0
			},
			inventory: {},
			wearing: {
				weapon: {},
				armor: {}
			},
			abilities: {},
			currentQuests: {}

		}
	}

	attack() {

	}

	useAbility() {

	}

	changeStat(stat, value) {

	}

}
