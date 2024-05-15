import React from 'react';
import Firebase from './Firebase';
import CharacterCreation from './CharacterCreation';
import Map from './Map';
import Character from './Character';
import PlayerCharacterTypes from './data/playerCharacterTypes.json';
import WeaponTypes from './data/weaponTypes.json';
import ItemTypes from './data/itemTypes.json';
import UI from './UI';
import './css/app.css';
import {diceRoll, deepCopy, convertCoordsToPos} from './Utils';

class Game extends React.Component {
	constructor(props) {
		super(props);

		// for testing
		this.testAttr = this.props.testAttributes;
		this.showLogin = this.testAttr.showLogin;
		this.showCharacterCreation = this.testAttr.showCharacterCreation;
		this.startingPlayerCharacters = !this.showCharacterCreation ? this.testAttr.startingCharacters : null;
		this.startingLocation = this.testAttr.startingLocation;

		this.initialDialogContent = '';
		this.playerMovesLimit = 3;
		this.playerActionsLimit = 2;
		this.playerInventoryLimit = 12;
		this.maxTurnsToReviveDeadPlayer = 3;

		this.minScreenWidthForSmall = 1000;
		this.minScreenWidthForNarrow = 768;
		this.minScreenHeight = 768;
		this.objectPanelWidth = 400;
		this.objectPanelHeight = 250;
		this.contextMenuWidth = 128;
		this.contextMenuHeight = 32;
		this.uiControlBarHeight = 160;

		this.firebase = new Firebase();

		this.notEnoughSpaceDialogProps = {
			dialogContent: "That character's inventory space is full. Drop or trade out something first.",
			closeButtonText: 'Ok',
			closeButtonCallback: null,
			disableCloseButton: false,
			actionButtonVisible: false,
			actionButtonText: '',
			actionButtonCallback: null,
			dialogClasses: ''
		};
		this.noMoreActionsDialogProps = {
			dialogContent: 'That character has no more actions this turn',
			closeButtonText: 'Ok',
			closeButtonCallback: null,
			disableCloseButton: false,
			actionButtonVisible: false,
			actionButtonText: '',
			actionButtonCallback: null,
			dialogClasses: ''
		};
		this.noMoreMovesDialogProps = {
			dialogContent: 'That character has no more moves this turn',
			closeButtonText: 'Ok',
			closeButtonCallback: null,
			disableCloseButton: false,
			actionButtonVisible: false,
			actionButtonText: '',
			actionButtonCallback: null,
			dialogClasses: ''
		};

		/**
		 * Creature data structure : {
		 *      CreatureData[name],
		 *      GameLocations[location].creatures[name],
		 * 		currentHealth: CreatureData[name].startingHealth,
		 * 		tileCoords: {xPos, yPos}
		 * }
		 **/

		this.state = {
			gameOptions: {
				fxVolume: 1,
				playFx: true,
				musicVolume: 1,
				playMusic: false,
				songName: '',
				screenZoom: 1.0
			},
			screenData: {
				width: window.innerWidth,
				height: window.innerHeight,
				isSmall: window.innerWidth < this.minScreenWidthForSmall || window.innerHeight < this.minScreenHeight,
				isNarrow: window.innerWidth < this.minScreenWidthForNarrow && window.innerWidth < window.innerHeight,
				isShort: window.innerHeight < this.minScreenHeight && window.innerHeight < window.innerWidth,
				isIOS: navigator.userAgent.includes('iPhone OS')
			},
			userData: {},
			isLoginWindowRequested: false,
			isLoggedIn: false,
			characterCreated: false,
			createdCharData: null,
			gameSetupComplete: false,
			playerCharacters: {},
			pcTypes: PlayerCharacterTypes,
			currentLocation: '',
			currentLevel: 1,
			playerFollowOrder: [],
			followModePositions: [],
			currentRound: 1, // starts on 1 because always enter a new area in tactical mode but updateCurrentTurn isn't called on entry
			showDialog: false,
			dialogProps: {
			dialogContent: this.initialDialogContent,
				closeButtonText: 'Close',
				closeButtonCallback: null,
				disableCloseButton: false,
				actionButtonVisible: false,
				actionButtonText: '',
				actionButtonCallback:  null,
				dialogClasses: ''
			},
			// these need resetting on level change
			mapCreatures: {},
			mapObjects: {},
			unitsTurnOrder: [],
			currentTurn: 0,
			activeCharacter: !this.showCharacterCreation ? this.startingPlayerCharacters[0] : null,
			activePlayerMovesCompleted: 0,
			activePlayerActionsCompleted: 0,
			characterIsSelected: false,
			creatureIsSelected: false,
			creatureCoordsUpdate: null,
			selectedCharacter: '',
			selectedCreature: '',
			actionButtonSelected: null,
			objectSelected: null,
			objHasBeenDropped: false,
			lightingHasChanged: false,
			inTacticalMode: true, // start in tactical mode any time entering a new area
			threatList: [],
			partyIsNearby: true,
			contextMenuChoice: null,
			centerOnPlayer: false,
			logText: []
		}
	}

	/**
	 * Resets level related data in state back to defaults when changing levels
	 * @param callback: function
	 */
	resetDataForNewLevel = (callback) => {
		this.setState({
			mapCreatures: {},
			mapObjects: {},
			unitsTurnOrder: [],
			currentTurn: 0,
			activeCharacter: this.startingPlayerCharacters[0],
			activePlayerMovesCompleted: 0,
			activePlayerActionsCompleted: 0,
			characterIsSelected: false,
			creatureIsSelected: false,
			creatureCoordsUpdate: null,
			selectedCharacter: '',
			selectedCreature: '',
			actionButtonSelected: null,
			objectSelected: null,
			objHasBeenDropped: false,
			lightingHasChanged: false,
			inTacticalMode: true, // start in tactical mode any time entering a new area
			threatList: [],
			partyIsNearby: true,
			contextMenuChoice: null,
			centerOnPlayer: false,
			logText: []
		}, () => {
			if (callback) callback();
		})
	}

	getScreenDimensions = () => {
		const screenData = {...this.state.screenData};
		screenData.width = window.innerWidth;
		screenData.height = window.innerHeight;
		screenData.isSmall = window.innerWidth < this.minScreenWidthForSmall || window.innerHeight < this.minScreenHeight;
		screenData.isNarrow = screenData.width < this.minScreenWidthForNarrow && screenData.width < screenData.height;
		screenData.isShort = screenData.height < this.minScreenHeight && screenData.height < screenData.width;
		this.setState({screenData});
	}

	/**
	 * Updates state to true once login is completed by Firebase component
	 */
	updateLoggedIn = (userData) => {
		this.setState({
			isLoggedIn: true,
			userData
		});
	}

	saveCreatedCharacter = (createdCharData, partyList) => {
		this.startingPlayerCharacters = partyList;
		this.setState({createdCharData, characterCreated: true}, () => {
			this._setupGameState();
		});
	}

