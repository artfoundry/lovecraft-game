import React from 'react';

class Creature extends React.Component {
	constructor(props) {
		super(props);

		this.name = props.name;
		this.type = props.type;
		this.level = props.level;
		this.strength = props.strength;
		this.agility = props.agility;
		this.mentalAcuity = props.mentalAcuity;
		this.initiative = props.initiative;
		this.damage = props.damage;
		this.defense = props.defense;
		this.startingHP = props.startingHP;
		this.currentHP = props.startingHP;
		this.range = props.range;
		this.moveSpeed = props.moveSpeed;
	}

	attack() {

	}
}

export default Creature;
