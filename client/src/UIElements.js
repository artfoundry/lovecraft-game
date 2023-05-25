import React, {useRef} from 'react';

let weaponRefs = {};

function CharacterControls(props) {
	weaponRefs[props.characterId] = useRef([]);
	let weaponButtonState = '';
	const weaponsList = [];
	for (const [weaponId, weaponInfo] of Object.entries(props.weapons)) {
		if (weaponInfo.equipped) {
			if (weaponInfo.ranged) {
				if (weaponInfo.gunType) {
					weaponsList.push({weaponId, weaponName: weaponInfo.name, isGun: true, ammo: props.ammo[weaponInfo.gunType]});
				// check to make sure this weapon isn't already in the controls and has some ammo
				} else if (!weaponsList.find(listItem => listItem.weaponName === weaponInfo.name) && props.ammo.stackable[weaponInfo.name] > 0) {
					weaponsList.push({weaponId, weaponName: weaponInfo.name, ammo: props.ammo.stackable[weaponInfo.name]});
				}
			} else {
				weaponsList.push({weaponId, weaponName: weaponInfo.name, ammo: -1});
			}
		}
	}
	weaponRefs[props.characterId].current = weaponsList.map((weapon, index) => {
		return weaponRefs[props.characterId].current[index] || React.createRef();
	});
	const weapons = (
		<div className='weapon-buttons-container'>
			{weaponsList.map((weapon, index) => {
				weaponButtonState = (!props.isActiveCharacter || props.actionsRemaining === 0 || (weapon.ammo === 0)) ? ' button-inactive' :
					(props.weaponButtonSelected.characterId === props.characterId && props.weaponButtonSelected.weaponId === weapon.weaponId) ? ' button-selected': '';
				return (
					<div ref={weaponRefs[props.characterId].current[index]} className={'weapon-button' + weaponButtonState} key={weapon.weaponId} onClick={() => {
						props.toggleWeaponButton(props.characterId, weapon.weaponId, weapon.weaponName);
					}}>{weapon.weaponName}{weapon.ammo >= 0 ? ': ' + weapon.ammo : ''}{weapon.isGun ? ' round(s)': ''}</div>
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
	const parseItems = (items, listType, stackableWeapons = null) => {
		let list = [];
		let stackablesAdded = []; // prevents listing multiple copies of same stackable weapon

		if (listType === 'ammo') {
			for (const [type, amount] of Object.entries(items)) {
				list.push(<li key={type + Math.random()}>{type}: {amount} rounds</li>)
			}
		} else {
			for (const [itemId, itemInfo] of Object.entries(items)) {
				if (listType === 'weapon') {
					// guns
					if (itemInfo.gunType) {
						list.push(<li key={itemId}>{itemInfo.name}</li>);
					// stackable non-gun weapons
					} else if (stackableWeapons && stackableWeapons[itemInfo.name] > 0 && !stackablesAdded[itemInfo.name]) {
						list.push(<li key={itemId}>{itemInfo.name}: {stackableWeapons[itemInfo.name]}</li>);
						stackablesAdded.push(itemInfo.name);
					// non-stackable non-gun weapons (usually melee weapons)
					} else if (!stackableWeapons) {
						list.push(<li key={itemId}>{itemInfo.name}</li>);
					}
				// lights
				} else if (itemInfo.itemType === 'Light') {
					list.push(<li key={itemId}>{itemInfo.name} (Time left: {itemInfo.time})</li>);
				// other unique items/non-gun weapons
				} else {
					list.push(<li key={itemId}>{itemInfo.name}</li>);
				}
			}
		}
		return list;
	};
	const skillList = Object.values(props.characterInfo.skills).map(item => <li key={item + Math.random()}>{item}</li>);
	const weaponList = parseItems(props.characterInfo.weapons, 'weapon', props.characterInfo.ammo.stackable);
	const gunAmmo = {...props.characterInfo.ammo};
	delete gunAmmo.stackable;
	const ammoList = parseItems(gunAmmo, 'ammo');
	const itemList = parseItems(props.characterInfo.items, 'item');
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
			<div>
				Ammunition:
				<ul>{ammoList}</ul>
			</div>
			<div>Items:
				<ul>{itemList}</ul>
			</div>
			<div>Equipped Light: {props.characterInfo.items[props.characterInfo.equippedLight].name}</div>
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
	const enemiesNearbyDialog = {
		dialogContent: "You can't disable Tactical Mode with creatures still about!",
		closeButtonText: 'Ok',
		closeButtonCallback: null,
		disableCloseButton: false,
		actionButtonVisible: false,
		actionButtonText: '',
		actionButtonCallback:  null,
		dialogClasses: ''
	};
	const partyNotNearbyDialog = {
		dialogContent: "Your party must all be in sight of each other to enable Follow mode",
		closeButtonText: 'Ok',
		closeButtonCallback: null,
		disableCloseButton: false,
		actionButtonVisible: false,
		actionButtonText: '',
		actionButtonCallback:  null,
		dialogClasses: ''
	}
	const turnButtonState = props.isInCombat || !props.isPartyNearby ? '' : ' button-inactive';
	const activePlayerObject = props.players[props.activeCharacter];
	const charactersTurn = activePlayerObject && (props.isInCombat || !props.isPartyNearby) ? activePlayerObject.name :
		props.isInCombat && props.threatList.length > 0 ? 'Enemies moving...' : 'Something creeps deep in the darkness...';

	return (
		<div>
			<div
				className={`general-button ${props.isInCombat || !props.isPartyNearby ? 'button-tactical-mode-on' : ''}`}
				onClick={() => {
					if (props.isInCombat) {
						if (props.threatList.length > 0) {
							props.setShowDialogProps(true, enemiesNearbyDialog);
						} else if (!props.isPartyNearby) {
							props.setShowDialogProps(true, partyNotNearbyDialog);
						} else {
							props.toggleCombat(false);
						}
					} else if (!props.isPartyNearby) {
						props.setShowDialogProps(true, partyNotNearbyDialog);
					} else {
						props.toggleCombat(true);
					}
				}}>
				{props.isInCombat || !props.isPartyNearby ? 'Tactical Mode' : 'Follow Mode'}
			</div>
			{!props.isInCombat && props.isPartyNearby &&
				<label>
					<span>Leader: </span>
					<select name='leader' value={props.activeCharacter} onChange={e => {
						props.updateActiveCharacter(null, e.target.value);
					}}>
						{props.players && <ListOptions />}
					</select>
				</label>
			}
			{(props.isInCombat || !props.isPartyNearby) &&
				<div>
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
			}
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