	/**
	 * Updates either creature or player character data collection to state
	 * If id is passed in, updating only one creature; otherwise updating all
	 * @param type: String ('player' or 'creature')
	 * @param updateData: Object (can be any number of data objects unless updating all characters of a type, then must be all data)
	 * @param id: String (char/creature Id) or null
	 * @param lightingHasChanged: boolean
	 * @param isInitialCreatureSetup: Boolean
	 * @param isInitialCharacterSetup: Boolean
	 * @param callback: Function
	 */
	updateCharacters = (type, updateData, id, lightingHasChanged, isInitialCreatureSetup = false, isInitialCharacterSetup = false, callback) => {
		const collection = type === 'player' ? 'playerCharacters' : 'mapCreatures';
		if (id) {
			this.setState(prevState => ({
				[collection]: {
					...prevState[collection],
					[id]: {...prevState[collection][id], ...updateData}
				}
			}), () => {
				if (this.state.selectedCreature === id) {
					if (this.state[collection][id].currentHealth <= 0 && type === 'creature') {
						this.updateUnitSelectionStatus(id, 'creature');
					}
				}
				if (lightingHasChanged) {
					this.toggleLightingHasChanged(callback);
				} else if (callback) {
					callback();
				}
			});
		} else {
			this.setState({[collection]: updateData}, () => {
				if (isInitialCharacterSetup) {
					this._setAllUnitsTurnOrder('playerCharacters', callback);
				} else if (isInitialCreatureSetup) {
					this._setAllUnitsTurnOrder('mapCreatures', callback);
				} else if (lightingHasChanged) {
					this.toggleLightingHasChanged(callback);
				} else if (callback) {
					callback();
				}
			});
		}
	}

	/**
	 * Updates collection of mapObjects in state for when object is picked up or dropped or during map init
	 * @param mapObjects: object (modified copy of this.state.mapObjects)
	 * @param lightingHasChanged: boolean
	 * @param callback
	 */
	updateMapObjects = (mapObjects, lightingHasChanged, callback) => {
		this.setState({mapObjects}, () => {
			if (lightingHasChanged) {
				this.toggleLightingHasChanged(callback);
			} else if (callback) {
				callback();
			}
		});
	}

	/**
	 * Gets the positions for each LIVING character of a genre, player, creature, or all
	 * @param type: String ('player', 'creature' or 'all')
	 * @param format: String ('pos' (string) or 'coords' (object))
	 * @param includeDead: Boolean (mainly for calculating lighting)
	 * @returns Array (of Objects {id: coords})
	 */
	getAllCharactersPos = (type, format, includeDead = false) => {
		const allCharactersPos = [];
		const collection =
			type === 'player' ? this.state.playerCharacters :
			type === 'creature' ? this.state.mapCreatures :
			Object.assign({}, this.state.playerCharacters, this.state.mapCreatures); // copy all to empty object to avoid modifying originals
		for (const [id, characterData] of Object.entries(collection)) {
			if ((characterData.currentHealth > 0 && (type === 'creature' || characterData.currentSanity > 0)) || includeDead) {
				let coords = format === 'pos' ? `${characterData.coords.xPos}-${characterData.coords.yPos}` : characterData.coords;
				allCharactersPos.push({id, [format]: coords});
			}
		}
		return allCharactersPos;
	}

	/**
	 * Updates to state the contents of the log window in UI
	 * @param logText: String
	 */
	updateLog = (logText) => {
		this.setState(prevState => ({
			logText: [...prevState.logText, logText]
		}));
	}

	/**
	 * Updates to state whether a PC or NPC is selected
	 * For quick and public checking of selection status vs updateUnitSelectionStatus which is private and contains a lot more info
	 * @param type: String
	 * @param status: Boolean
	 */
	toggleCharIsSelected = (type, status) => {
		const storageName = type === 'player' ? 'characterIsSelected' : 'creatureIsSelected';
		this.setState({[storageName]: status});
	}

	/**
	 * Saves to state whether game is in tactical (combat) mode or not,
	 * then if not, calls resetCounters
	 * @param inTacticalMode: boolean
	 * @param callback: function
	 */
	toggleTacticalMode = (inTacticalMode, callback) => {
		this.setState({inTacticalMode}, () => {
			if (!inTacticalMode) {
				this._resetCounters(callback);
			} else {
				this.updateCurrentTurn(true, callback);
			}
		});
	}

	/**
	 * Uses checkLineOfSightToParty (from Map) to see if all party members are within sight of each other
	 * @param checkLineOfSightToParty: function
	 * @param callback: function
	 */
	updateIfPartyIsNearby = (checkLineOfSightToParty, callback) => {
		if (checkLineOfSightToParty && Object.keys(this.state.playerCharacters).length > 1) {
			let partyIsNearby = true;
			const allPcPositions = this.getAllCharactersPos('player', 'pos');
			const mainPcPos = allPcPositions[0].pos;
			const secPcPos = allPcPositions[1].pos;
			const thirdPcPos = allPcPositions[2].pos;
			if (this.state.partyIsNearby && (!checkLineOfSightToParty(mainPcPos, secPcPos, false) ||
				(thirdPcPos && (!checkLineOfSightToParty(mainPcPos, thirdPcPos, false) || !checkLineOfSightToParty(secPcPos, thirdPcPos, false))) ))
			{
				this.updateLog('All party members are not in sight of each other.');
				partyIsNearby = false;
			}
			this.setState({partyIsNearby}, () => {
				if (callback) callback();
			});
		} else if (callback) {
			callback();
		}
	}

	/**
	 * Adds IDs to or removes IDs from threat list and saves list to state,
	 * then if there's a change in the list, calls toggleTacticalMode
	 * This is the primary entry point for changing/determining whether game is in Follow mode or Tactical mode
	 * @param threatIdsToAdd: Array (of strings - IDs of creatures attacking player)
	 * @param threatIdsToRemove: Array (of strings - IDs of creatures no longer a threat)
	 * @param callback: function
	 * @param checkLineOfSightToParty: function
	 */
	updateThreatList = (threatIdsToAdd, threatIdsToRemove, callback, checkLineOfSightToParty) => {
		const previousListSize = this.state.threatList.length;
		let updatedList = [...this.state.threatList];

		if (threatIdsToAdd.length > 0) {
			threatIdsToAdd.forEach(id => {
				if (!updatedList.includes(id)) {
					updatedList.push(id);
				}
			});
		}
		if (threatIdsToRemove.length > 0) {
			threatIdsToRemove.forEach(id => {
				if (updatedList.includes(id)) {
					updatedList.splice(updatedList.indexOf(id), 1);
				}
			});
		}

		this.setState({threatList: updatedList}, () => {
			const isInCombat = updatedList.length > 0;

			// if entering combat...
			if (isInCombat && previousListSize === 0 ) {
				this.updateLog('Something horrific has been spotted nearby!');
				if (!this.state.inTacticalMode) {
					this.toggleTacticalMode(isInCombat, callback);
				} else if (callback) {
					callback();
				}
			// leaving combat...
			} else if (!isInCombat) {
				this.updateLog('No terrors in sight...');
				this.updateIfPartyIsNearby(checkLineOfSightToParty, callback);
			// already/still in combat
			} else if (callback) {
				callback();
			}
		});
	}

