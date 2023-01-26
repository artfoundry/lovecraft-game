import React, {useState} from 'react';

function CharacterControls(props) {
	let weapons = [];
	props.weaponsProp.forEach(weapon => {
		let buttonStateClass = '';
		if (props.weaponButtonSelectedProp.characterName === props.characterNameProp && props.weaponButtonSelectedProp.weapon === weapon) {
			buttonStateClass = ' button-selected';
		}
		weapons.push(
			<div className={'weapon-button' + buttonStateClass} key={weapon} onClick={() => {
				props.toggleWeaponButtonProp(props.characterNameProp, weapon);
			}}>{weapon}</div>
		);
	});
	return (
		<div className='character-control-container'>
			<div className='character-name'>{props.characterNameProp}</div>
			<div className='weapon-buttons-container'>{weapons}</div>
		</div>
	);
}

export {CharacterControls};
