import React from "react";
import WeaponTypes from './weaponTypes.json';
import {diceRoll} from './Utils';

class Character extends React.Component {
	constructor(props) {
		super(props);

		this.name = props.name;
		this.type = props.type;
		this.profession = props.profession;
		this.strenth = props.strenth;
		this.agility = props.agility;
		this.mentalAcuity = props.mentalAcuity;
		this.initiative = props.initiative;
		this.startingHP = props.startingHP;
		this.startingSanity = props.startingSanity;
		this.skills = props.skills;
		this.weapons = props.weapons;
		this.items = props.items;
	}

	attack(weapon, target) {
		let isHit = false;
		let rangedStrHitModifier = WeaponTypes[weapon].attackType === 'manual' ? this.strenth / 2 : 0;
		let damage = 0;

		if (WeaponTypes[weapon].ranged) {
			isHit = this.agility + rangedStrHitModifier + diceRoll(20) >= target.defense + diceRoll(20);
		}
	}
}

export default Character;