	/**
	 * Updates to state what PC weapon, item, or skill button is selected in the UI
	 * Data stored in actionButtonSelected: {characterId, itemId, itemName, stats: WeaponTypes[itemName], ItemTypes[itemName], or SkillTypes[itemName]}
	 * state.actionButtonSelected gets reset in this.updateCurrentTurn
	 * @param characterId: String
	 * @param itemId: String (action button ID - ie. item, weapon, or skill ID)
	 * @param itemName: String
	 * @param buttonType: String ('weapon', 'item', or 'skill')
	 * @param callback: Function
	 */
	toggleActionButton = (characterId, itemId, itemName, buttonType, callback) => {
		let buttonState = null;
		let isImmediateAction = false; // action takes effect without needing user to select a target
		let stats = {};

		// if no weapon/item selected or weapon/item selected doesn't match new weapon/item selected, set weapon/item state to new weapon/item
		if (characterId && (!this.state.actionButtonSelected ||
			(this.state.actionButtonSelected.characterId !== characterId || this.state.actionButtonSelected.itemId !== itemId)))
		{
			if (buttonType === 'weapon') {
				stats = WeaponTypes[itemName];
			} else if (buttonType === 'item') {
				stats = ItemTypes[itemName];
			} else {
				stats = this.state.playerCharacters[characterId].skills[itemId];
				isImmediateAction = !stats.hasTarget;
			}
			buttonState = {characterId, itemId, itemName, stats};
		}
		if (isImmediateAction) {
			// skillType will either be 'create' or 'active' (except heal and resuscitate skills are called from handleUnitClick)
			const props = stats.skillType === 'create' ? {
				itemType: itemId,
				activeCharId: characterId,
				currentPcData: this.state.playerCharacters[characterId],
				updateCharacter: this.updateCharacters,
				updateLog: this.updateLog,
				setShowDialogProps: this.setShowDialogProps,
				addItemToPlayerInventory: this.addItemToPlayerInventory,
				updateActivePlayerActions: this.updateActivePlayerActions
			} : {
				currentPcData: this.state.playerCharacters[characterId],
				partyData: this.state.playerCharacters,
				currentRound: this.state.currentRound,
				updateCharacter: this.updateCharacters,
				updateLog: this.updateLog,
				updateActivePlayerActions: this.updateActivePlayerActions
			};
			const skillId = stats.skillType === 'create' ? 'create' : itemId;
			this.state.playerCharacters[characterId][skillId](props);
			if (callback) callback();
		} else {
			this.setState({actionButtonSelected: buttonState}, () => {
				if (callback) callback();
			});
		}
	}

	/**
	 * Reloading active character's gun using ammo in inv we already know we have, as determined by CharacterControls in UIElements
	 * @param weaponId: string
	 * @param isQuickReload: boolean (true if using the Quick Reload skill)
	 */
	reloadGun = (weaponId, isQuickReload) => {
		const updatedPCdata = deepCopy(this.state.playerCharacters[this.state.activeCharacter]);
		const gunInfo = updatedPCdata.weapons[weaponId];
		const gunType = gunInfo.gunType;
		const availAmmo = updatedPCdata.items[gunType + 'Ammo0'].amount;
		const emptyRounds = gunInfo.rounds - gunInfo.currentRounds;
		const resupplyAmmo = emptyRounds <= availAmmo ? emptyRounds : availAmmo;
		gunInfo.currentRounds += resupplyAmmo;
		updatedPCdata.items[gunType + 'Ammo0'].amount = availAmmo - resupplyAmmo;
		if (updatedPCdata.items[gunType + 'Ammo0'].amount === 0) {
			delete updatedPCdata.items[gunType + 'Ammo0'];
		}
		if (isQuickReload) {
			updatedPCdata.currentSpirit = this.reduceCharSpirit('quickReload');
		}
		this.updateCharacters('player', updatedPCdata, this.state.activeCharacter, false, false, false, () => {
			if (!isQuickReload) {
				this.updateActivePlayerActions();
			}
		});
	}

	/**
	 * Reloading active character's light using oil in inv we already know we have, as determined by CharacterControls in UIElements
	 */
	refillLight = () => {
		const activePcData = deepCopy(this.state.playerCharacters[this.state.activeCharacter]);
		const equippedLight = activePcData.items[activePcData.equippedLight];
		const oil = activePcData.items.oil0;
		const oilNeeded = equippedLight.maxTime - activePcData.lightTime;
		equippedLight.time = oil.amount < oilNeeded ? activePcData.lightTime + oil.amount : equippedLight.maxTime;
		activePcData.lightTime = equippedLight.time;
		oil.amount -= oil.amount < oilNeeded ? oil.amount : oilNeeded;
		if (oil.amount <= 0) {
			delete activePcData.items.oil0;
		}
		this.updateCharacters('player', activePcData, this.state.activeCharacter, true, false, false, () => {
			this.updateActivePlayerActions();
		});
	}

	/**
	 * Returns new spirit value for active PC after subtracting spirit cost for used active skill
	 * @param skillId: string
	 * @returns {number}
	 */
	reduceCharSpirit = (skillId) => {
		const pcData = this.state.playerCharacters[this.state.activeCharacter];
		const skillData = pcData.skills[skillId];
		const skillLevel = skillData.level;
		return pcData.currentSpirit - skillData.spirit[skillLevel];
	}

	/**
	 * User click handler for clicking on units to determine if it's being selected or acted upon (ie. attacked, healed, etc.)
	 * @param id: string (target ID)
	 * @param target: string ('player' or 'creature')
	 * @param isInRange: boolean
	 * @param checkLineOfSightToParty: function (from Map)
	 */
	handleUnitClick = (id, target, isInRange, checkLineOfSightToParty) => {
		if (this.state.actionButtonSelected && isInRange) {
			// clicked unit is getting acted upon
			const selectedItemInfo = this.state.actionButtonSelected;
			const activePC = this.state.playerCharacters[this.state.activeCharacter];
			const actionProps = {
				itemId: selectedItemInfo.itemId,
				itemStats: selectedItemInfo.stats,
				targetData: target === 'creature' ? this.state.mapCreatures[id] : this.state.playerCharacters[id],
				pcData: activePC,
				updateCharacter: this.updateCharacters,
				updateLog: this.updateLog,
				setShowDialogProps: this.setShowDialogProps,
				callback: () => {
					this.toggleActionButton(selectedItemInfo.characterId, selectedItemInfo.itemId, selectedItemInfo.itemName, target === 'creature' ? 'weapon': 'item', () => {
						if (target === 'creature' && this.state.mapCreatures[id].currentHealth <= 0) {
							this._removeDeadFromTurnOrder(id, this.updateActivePlayerActions, checkLineOfSightToParty);
						} else {
							this.updateActivePlayerActions();
						}
					});
				}
			};
			// if target is creature, attack, or if Resuscitate skill button was activated, resuscitate, otherwise, heal
			target === 'creature' ? activePC.attack(actionProps) : (selectedItemInfo.stats.name && selectedItemInfo.stats.name === 'Resuscitate') ? activePC.resuscitate(actionProps) : activePC.heal(actionProps);
		} else {
			// clicked unit is just being selected/deselected
			this.updateUnitSelectionStatus(id, target);
		}
	}

