import React from "react";

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
		this.activeWeapon = this.weapons[0] || null;
		this.items = props.items;
	}

	attack() {
		if (this.activeWeapon) {

		}
	}
}

export default Character;
