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

function DialogWindow(props) {
	return (
		<div className={`dialog ui-panel ${props.classes}`}>
			<div className="dialog-message">{props.dialogText}</div>
			<div className="dialog-buttons">
				<button className="dialog-button"
				        onClick={() => {
							props.closeButtonCallback();
						}}>
					{props.closeButtonText}
				</button>
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

export {CharacterControls, DialogWindow};