	/**
	 * Updates to state the status of what PC or NPC (or both) is selected in the UI
	 * @param id: String
	 * @param type: String ('player' or 'creature')
	 */
	updateUnitSelectionStatus = (id, type) => {
		let unitTypeObjectName = '';
		let unitTypeSelected = '';
		let unitNameForSelectionStateChg = '';
		let unitToDeselect = '';

		if (type === 'player') {
			unitTypeObjectName = 'playerCharacters';
			unitTypeSelected = 'selectedCharacter';
		} else if (type === 'creature') {
			unitTypeObjectName = 'mapCreatures';
			unitTypeSelected = 'selectedCreature';
		}

		// clicked unit is being selected/deselected
		if (this.state.selectedCharacter === id || this.state.selectedCreature === id) {
			// selected character was just clicked to deselect
			unitNameForSelectionStateChg = '';
		} else {
			// no unit previously selected or different unit previously selected
			unitNameForSelectionStateChg = id;
			if (this.state[unitTypeSelected] !== '') {
				unitToDeselect = this.state[unitTypeSelected];
			}
		}

		// toggle selected state of clicked unit
		this.setState(prevState => ({
			[unitTypeSelected]: unitNameForSelectionStateChg,
			[unitTypeObjectName]: {
				...prevState[unitTypeObjectName],
				[id]: {
					...prevState[unitTypeObjectName][id],
					isSelected: !prevState[unitTypeObjectName][id].isSelected
				}
			}
		}), () => {
			if (unitToDeselect !== '') {
				this.setState(prevState => ({
					[unitTypeObjectName]: {
						...prevState[unitTypeObjectName],
						[unitToDeselect]: {
							...prevState[unitTypeObjectName][unitToDeselect],
							isSelected: !prevState[unitTypeObjectName][unitToDeselect].isSelected
						}
					}
				}));
			}
			this.toggleCharIsSelected(type, this.state[unitTypeObjectName][id].isSelected);
		});
	}

	/**
	 * Increments and sets to state the current turn number (or resets if on last turn of unitTurnOrder),
	 * as well as resets number of moves and actions taken by the active PC
	 * and decrements any pc's status' turnsLeft (or removes the status if no turns left) if that pc is the next active pc
	 * then calls functions to clear any action button from previous char and then update which is the active character.
	 * Skips PC if PC has <= 0 health/sanity and increments turnsSinceDeath if health is <= 0, then either updates char
	 * or removes char from game if char has been at 0 health for 3 turns
	 * @param startTurns: boolean (true if starting turns, ie. combat just started)
	 * @param callback: function
	 */
	updateCurrentTurn = (startTurns = false, callback) => {
		let currentTurn = (startTurns || this.state.currentTurn === this.state.unitsTurnOrder.length - 1) ? 0 : this.state.currentTurn + 1;
		const currentRound = currentTurn === 0 ? this.state.currentRound + 1 : this.state.currentRound;
		const nextActiveCharId = Object.values(this.state.unitsTurnOrder[currentTurn])[0].id;
		let nextActiveChar = deepCopy(this.state.playerCharacters[nextActiveCharId]);
		let updateOrRemoveChar = null;
		if (nextActiveChar && (nextActiveChar.currentHealth <= 0 || nextActiveChar.currentSanity <= 0)) {
			currentTurn++;
			if (nextActiveChar.currentHealth <= 0 && nextActiveChar.turnsSinceDeath < this.maxTurnsToReviveDeadPlayer) {
				nextActiveChar.turnsSinceDeath++;
				if (nextActiveChar.turnsSinceDeath < this.maxTurnsToReviveDeadPlayer) {
					updateOrRemoveChar = 'update';
				} else {
					updateOrRemoveChar = 'remove';
					nextActiveChar.isDeadOrInsane = true;
				}
			}
		}
		if (nextActiveChar && Object.keys(nextActiveChar.statuses).length > 0) {
			updateOrRemoveChar = true;
			for (const [statusName, statusData] of Object.entries(nextActiveChar.statuses)) {
				if (statusData.startingRound !== currentRound) {
					if (statusData.turnsLeft === 1) {
						delete nextActiveChar.statuses[statusName];
					} else {
						statusData.turnsLeft--;
					}
				}
			}
		}
		this.setState({currentTurn, currentRound, activePlayerActionsCompleted: 0, activePlayerMovesCompleted: 0}, () => {
			const updateActiveChar = () => {
				if (this.state.playerCharacters[this.state.activeCharacter] && this.state.actionButtonSelected) {
					this.toggleActionButton('', '', '', '', () => {
						this.updateActiveCharacter(callback);
					});
				} else {
					this.updateActiveCharacter(callback);
				}
			}
			if (updateOrRemoveChar) {
				if (updateOrRemoveChar === 'update') {
					this.updateLog(`${nextActiveChar.name} is dying and has ${this.maxTurnsToReviveDeadPlayer - nextActiveChar.turnsSinceDeath} turns to be resuscitated!`);
				}
				this.updateCharacters('player', nextActiveChar, nextActiveCharId, false, false, false, () => {
					if (updateOrRemoveChar === 'remove') {
						this._removeDeadPCFromGame(nextActiveCharId, updateActiveChar);
					} else {
						updateActiveChar();
					}
				});
			} else {
				updateActiveChar();
			}
		});
	}

	/**
	 * Increments and sets to state the number of moves made by the active PC
	 */
	updateActivePlayerMoves = () => {
		const activePlayerMovesCompleted = this.state.activePlayerMovesCompleted + 1;
		this.setState({activePlayerMovesCompleted});
	}

	/**
	 * Increments and updates to state number of actions the active PC has done
	 */
	updateActivePlayerActions = () => {
		if (this.state.inTacticalMode) {
			const activePlayerActionsCompleted = this.state.activePlayerActionsCompleted + 1;
			this.setState({activePlayerActionsCompleted});
		}
	}

	/**
	 * Sets props for main dialog window. showDialog determines whether dialog is shown
	 * and rest determine dialog content
	 * @param showDialog: boolean
	 * @param dialogProps: object: {
	 *      dialogContent: string
	 *      closeButtonText: string
	 *      closeButtonCallback: function
	 *      disableCloseButton: boolean
	 *      actionButtonVisible: boolean
	 *      actionButtonText: string
	 *      actionButtonCallback: function
	 *      dialogClasses: string
	 * }
	 */
	setShowDialogProps = (showDialog, dialogProps) => {
		this.setState({showDialog, dialogProps});
	}

