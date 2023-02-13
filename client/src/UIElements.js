import React, {useState} from 'react';

function CharacterControls(props) {
	const [buttonState, updateButtonState] = useState('');
	const [waitingTurn, updateWaiting] = useState(false); // to allow time for dom to update End Turn button purely for visual feedback; may not need later
	let weapons = [];
	props.weaponsProp.forEach(weaponName => {
		let buttonStateClass = '';
		if (props.weaponButtonSelected.characterId === props.characterId && props.weaponButtonSelected.weaponName === weaponName) {
			buttonStateClass = ' button-selected';
		}
		weapons.push(
			<div className={'weapon-button' + buttonStateClass} key={weaponName} onClick={() => {
				props.toggleWeaponButton(props.characterId, weaponName);
			}}>{weaponName}</div>
		);
	});
	if (props.isActiveCharacter && !waitingTurn && buttonState === ' button-inactive') {
		updateButtonState('');
	}
	return (
		<div className='character-control-container'>
			<div className='character-name'>{props.characterName}</div>
			<div className='weapon-buttons-container'>{weapons}</div>
			<div className={'general-button' + buttonState} onClick={() => {
				updateButtonState(' button-inactive');
				updateWaiting(true);
				props.endTurnCallback();
				setTimeout(() => {
					updateWaiting(false);
				}, 1000);
			}}>End Turn</div>
		</div>
	);
}

function CharacterInfoPanel(props) {
	const skillList = Object.values(props.characterInfo.skills).map(item => <li key={item + Math.random()}>{item}</li>);
	const weaponList = Object.values(props.characterInfo.weapons).map(item => <li key={item + Math.random()}>{item}</li>);
	const itemList = Object.values(props.characterInfo.items).map(item => <li key={item + Math.random()}>{item}</li>);
	return (
		<div className={`character-info-container ui-panel ${props.characterIsSelected ? '' : 'hide'}`}>
			<div>Name: {props.characterInfo.name}</div>
			<div>Profession: {props.characterInfo.profession}</div>
			<div>Level: {props.characterInfo.level}</div>
			<div>XP: {props.characterInfo.xp}</div>
			<div>Strength: {props.characterInfo.strength}</div>
			<div>Agility: {props.characterInfo.agility}</div>
			<div>Mental Acuity: {props.characterInfo.mentalAcuity}</div>
			<div>Initiative: {props.characterInfo.initiative}</div>
			<div>Health: {props.characterInfo.currentHP} / {props.characterInfo.startingHP}</div>
			<div>Sanity: {props.characterInfo.currentSanity} / {props.characterInfo.startingSanity}</div>
			<div>Skills:
				<ul>{skillList}</ul>
			</div>
			<div>Weapons:
				<ul>{weaponList}</ul>
			</div>
			<div>Items:
				<ul>{itemList}</ul>
			</div>
		</div>
	);
}

function CreatureInfoPanel(props) {
	return (
		<div className={`creature-info-container ui-panel ${props.creatureIsSelected ? '' : 'hide'}`}>
			<div>Name: {props.creatureInfo.name}</div>
			<div>Level: {props.creatureInfo.level}</div>
			<div>Health: {props.creatureInfo.currentHP} / {props.creatureInfo.startingHP}</div>
			<div>Strength: {props.creatureInfo.strength}</div>
			<div>Agility: {props.creatureInfo.agility}</div>
			<div>Mental Acuity: {props.creatureInfo.mentalAcuity}</div>
			<div>Initiative: {props.creatureInfo.initiative}</div>
			<div>Defense: {props.creatureInfo.defense}</div>
			<div>Damage: {props.creatureInfo.damage}</div>
			<div>Range: {props.creatureInfo.range}</div>
			<div>Speed: {props.creatureInfo.moveSpeed}</div>
		</div>
	);
}

function DialogWindow(props) {
	return (
		<div className={`dialog ui-panel ${props.classes}`}>
			<div className="dialog-message">{props.dialogText}</div>
			<div className="dialog-buttons">
				{!props.disableCloseButton &&
				<button className="dialog-button"
				        onClick={() => {
							props.closeButtonCallback();
						}}>
					{props.closeButtonText}
				</button> }
				<button
					className={`dialog-button ${props.actionButtonVisible ? '' : 'hide'}`}
					onClick={() => {
						props.actionButtonCallback();
						props.closeButtonCallback();
					}}>
					{props.actionButtonText}
				</button>
			</div>
		</div>
	);
}

export {CharacterControls, CharacterInfoPanel, CreatureInfoPanel, DialogWindow};
