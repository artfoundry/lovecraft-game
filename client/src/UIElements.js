import React, {useRef} from 'react';

let weaponRefs = {};

function CharacterControls(props) {
	weaponRefs[props.characterId] = useRef([]);
	let weaponButtonState = '';
	weaponRefs[props.characterId].current = props.weaponsProp.map((weaponName, index) => {
		return weaponRefs[props.characterId].current[index] || React.createRef();
	});
	const weapons = (
		<div className='weapon-buttons-container'>
			{props.weaponsProp.map((weaponName, index) => {
				weaponButtonState = (!props.isActiveCharacter || props.actionsRemaining === 0) ? ' button-inactive' :
					(props.weaponButtonSelected.characterId === props.characterId && props.weaponButtonSelected.weaponName === weaponName) ? ' button-selected': '';
				return (
					<div ref={weaponRefs[props.characterId].current[index]} data-weapon={weaponName} className={'weapon-button' + weaponButtonState} key={weaponName} onClick={() => {
						props.toggleWeaponButton(props.characterId, weaponName);
					}}>{weaponName}</div>
				);
			})}
		</div>
	);

	return (
		<div className='character-control-container'>
			<div className='character-name font-fancy'>{props.characterName}</div>
			<div>Moves remaining: {props.isActiveCharacter ? props.movesRemaining : ''}</div>
			<div>Actions remaining: {props.isActiveCharacter ? props.actionsRemaining : ''}</div>
			{weapons}
		</div>
	);
}

function CharacterInfoPanel(props) {
	const skillList = Object.values(props.characterInfo.skills).map(item => <li key={item + Math.random()}>{item}</li>);
	const weaponList = Object.values(props.characterInfo.weapons).map(item => <li key={item + Math.random()}>{item}</li>);
	const itemList = Object.values(props.characterInfo.items).map(item => <li key={item + Math.random()}>{item}</li>);
	return (
		<div className={`character-info-container ui-panel ${props.characterIsSelected ? '' : 'hide'}`}>
			<div className='general-button' onClick={() => props.updateUnitSelectionStatus(props.characterInfo.id, 'player')}>X</div>
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
			<div>Defense: {props.characterInfo.defense}{props.characterInfo.items.armor ? ` from ${props.characterInfo.items.armor}` : ''}</div>
			<div>Weapons:
				<ul>{weaponList}</ul>
			</div>
			<div>Items:
				<ul>{itemList}</ul>
			</div>
			<div>Equipped Light: {props.characterInfo.equippedLight}</div>
		</div>
	);
}

function CreatureInfoPanel(props) {
	return (
		<div className={`creature-info-container ui-panel ${props.creatureIsSelected ? '' : 'hide'}`}>
			<div className='general-button' onClick={() => props.updateUnitSelectionStatus(props.creatureInfo.id, 'creature')}>X</div>
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
			<div>Perception: {props.creatureInfo.perception}</div>
		</div>
	);
}

function ModeInfoPanel(props) {
	const ListOptions = () => {
		let list = [];
		for (const [id, player] of Object.entries(props.players)) {
			list.push(<option key={id} value={id}>{player.name}</option>);
		}
		return list;
	};
	const cantToggleCombatDialog = {
		dialogContent: "You can't disable Tactical Mode with creatures still about!",
		closeButtonText: 'Ok',
		closeButtonCallback: null,
		disableCloseButton: false,
		actionButtonVisible: false,
		actionButtonText: '',
		actionButtonCallback:  null,
		dialogClasses: ''
	};
	const turnButtonState = props.isInCombat ? '' : ' button-inactive';
	const charactersTurn = props.isInCombat && (props.players[props.activeCharacter] ? props.players[props.activeCharacter].name : 'Enemies moving...');

	return (
		<div>
			<div
				className={`general-button ${props.isInCombat ? 'button-tactical-mode-on' : ''}`}
				onClick={() => {
					if (props.isInCombat) {
						if (props.threatList.length > 0) {
							props.setShowDialogProps(true, cantToggleCombatDialog);
						} else {
							props.toggleCombat(false);
						}
					} else {
						props.toggleCombat(true);
					}
				}}>
				{props.isInCombat ? 'Tactical Mode' : 'Follow Mode'}
			</div>
			{!props.isInCombat &&
				<label>
					<span>Leader: </span>
					<select name='leader' value={props.activeCharacter} onChange={e => {
						props.updateActiveCharacter(null, e.target.value);
					}}>
						{props.players && <ListOptions />}
					</select>
				</label>
			}
			<div>Turn: {charactersTurn}</div>
			<div className={'general-button' + turnButtonState} onClick={() => {
				let weaponName = '';
				const activeButton = weaponRefs[props.activeCharacter].current.find(weapon => {
					weaponName = weapon.current.dataset['weapon'];
					return weapon.current.classList.contains('button-selected');
				});
				if (activeButton) {
					props.toggleWeaponButton(props.activeCharacter, weaponName, props.endTurnCallback);
				} else {
					props.endTurnCallback();
				}
			}}>End Turn</div>
		</div>
	);
}

function DialogWindow(props) {
	return (
		<div className={`dialog ui-panel ${props.classes}`}>
			<div className='dialog-message'>{props.dialogContent}</div>
			<div className='dialog-buttons'>
				{!props.disableCloseButton &&
				<button
					className='dialog-button'
			        onClick={() => {
				        props.closeDialogCallback();
						if (props.closeButtonCallback) {
							props.closeButtonCallback();
						}
					}}>
					{props.closeButtonText}
				</button> }
				<button
					className={`dialog-button ${props.actionButtonVisible ? '' : 'hide'}`}
					onClick={() => {
						props.closeDialogCallback();
						if (props.actionButtonCallback) {
							props.actionButtonCallback();
						}
					}}>
					{props.actionButtonText}
				</button>
			</div>
		</div>
	);
}

export {CharacterControls, CharacterInfoPanel, CreatureInfoPanel, ModeInfoPanel, DialogWindow};