	/**
	 * Checks if context menu should be shown or other action processed
	 * Other action possibilities:
	 * -close menu
	 * -handle unit click to show unit info
	 * -handle unit click to take action on it
	 * -handle object click to set object selected
	 * @param actionType: string (possibilities: 'examine', 'creature', 'player', null)
	 * @param tilePos: string
	 * @param evt: event object
	 * @param actionInfo: object (props for appropriate function called upon clicking menu button)
	 * @returns {{actionToProcess: function, menuNeeded: boolean}} (if menuNeeded, actionToProcess is null)
	 */
	isContextMenuNeeded = (actionType, tilePos = null, evt = null, actionInfo = null) => {
		let contextMenuNeeded = {menuNeeded: true, actionToProcess: null};

		// if clicked obj is a creature/player, check if at least one object is on that tile
		let objectOnTile = null;
		if (actionType === 'creature' || actionType === 'player') {
			objectOnTile = this._isObjectOnTile(tilePos, evt);
		}

		const clickedTargetId = evt.currentTarget.id;
		const skillId = this.state.actionButtonSelected ? this.state.actionButtonSelected.itemId : null;
		let otherCharacterOnTile = '';
		let dyingChar = '';
		let isClickedTargetDyingPc = false;
		for (const charData of Object.values(this.state.playerCharacters)) {
			if (charData.currentHealth <= 0 && convertCoordsToPos(charData.coords) === tilePos) {
				dyingChar = charData.name;
				if (clickedTargetId === charData.id) {
					isClickedTargetDyingPc = true;
				}
			}
		}
		if (skillId === 'resuscitate') {
			// check if other creature/player is on clicked tile to know whether it blocks the Resuscitate skill
			const allChars = {...this.state.playerCharacters, ...this.state.mapCreatures};
			if (allChars[clickedTargetId] && convertCoordsToPos(allChars[clickedTargetId].coords) === tilePos && allChars[clickedTargetId].name !== dyingChar) {
				otherCharacterOnTile = (allChars[clickedTargetId].type === 'player' ? '' : 'The ') + allChars[clickedTargetId].name;
			}
		}

		// if clicked target is dying pc and no action cued up...
		if (actionType === 'player' && isClickedTargetDyingPc && !this.state.actionButtonSelected) {
			contextMenuNeeded = {
				menuNeeded: true,
				actionToProcess: () => this.handleUnitClick(actionInfo.id, actionType)
			};
		// ...or bypass setting up context menu if clicked target is a pc or creature with nothing else on the tile and no action cued up...
		} else if (!objectOnTile && !this.state.actionButtonSelected && (actionType === 'player' || actionType === 'creature')) {
			contextMenuNeeded = {
				menuNeeded: false,
				actionToProcess: () => this.handleUnitClick(actionInfo.id, actionType)
			};
		// ...or if action is being used (regardless of whether object is also there)
		} else if (this.state.actionButtonSelected && (actionType === 'creature' || actionType === 'player')) {
			if (skillId === 'resuscitate' && dyingChar && otherCharacterOnTile) {
				const resusBlockedDialogProps = {
					dialogContent: `${otherCharacterOnTile} is on top of ${dyingChar}, preventing resuscitation!`,
					closeButtonText: 'Ok',
					closeButtonCallback: null,
					disableCloseButton: false,
					actionButtonVisible: false,
					actionButtonText: '',
					actionButtonCallback: null,
					dialogClasses: ''
				};
				this.setShowDialogProps(true, resusBlockedDialogProps);
				contextMenuNeeded = {menuNeeded: false, actionToProcess: null};
			} else {
				contextMenuNeeded = {
					menuNeeded: false,
					actionToProcess: () => this.handleUnitClick(actionInfo.id, actionInfo.target, actionInfo.isInRange, actionInfo.checkLineOfSightToParty)
				};
			}
		// ...or if clicked target is a torch
		} else if (actionType === 'examine' && actionInfo.objectInfo[0].name === 'Torch') {
			contextMenuNeeded = {
				menuNeeded: false,
				actionToProcess: () => this.setMapObjectSelected(actionInfo.objectInfo, actionInfo.selectionEvt, actionInfo.isPickUpAction)
			};
		}

		return contextMenuNeeded;
	}

	/**
	 * Determines which buttons to add to context menu
	 * Possibilities:
	 * creature and item
	 * player and item
	 * item and move
	 * dying player (get info) and move
	 * dying player (get info), item, and move
	 * action (shoot) and reload
	 * @param actionType: string (possibilities: 'examine', 'creature', 'player', null)
	 * @param tilePos: string
	 * @param evt: event object
	 * @param actionInfo: object (props for appropriate function called upon clicking menu button)
	 * @param contextMenuInfo: object ({actionToProcess: function, menuNeeded: boolean} - passed in only if isContextMenuNeeded was previously called in Map (checkForDragging))
	 */
	updateContextMenu = (actionType, tilePos = null, evt = null, actionInfo = null, contextMenuInfo = null) => {
		// for edge cases, like using Resuscitate action when pc is blocked by another character standing on top of it
		if (contextMenuInfo && !contextMenuInfo.menuNeeded && !contextMenuInfo.actionToProcess) {
			return;
		}

		// if no action is being done (action being clicked on item or character) there's already a menu, so close menu
		// no actionType should indicate menu already exists (as clicking on item, char, or tile is already checking), but just in case...
		if (!actionType) {
			this.setState({contextMenu: null});
		// Don't need menu, so do action instead
		} else {
			const isContextMenuNeeded = contextMenuInfo || this.isContextMenuNeeded(actionType, tilePos, evt, actionInfo);

			if (!isContextMenuNeeded.menuNeeded) {
				isContextMenuNeeded.actionToProcess();
			// otherwise, set up context menu
			} else {
				const contextMenu = {
					actionsAvailable: {[actionType]: actionInfo},
					creatureId: actionInfo.id || null,
					tilePos,
					evt
				};
				const clickedTargetIsPc = this.state.playerCharacters[evt.currentTarget.id];
				const clickedTargetIsDyingPc = clickedTargetIsPc && clickedTargetIsPc.currentHealth <= 0;
				if ((actionType !== 'player' && actionType !== 'creature') || (actionType === 'player' && clickedTargetIsDyingPc)) {
					contextMenu.actionsAvailable.move = true;
				} else {
					const objectOnTile = this._isObjectOnTile(tilePos, evt);
					if (objectOnTile) {
						contextMenu.actionsAvailable.examine = objectOnTile;
					}
				}
				this.setState({contextMenu, contextMenuChoice: null});
			}
		}
	}

	/**
	 * Calls appropriate function based on menu button clicked
	 * For 'examine' (item): setMapObjectSelected
	 * For 'player'/'creature': handleUnitClick
	 * For 'move': handled by checkIfTileOrObject in Map
	 * @param actionType: string
	 */
	handleContextMenuSelection = (actionType) => {
		const storedActionInfo = this.state.contextMenu.actionsAvailable[actionType];
		if (actionType === 'examine') {
			this.setMapObjectSelected(storedActionInfo.objectInfo, storedActionInfo.selectionEvt, storedActionInfo.isPickUpAction);
			this.setState({contextMenu: null});
		} else if (actionType === 'creature' || actionType === 'player') {
			this.handleUnitClick(storedActionInfo.id, storedActionInfo.target, storedActionInfo.isInRange, storedActionInfo.checkLineOfSightToParty);
			this.setState({contextMenu: null});
		} else if (actionType === 'move') {
			this.setState({contextMenuChoice: {actionType, tilePos: this.state.contextMenu.tilePos}}, () => {
				this.setState({contextMenu: null});
			});
		}
	}

	/**
	 * Updates to state what character is active (PC or NPC)
	 * @param callback: function (optional - at start, sets flag that chars are placed, then for PCs moves map to center)
	 * @param id: String (optional)
	 */
	updateActiveCharacter = (callback = null, id = null) => {
		const currentTurnUnitInfo = Object.values(this.state.unitsTurnOrder[this.state.currentTurn])[0];
		let playerFollowOrder = [...this.state.playerFollowOrder];
		if (!this.state.inTacticalMode) {
			let newLeader = playerFollowOrder.splice(playerFollowOrder.indexOf(id), 1)[0];
			playerFollowOrder.unshift(newLeader);
		}
		this.setState({activeCharacter: id || currentTurnUnitInfo.id, playerFollowOrder}, () => {
			if (callback) callback();
		});
	}

	/**
	 * Updates list of PC positions for follow mode
	 * @param updatedList: array (of strings - positions of PCs, updated in moveCharacter in Map)
	 * @param callback
	 */
	updateFollowModePositions = (updatedList, callback) => {
		this.setState({followModePositions: updatedList}, () => {
			if (callback) callback();
		});
	}

	/**
	 * UIElements calls this to send id(s) of object(s) that player clicked on in map or using action, so object info panel can be displayed in UI
	 * Single id passed in if clicked on map (even if multiple objects, UI will handle checking for others)
	 * Single OR multiple ids if examined using action
	 * @param objectInfo: array (of objects: {objId: objInfo})
	 * @param selectionEvt: event object
	 * @param isPickUpAction: boolean (true if action button clicked to inspect/pickup object)
	 */
	setMapObjectSelected = (objectInfo, selectionEvt, isPickUpAction) => {
		const objectSelected = objectInfo ? {objectList: objectInfo, evt: selectionEvt, isPickUpAction} : null;
		this.setState({objectSelected});
	}

	/**
	 * Called from Map when player drags object to map
	 * @param props: {objHasBeenDropped (boolean), evt (event object)}
	 */
	setHasObjBeenDropped = (props) => {
		this.setState({objHasBeenDropped: {dropped: props.objHasBeenDropped, evt: props.evt}});
	}

	/**
	 * Set by UI when a light source has been equipped/unequipped/dropped to tell Map to recalculate lighting
	 * @param callback
	 */
	toggleLightingHasChanged = (callback) => {
		this.setState(prevState => ({lightingHasChanged: !prevState.lightingHasChanged}), () => {
			if (callback) callback();
		});
	}

	/**
	 * Add picked up/transferred/created item or weapon to char's inventory
	 * @param itemData: object
	 * @param objId: string
	 * @param recipientId: string (id of pc that's receiving the item
	 * @param isPickUpAction: boolean (item was picked up using action button)
	 * @param isCreateAction: boolean (item created using skill)
	 */
	addItemToPlayerInventory = (itemData, objId, recipientId, isPickUpAction, isCreateAction) => {
		const player = this.state.playerCharacters[recipientId];
		const objectType = itemData.itemType ? itemData.itemType : 'Weapon';
		const invObjectCategory = objectType === 'Weapon' ? 'weapons' : 'items';
		let invObjects = deepCopy(player[invObjectCategory]);
		let modifiedObjId = '';

		if (itemData.coords) {
			delete itemData.coords;
		}

		if (objectType === 'Ammo') {
			modifiedObjId = itemData.gunType + 'Ammo0';
			const currentAmmoCount = invObjects[modifiedObjId] ? invObjects[modifiedObjId].amount : 0;
			invObjects[modifiedObjId] = {...itemData};
			invObjects[modifiedObjId].id  = modifiedObjId; // replace original id with inventory specific id for stackable items
			invObjects[modifiedObjId].amount = currentAmmoCount + itemData.amount;
		} else if (objectType === 'Light') {
			invObjects[objId] = {...itemData};
			invObjects[objId].time = itemData.maxTime;
		} else if (itemData.stackable) {
			modifiedObjId = objId.replace(/\d+$/, '0');
			if (!invObjects[modifiedObjId]) {
				invObjects[modifiedObjId] = {...itemData};
				invObjects[modifiedObjId].id  = modifiedObjId; // replace original id with inventory specific id for stackable items
				invObjects[modifiedObjId].currentRounds = itemData.currentRounds;
			} else if (objectType === 'Weapon') {
				invObjects[modifiedObjId].currentRounds += itemData.currentRounds;
			} else {
				invObjects[modifiedObjId].amount += itemData.amount;
			}
		} else {
			invObjects[objId] = {...itemData};
		}

		let updatedData = {[invObjectCategory]: invObjects};
		let inventory = [...player.inventory];
		// if not a stackable/ammo item or is but is new (not yet in inventory), then insert into inventory (modifiedObjId only used for stackable/ammo)
		if (!modifiedObjId || !inventory.includes(modifiedObjId)) {
			const firstOpenInvSlot = player.inventory.indexOf(null);
			if (modifiedObjId) {
				inventory.splice(firstOpenInvSlot, 1, modifiedObjId);
			} else {
				inventory.splice(firstOpenInvSlot, 1, objId);
			}
			updatedData.inventory = inventory;
		}
		this.updateCharacters('player', updatedData, recipientId, false, false, false, () => {
			if (isPickUpAction) {
				this._removeItemFromMap(objId);
				this.updateActivePlayerActions();
			} else if (isCreateAction) {
				this.updateActivePlayerActions();
			}
		});
	}

	toggleCenterOnPlayer = () => {
		this.setState(prevState => ({centerOnPlayer: !prevState.centerOnPlayer}));
	}

	updateGameOptions = (gameOptions) => {
		this.setState({gameOptions});
	}



	/*********************
	 * PRIVATE FUNCTIONS
	 *********************/


	/**
	 * Determines if object is on a clicked tile (checking for context menu)
	 * @param tilePos
	 * @param evt
	 * @returns null or object ({objectInfo, selectionEvt, isPickUpAction})
	 * @private
	 */
	_isObjectOnTile(tilePos, evt) {
		let objectOnTile = null;
		const objects = Object.values(this.state.mapObjects);
		let i = 0;
		while (!objectOnTile && i < objects.length) {
			if (convertCoordsToPos(objects[i].coords) === tilePos) {
				// objectInfo needs to be in array for setMapObjectSelected
				objectOnTile = {objectInfo: [objects[i]], selectionEvt: evt, isPickUpAction: false};
			} else {
				i++;
			}
		}
		return objectOnTile;
	}

	/**
	 * Initialization function. gameSetupComplete in callback indicates Map component can render
	 * @private
	 */
	_setupGameState() {
		const gameReadyCallback = () => {
			this.setState({gameSetupComplete: true});
		}
		this._setupPlayerCharacters();
		this._setLocation(gameReadyCallback);
	}

	/**
	 * Saves starting player chars to state as part of initialization
	 * @private
	 */
	_setupPlayerCharacters() {
		let playerCharacters = {};
		let playerFollowOrder = [];
		let activeCharacter = this.state.activeCharacter;
		this.startingPlayerCharacters.forEach(characterId => {
			const props = {...PlayerCharacterTypes[characterId], playerInventoryLimit: this.playerInventoryLimit};
			playerCharacters[characterId] = new Character(props);
			playerFollowOrder.push(characterId);
		});
		if (this.showCharacterCreation) {
			const createdCharData = this.state.createdCharData;
			const createdPC = playerCharacters[createdCharData.id];
			createdPC.name = createdCharData.name;
			createdPC.gender = createdCharData.gender;
			createdPC.strength = createdCharData.strength;
			createdPC.agility = createdCharData.agility;
			createdPC.mentalAcuity = createdCharData.mentalAcuity;
			activeCharacter = createdCharData.id;
		}
		this.setState({playerCharacters, playerFollowOrder, activeCharacter});
	}

	/**
	 * Saves new game location to state. For game init, runs callback to set gameSetupComplete to true.
	 * @param gameReadyCallback: function
	 * @private
	 */
	_setLocation(gameReadyCallback) {
		const gameOptions = {...this.state.gameOptions};
		gameOptions.songName = this.startingLocation;
		if (this.startingLocation) {
			this.setState({currentLocation: this.startingLocation, gameOptions}, gameReadyCallback);
		} else {
			// handle location change
		}
	}

	/**
	 * Sorts list of both player and non-player chars in map based on initiative value for taking turns
	 * No return value as unitsTurnOrder array is modified directly by address
	 * @param unitsTurnOrder: Array (of objects)
	 * @param newUnitId: String
	 * @param newUnitInitiative: Integer
	 * @param unitType: String
	 * @private
	 */
	_sortInitiatives (unitsTurnOrder, newUnitId, newUnitInitiative, unitType) {
		if (unitsTurnOrder.length === 0) {
			unitsTurnOrder.push({[newUnitInitiative]: {id: newUnitId, unitType}});
		} else {
			let i = 0;
			let notSorted = true;
			while (notSorted) {
				const sortedUnitInitValue = Object.keys(unitsTurnOrder[i])[0];
				const sortedUnitOrderInfo = unitsTurnOrder[i][sortedUnitInitValue];
				const sortedUnitId = sortedUnitOrderInfo.id;
				const sortedUnitTypeCollection = this.state[sortedUnitOrderInfo.unitType];
				const sortedUnitData = sortedUnitTypeCollection[sortedUnitId];
				const newUnitTypeCollection = this.state[unitType];
				const newUnitData = newUnitTypeCollection[newUnitId];
				// if new init value is greater or
				// inits are the same and new unit agility is greater
				// or inits and agilities are the same and new unit mental acuity is greater
				// or all the same and flip of a coin is 1, then add to the front
				if (newUnitInitiative > sortedUnitInitValue ||
					(newUnitInitiative === sortedUnitInitValue && newUnitData.agility > sortedUnitData.agility) ||
					(newUnitInitiative === sortedUnitInitValue &&
						newUnitData.agility === sortedUnitData.agility &&
						newUnitData.mentalAcuity > sortedUnitData.mentalAcuity) ||
					(newUnitInitiative === sortedUnitInitValue &&
						newUnitData.agility === sortedUnitData.agility &&
						newUnitData.mentalAcuity === sortedUnitData.mentalAcuity &&
						diceRoll(2) === 1)
				) {
					unitsTurnOrder.splice(i, 0, {[newUnitInitiative]: {id: newUnitId, unitType}});
					notSorted = false;
				} else if (i === unitsTurnOrder.length - 1) {
					unitsTurnOrder.push({[newUnitInitiative]: {id: newUnitId, unitType}});
					notSorted = false;
				}
				i++;
			}
		}
	}

	/**
	 * Calculates initiative values for each PC and NPC in map,
	 * then saves turn order array to state,
	 * @param unitType: String ('playerCharacters' or 'mapCreatures')
	 * @param callback: function (at start, sets flag that chars are placed, then for PCs moves map to center)
	 * @private
	 */
	_setAllUnitsTurnOrder(unitType, callback) {
		let unitsTurnOrder = this.state.unitsTurnOrder;

		for (const [id, charData] of Object.entries(this.state[unitType])) {
			const unitInitiative = charData.initiative + diceRoll(6);
			this._sortInitiatives(unitsTurnOrder, id, unitInitiative, unitType);
		}

		this.setState({unitsTurnOrder}, () => {
			if (unitType === 'mapCreatures') {
				this.updateActiveCharacter(callback);
			} else {
				callback();
			}
		});
	}

	/**
	 * Resets turn counters (usually after combat has ended)
	 * @param callback: function
	 * @private
	 */
	_resetCounters(callback) {
		this.setState({activePlayerMovesCompleted: 0, activePlayerActionsCompleted: 0, currentTurn: 0, currentRound: 0}, () => {
			this.updateActiveCharacter(callback, this.state.playerFollowOrder[0]);
		});
	}

	_removeDeadPCFromGame(id, callback) {
		if (this.state.playerCharacters[id]) {
			this.updateLog(`${this.state.playerCharacters[id].name} has gone from mostly dead to all dead!`);
			//check for this.state.createdCharData is so game doesn't crash when char creation is turned off
			if (this.state.createdCharData && id === this.state.createdCharData.id) {
				this._endGame();
			} else {
				// let playerChars = deepCopy(this.state.playerCharacters);
				// delete playerChars[id];
				// this.updateCharacters('player', playerChars, null, false, false, false, callback);
				this._removeDeadFromTurnOrder(id, callback);
			}
		} else if (callback) callback();
	}

	/**
	 * Updates to state the turn order with the dead removed
	 * @param id: String
	 * @param callback: function
	 * @param checkLineOfSightToParty: function (from Map)
	 * @private
	 */
	_removeDeadFromTurnOrder(id, callback, checkLineOfSightToParty) {
		let unitsTurnOrder = this.state.unitsTurnOrder;
		let unitNotFound = true;
		let index = 0;
		while (unitNotFound && index < this.state.unitsTurnOrder.length) {
			const unitInfo = Object.values(this.state.unitsTurnOrder[index])[0];
			if (unitInfo.id === id) {
				unitNotFound = false;
				unitsTurnOrder.splice(index, 1);
			}
			index++;
		}
		this.setState({unitsTurnOrder}, () => {
			if (checkLineOfSightToParty) {
				this.updateLog(`The ${this.state.mapCreatures[id].name} is dead!`);
				this.updateThreatList([], [id], callback, checkLineOfSightToParty);
			} else if (callback) callback();
		});
	}

	_removeItemFromMap(id) {
		const updatedObjects = deepCopy(this.state.mapObjects);
		const lightingHasChanged = updatedObjects[id].itemType && updatedObjects[id].itemType === 'Light';
		delete updatedObjects[id];
		this.updateMapObjects(updatedObjects, lightingHasChanged);
	}

	_endGame() {
		const dialogProps = {
			dialogContent: 'The main character has died, so the game is over.  Try again!',
			closeButtonText: 'Ok',
			closeButtonCallback: null,
			disableCloseButton: false,
			actionButtonVisible: false,
			actionButtonText: '',
			actionButtonCallback: null,
			dialogClasses: ''
		}
		this.setShowDialogProps(dialogProps);
	}



	/***************************
	 * REACT LIFECYCLE FUNCTIONS
	 ***************************/

	componentDidMount() {
		if (!this.state.gameSetupComplete) {
			let resizeTimeout = null;
			const resizeDelay = 500; // lower value may not update properly on screen rotation
			const getNewScreenDimensions = () => {
				clearTimeout(resizeTimeout);
				resizeTimeout = setTimeout(this.getScreenDimensions, resizeDelay);
			};

			window.addEventListener('resize', getNewScreenDimensions);
			window.screen.orientation.addEventListener('change', getNewScreenDimensions);

			if (!this.showCharacterCreation) {
				this.setState({characterCreated: true}, () => {
					this._setupGameState();
				});
			}
		}

		if (!this.showLogin) {
			this.setState({isLoggedIn: true});
		}
	}

	render() {
		return (
			<div className="game" style={{width: `${this.state.screenData.width}px`, height: `${this.state.screenData.height}px`}}>
				{!this.state.isLoggedIn &&
				<div className='title-screen'>
					<div className='title-screen-title-container'>
						<h1 className='font-fancy'>War of the Old Ones</h1>
						<div>(Pre-Alpha)</div>
					</div>
					<div className={`general-button ${this.state.isLoginWindowRequested ? 'button-disabled' : ''}`} onClick={() => {
						if (this.showLogin) {
							this.setState({isLoginWindowRequested: true});
						}
					}}>Login</div>
				</div>
				}

				{this.showLogin && this.state.isLoginWindowRequested &&
					<Firebase
						updateLoggedIn={this.updateLoggedIn}
					/>
				}

				{this.state.isLoggedIn && this.showCharacterCreation && !this.state.characterCreated &&
					<CharacterCreation
						saveCreatedCharacter={this.saveCreatedCharacter}
						objectPanelWidth={this.objectPanelWidth}
						objectPanelHeight={this.objectPanelHeight}
						screenData={this.state.screenData}
					/>
				}

				{this.state.isLoggedIn && this.state.gameSetupComplete &&
					<UI
						screenData={this.state.screenData}
						updateGameOptions={this.updateGameOptions}
						gameOptions={this.state.gameOptions}
						objectPanelWidth={this.objectPanelWidth}
						objectPanelHeight={this.objectPanelHeight}
						contextMenuWidth={this.contextMenuWidth}
						contextMenuHeight={this.contextMenuHeight}
						uiControlBarHeight={this.uiControlBarHeight}

						showDialog={this.state.showDialog}
						setShowDialogProps={this.setShowDialogProps}
						dialogProps={this.state.dialogProps}
						notEnoughSpaceDialogProps={this.notEnoughSpaceDialogProps}
						noMoreActionsDialogProps={this.noMoreActionsDialogProps}

						logText={this.state.logText}

						selectedCharacterInfo={this.state.playerCharacters[this.state.selectedCharacter]}
						selectedCreatureInfo={this.state.mapCreatures[this.state.selectedCreature]}
						characterIsSelected={this.state.characterIsSelected}
						creatureIsSelected={this.state.creatureIsSelected}
						updateUnitSelectionStatus={this.updateUnitSelectionStatus}
						updateCharacters={this.updateCharacters}
						getAllCharactersPos={this.getAllCharactersPos}
						playerInventoryLimit={this.playerInventoryLimit}

						setMapObjectSelected={this.setMapObjectSelected}
						objectSelected={this.state.objectSelected}
						objHasBeenDropped={this.state.objHasBeenDropped}
						setHasObjBeenDropped={this.setHasObjBeenDropped}
						addItemToPlayerInventory={this.addItemToPlayerInventory}
						toggleLightingHasChanged={this.toggleLightingHasChanged}

						updateMapObjects={this.updateMapObjects}
						mapObjects={this.state.mapObjects}

						actionButtonSelected={this.state.actionButtonSelected}
						toggleActionButton={this.toggleActionButton}
						reloadGun={this.reloadGun}
						refillLight={this.refillLight}
						handleContextMenuSelection={this.handleContextMenuSelection}
						contextMenu={this.state.contextMenu}
						toggleCenterOnPlayer={this.toggleCenterOnPlayer}

						currentLocation={this.state.currentLocation}
						updateCurrentTurn={this.updateCurrentTurn}
						activeCharacter={this.state.activeCharacter}
						playerCharacters={this.state.playerCharacters}
						actionsCompleted={{moves: this.state.activePlayerMovesCompleted, actions: this.state.activePlayerActionsCompleted}}
						playerLimits={{moves: this.playerMovesLimit, actions: this.playerActionsLimit}}
						threatList={this.state.threatList}
						inTacticalMode={this.state.inTacticalMode}
						toggleTacticalMode={this.toggleTacticalMode}
						isPartyNearby={this.state.partyIsNearby}
						modeInfo={{inTacticalMode: this.state.inTacticalMode, turn: this.state.currentTurn + 1}}
						updateActiveCharacter={this.updateActiveCharacter}
						updateFollowModePositions={this.updateFollowModePositions}
					/>
				}

				{this.state.isLoggedIn && this.state.gameSetupComplete &&
					<Map
						screenData={this.state.screenData}
						gameOptions={this.state.gameOptions}
						objectPanelWidth={this.objectPanelWidth}

						setShowDialogProps={this.setShowDialogProps}
						notEnoughSpaceDialogProps={this.notEnoughSpaceDialogProps}
						noMoreActionsDialogProps={this.noMoreActionsDialogProps}
						noMoreMovesDialogProps={this.noMoreMovesDialogProps}

						pcTypes={this.state.pcTypes}
						playerCharacters={this.state.playerCharacters}
						activeCharacter={this.state.activeCharacter}
						getAllCharactersPos={this.getAllCharactersPos}
						activePlayerMovesCompleted={this.state.activePlayerMovesCompleted}
						playerMovesLimit={this.playerMovesLimit}
						updateActivePlayerMoves={this.updateActivePlayerMoves}
						mapCreatures={this.state.mapCreatures}
						updateCharacters={this.updateCharacters}

						updateMapObjects={this.updateMapObjects}
						mapObjects={this.state.mapObjects}
						setHasObjBeenDropped={this.setHasObjBeenDropped}
						lightingHasChanged={this.state.lightingHasChanged}
						toggleLightingHasChanged={this.toggleLightingHasChanged}

						currentTurn={this.state.currentTurn}
						updateCurrentTurn={this.updateCurrentTurn}

						currentLocation={this.state.currentLocation}
						currentLevel={this.state.currentLevel}
						resetDataForNewLevel={this.resetDataForNewLevel}

						updateLog={this.updateLog}
						actionButtonSelected={this.state.actionButtonSelected}
						isContextMenuNeeded={this.isContextMenuNeeded}
						updateContextMenu={this.updateContextMenu}
						contextMenu={this.state.contextMenu}
						contextMenuChoice={this.state.contextMenuChoice}
						centerOnPlayer={this.state.centerOnPlayer}
						toggleCenterOnPlayer={this.toggleCenterOnPlayer}

						updateThreatList={this.updateThreatList}
						threatList={this.state.threatList}
						toggleTacticalMode={this.toggleTacticalMode}
						inTacticalMode={this.state.inTacticalMode}
						isPartyNearby={this.state.partyIsNearby}
						updateIfPartyIsNearby={this.updateIfPartyIsNearby}
						playerFollowOrder={this.state.playerFollowOrder}
						updateFollowModePositions={this.updateFollowModePositions}
						followModePositions={this.state.followModePositions}
					/>
				}

			</div>
		);
	}
}

export default Game;
