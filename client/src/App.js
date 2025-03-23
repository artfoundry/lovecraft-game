import React, {createRef} from 'react';
import Firebase from './Firebase';
import CharacterCreation from './CharacterCreation';
import Map from './Map';
import Character from './Character';
import Creature from './Creature';
import PlayerCharacterTypes from './data/playerCharacterTypes.json';
import CreatureTypes from './data/creatureTypes.json';
import WeaponTypes from './data/weaponTypes.json';
import ItemTypes from './data/itemTypes.json';
import UI from './UI';
import './css/app.css';
import {removeIdNumber, diceRoll, deepCopy, convertCoordsToPos, convertPosToCoords, articleType} from './Utils';
import {ProcessAudio, SoundEffect} from './Audio';


class Game extends React.PureComponent {
	constructor(props) {
		super(props);

		// for testing/prod settings
		this.gameAttr = this.props.gameAttributes;
		this.forProduction = this.gameAttr.forProduction;
		this.showLogin = this.gameAttr.showLogin;
		this.showCharacterCreation = this.gameAttr.showCharacterCreation;
		this.startingPlayerCharacters = !this.showCharacterCreation ? this.gameAttr.startingCharacters : null;
		this.startingLocation = this.gameAttr.startingLocation;
		this.spawnCreatures = this.gameAttr.spawnCreatures;

		this.maxPartyLevel = 10;
		this.pointsPerLevelUp = 2;
		this.initialDialogContent = '';
		this.playerMovesLimit = 3;
		this.playerActionsLimit = 2;
		this.playerInventoryLimit = 12;
		this.maxTurnsToReviveDeadPlayer = 3;
		this.chanceToSpawnCreature = 2; // spawns on this or lower on roll of d4
		this.minimalLightThreshold = 0.1;
		this.lowLightThreshold = 0.2;
		this.lightRanges = {
			'Torch': ItemTypes['Torch'].range,
			'Lantern': ItemTypes['Lantern'].range,
			'Electric Torch': ItemTypes['Electric Torch'].range
		};
		this.lightTimeCosts = {
			'move': 1,
			'mine': 45,
			'expertMining': 10,
			'create': 30,
			'search': 2
		};
		this.expertisePointLevels = {
			2: 100,
			3: 300,
			4: 600,
			5: 1000,
			6: 1500,
			7: 2100,
			8: 2800,
			9: 3600,
			10: 4500
		};
		// collection of audio fx DOM nodes by ID
		this.sfxSelectors = {
			environments: {
				catacombsDoor: null,
				catacombsBackground: null
			},
			characters: {
				elderThing: null,
				elderThingAttack: null,
				elderThingInjured: null,
				elderThingDeath: null,
				flyingPolyp: null,
				flyingPolypAttack: null,
				flyingPolypInjured: null,
				flyingPolypDeath: null,
				ghast: null,
				ghastAttack: null,
				ghastInjured: null,
				ghastDeath: null,
				ghoul: null,
				ghoulAttack: null,
				ghoulInjured: null,
				ghoulDeath: null,
				shoggoth: null,
				shoggothAttack: null,
				shoggothInjured: null,
				shoggothDeath: null,
				maleInjured: null,
				maleDeath: null,
				femaleInjured: null,
				femaleDeath: null
			},
			weapons: {
				handgunShot: null,
				glassVialBreak: null,
				meleeAttackBlade: null,
				meleeAttackBlunt: null,
				attackMiss: null
			},
			items: {
				gulp: null
			},
			skills: {
				mine: null
			},
			game: {
				dice: null
			}
		};

		// certain action types matched with their appropriate sfxSelector IDs
		// used because some categories of items (like all handguns) will use the same sound
		this.sfxActionSelectorAliases = {
			'handgun': 'handgunShot',
			'liquid': 'glassVialBreak',
			'blade': 'meleeAttackBlade',
			'blunt': 'meleeAttackBlunt',
			'attackMiss': 'attackMiss',
			'pharmaceuticals': 'gulp'
		};

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
			dialogContent: 'That character has no more actions this turn.',
			closeButtonText: 'Ok',
			closeButtonCallback: null,
			disableCloseButton: false,
			actionButtonVisible: false,
			actionButtonText: '',
			actionButtonCallback: null,
			dialogClasses: ''
		};
		this.noMoreMovesDialogProps = {
			dialogContent: 'That character has no more moves this turn.',
			closeButtonText: 'Ok',
			closeButtonCallback: null,
			disableCloseButton: false,
			actionButtonVisible: false,
			actionButtonText: '',
			actionButtonCallback: null,
			dialogClasses: ''
		};
		this.notEnoughLightDialogProps = {
			dialogContent: "That character needs to equip a light with enough time left in order to do that.",
			closeButtonText: 'Ok',
			closeButtonCallback: null,
			disableCloseButton: false,
			actionButtonVisible: false,
			actionButtonText: '',
			actionButtonCallback: null,
			dialogClasses: ''
		};
		this.invisibleTargetDialogProps = {
			dialogContent: "The air seems to shimmer there, as if something is there, but the investigator can neither see it nor move past it.",
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
				playMusic: this.gameAttr.playMusic,
				songName: '',
				screenZoom: 1.0,
				brightness: 1.0,
				spawnCreatures: this.gameAttr.spawnCreatures
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
			firebaseGameData: null,
			loadedFromFB: false,
			characterCreated: false,
			createdCharData: null,
			gameSetupComplete: false,
			playerCharacters: {},
			pcObjectOrdering: [], // order of pcs for determining control bar order
			pcTypes: PlayerCharacterTypes,
			partyLevel: 1,
			partyExpertise: 0,
			partyJournal: {
				activeQuests: [],
				completedQuests: []
			},
			savedMaps: {},
			needToSaveData: false,
			currentLocation: '',
			currentFloor: 1,
			previousFloor: null,
			playerFollowOrder: [], // order of pcs for follow mode
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
			sfxReverbProcessed: {},
			// these need resetting on floor change
			mapCreatures: {},
			mapObjects: {},
			envObjects: {},
			creatureSpawnInfo: null,
			unitsTurnOrder: [],
			currentTurn: 0,
			activeCharacter: !this.showCharacterCreation ? this.startingPlayerCharacters[0] : null,
			activePlayerMovesCompleted: 0,
			activePlayerActionsCompleted: 0,
			followModePositions: [], // list of tile positions used for moving pcs in order
			characterIsSelected: false,
			creatureIsSelected: false,
			selectedCharacter: '',
			selectedCreature: '',
			actionButtonSelected: null,
			skillModeActive: null,
			objectSelected: null,
			objHasBeenDropped: false,
			lightingHasChanged: false,
			inTacticalMode: true, // start in tactical mode any time entering a new area
			threatList: [],
			partyIsNearby: true,
			inSearchMode: false,
			contextMenuChoice: null,
			centerOnPlayer: false,
			centeredPlayer: '',
			logText: []
		}
	}

	/**
	 * Resets floor related data in state back to defaults when changing floors
	 * @param callback: function
	 */
	resetDataForNewFloor = (callback) => {
		this.toggleAudio('environments', this.state.currentLocation + 'Background');
		this.setState({
			mapCreatures: {},
			mapObjects: {},
			envObjects: {},
			creatureSpawnInfo: null,
			unitsTurnOrder: [],
			currentTurn: 0,
			activeCharacter: !this.showCharacterCreation ? this.startingPlayerCharacters[0] : null,
			activePlayerMovesCompleted: 0,
			activePlayerActionsCompleted: 0,
			followModePositions: [],
			characterIsSelected: false,
			creatureIsSelected: false,
			selectedCharacter: '',
			selectedCreature: '',
			actionButtonSelected: null,
			skillModeActive: null,
			objectSelected: null,
			objHasBeenDropped: false,
			lightingHasChanged: false,
			inTacticalMode: true, // start in tactical mode any time entering a new area
			threatList: [],
			partyIsNearby: true,
			inSearchMode: false,
			contextMenuChoice: null,
			centerOnPlayer: false,
			centeredPlayer: this.state.playerFollowOrder[0],
			logText: []
		}, () => {
			if (callback) callback();
		})
	}

	/**
	 *
	 * @param overwriteSavedData boolean (yes for restarting to create new char, no for reloading from saved game)
	 */
	resetAllData = (overwriteSavedData) => {
		this.toggleAudio('environments', this.state.currentLocation + 'Background');
		this.setState({
			firebaseGameData: overwriteSavedData ? null : this.state.firebaseGameData,
			loadedFromFB: false,
			characterCreated: false,
			createdCharData: null,
			gameSetupComplete: false,
			playerCharacters: {},
			pcObjectOrdering: [],
			pcTypes: PlayerCharacterTypes,
			partyLevel: 1,
			partyExpertise: 0,
			partyJournal: {
				quests: {}
			},
			savedMaps: {},
			needToSaveData: false,
			currentLocation: '',
			currentFloor: 1,
			previousFloor: null,
			playerFollowOrder: [],
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
			sfxReverbProcessed: {},
			// these need resetting on floor change
			mapCreatures: {},
			mapObjects: {},
			envObjects: {},
			creatureSpawnInfo: null,
			unitsTurnOrder: [],
			currentTurn: 0,
			activeCharacter: !this.showCharacterCreation ? this.startingPlayerCharacters[0] : null,
			activePlayerMovesCompleted: 0,
			activePlayerActionsCompleted: 0,
			followModePositions: [],
			characterIsSelected: false,
			creatureIsSelected: false,
			selectedCharacter: '',
			selectedCreature: '',
			actionButtonSelected: null,
			skillModeActive: null,
			objectSelected: null,
			objHasBeenDropped: false,
			lightingHasChanged: false,
			inTacticalMode: true,
			threatList: [],
			partyIsNearby: true,
			inSearchMode: false,
			contextMenuChoice: null,
			centerOnPlayer: false,
			centeredPlayer: '',
			logText: []
		}, () => {
			if (overwriteSavedData) {
				this._saveGameData(null, true);
			} else {
				this._restoreGameDataFromFB(this._setupGameState);
			}
		});
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
	 * @param userData: object (from Firebase)
	 * @param firebaseGameData: object (from Firebase, saved from previous play session)
	 */
	updateLoggedIn = (userData, firebaseGameData) => {
		const characterCreated = firebaseGameData && firebaseGameData.characterCreated;
		this.setState({
			isLoggedIn: true,
			userData,
			firebaseGameData: deepCopy(firebaseGameData),
			characterCreated
		}, () => {
			if (this.state.characterCreated) {
				this._restoreGameDataFromFB(this._setupGameState);
			}
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
	 * @param updateData: Object (always a deepCopy of entire data of one char or collection of all characters of type if updating multiple characters)
	 * @param id: String (char/creature Id) or null
	 * @param lightingHasChanged: boolean
	 * @param isInitialCreatureSetup: Boolean
	 * @param isInitialCharacterSetup: Boolean
	 * @param callback: Function
	 */
	updateCharacters = (type, updateData, id, lightingHasChanged, isInitialCreatureSetup = false, isInitialCharacterSetup = false, callback) => {
		const collection = type === 'player' ? 'playerCharacters' : 'mapCreatures';
		const currentChar = this.state[collection][id];
		const delayedAudio = (selector) => {
			setTimeout(() => {
				this.toggleAudio('characters', selector, {useReverb: true});
			}, 500);
		}
		if (id) {
			if (type === 'player' && updateData.currentSanity <= 0) {
				updateData.isDeadOrInsane = true;
			}
			if (type === 'player' && updateData.currentHealth > 0 && updateData.currentSanity > 0 &&
				(updateData.currentHealth < currentChar.currentHealth || updateData.currentSanity < currentChar.currentSanity))
			{
				currentChar.gender === 'Male' ? delayedAudio('maleInjured') : delayedAudio('femaleInjured');
			} else if (type === 'creature' && updateData.currentHealth > 0 && updateData.currentHealth < currentChar.currentHealth) {
				delayedAudio(removeIdNumber(id) + 'Injured');
			}
			if (type === 'player' && updateData.currentHealth <= 0 && currentChar.currentHealth > 0) {
				if (!this.state.inTacticalMode) {
					this.toggleTacticalMode(true);
				}
				currentChar.gender === 'Male' ? delayedAudio('maleDeath') : delayedAudio('femaleDeath');
				this.updateLog(`${currentChar.name}'s health has been reduced to 0, and ${currentChar.gender === 'Male' ? 'he' : 'she'} is now dying!`);
			} else if (type === 'creature' && updateData.currentHealth <= 0 && currentChar.currentHealth > 0) {
				delayedAudio(removeIdNumber(id) + 'Death');
			}
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
				const currentCharIsPc = this.state.playerCharacters[this.state.activeCharacter];
				const equippedRight = currentCharIsPc && currentCharIsPc.equippedItems.loadout1.right;
				const rightWeapon = equippedRight && WeaponTypes[equippedRight];
				const equippedLeft = currentCharIsPc && currentCharIsPc.equippedItems.loadout1.left;
				const leftWeapon = equippedLeft && WeaponTypes[equippedLeft];
				const goBallisticIsActive = this.state.actionButtonSelected && this.state.actionButtonSelected.stats.goBallistic;
				const sacrificialStrikeIsActive = this.state.actionButtonSelected && this.state.actionButtonSelected.stats.sacrificialStrike;
				if (lightingHasChanged) {
					this.toggleLightingHasChanged(callback);
				// check if either veteran, goBallistic button is active, and just unequipped gun or occultResearcher, sacrificialStrike button is active, and just unequipped kris knife
				} else if ((id === 'veteran' && goBallisticIsActive && ((!rightWeapon && !leftWeapon) || (!rightWeapon.gunType && !leftWeapon.gunType))) ||
					(id === 'occultResearcher' && sacrificialStrikeIsActive && (equippedRight !== 'krisKnife0' && equippedLeft !== 'krisKnife0')))
				{
					this.toggleActionButton('', '', '', '', callback);
				} else if (updateData.isDeadOrInsane) {
					this._removeDeadPCFromGame(id, callback);
				} else if (callback) callback();
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
	 * saves map data for moving to different floor or saving game, then calls saveGameData
	 * @param mapData: object (deepcopies of playerVisited, mapLayout,
	 *      and copies of previousAreaExitCoords, nextAreaExitCoords, worldWidth, worldHeight from Map)
	 * @param callback: function
	 */
	saveMapData = (mapData, callback) => {
		const {playerVisited, mapLayout, previousAreaExitCoords, nextAreaExitCoords, worldWidth, worldHeight, newFloorNum} = {...mapData};
		const savedMaps = deepCopy(this.state.savedMaps);
		const previousFloor = this.state.currentFloor;
		const currentFloor = newFloorNum || this.state.currentFloor;
		const floorKey = `floor-${this.state.currentFloor}`;
		const dataToSave = {
			playerVisited,
			mapLayout,
			previousAreaExitCoords,
			nextAreaExitCoords,
			worldWidth,
			worldHeight,
			mapObjects: deepCopy(this.state.mapObjects),
			mapCreatures: deepCopy(this.state.mapCreatures),
			envObjects: deepCopy(this.state.envObjects)
		};
		if (savedMaps[this.state.currentLocation]) {
			savedMaps[this.state.currentLocation][floorKey] = dataToSave;
		} else {
			savedMaps[this.state.currentLocation] = {[floorKey]: dataToSave};
		}

		this.setState({savedMaps, previousFloor, currentFloor}, () => {
			if (this.state.needToSaveData) {
				this.toggleNeedToSaveData(false);
			}
			if (this.forProduction) {
				this._saveGameData(callback);
			} else if (callback) callback();
		});
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
	 * Updates collection of envObjects in state during map init or if obj has been opened, found, triggered, destroyed
	 * Then, if obj is container, calls func to determine if creature should spawn, or
	 * if obj is mineable, reduces lighttime for party
	 * @param envObjects: object (modified copy of this.state.envObjects)
	 * @param envObjectId: string (optional - used when object is updated from player interacting with it and contents are to be given to pc)
	 * @param callback: function (currently only passed from _setInitialEnvObjectData in Map)
	 */
	updateMapEnvObjects = (envObjects, envObjectId = null, callback) => {
		this.setState({envObjects}, () => {
			if (envObjectId) {
				const activeEnvObj = envObjects[envObjectId];
				if (activeEnvObj.type === 'container') {
					this.determineIfShouldSpawnCreature(envObjectId);
				} else if (activeEnvObj.type === 'mineable') {
					const miningAction = this.state.objectSelected.miningAction;
					const buttonName = miningAction.substring(0,1).toUpperCase() + miningAction.substring(1, miningAction.length-1);
					this.toggleActionButton(this.state.activeCharacter, miningAction, buttonName, 'skill');
				}
			}
			if (callback) {
				callback();
			}
		});
	}

	/**
	 * Gets the positions for each LIVING character of a type: player, creature, or all
	 * @param type: String ('player', 'creature' or 'all')
	 * @param format: String ('pos' (string) or 'coords' (object))
	 * @returns Array (of Objects {id: coords})
	 */
	getAllCharactersPos = (type, format) => {
		const allCharactersPos = [];
		const collection =
			type === 'player' ? this.state.playerCharacters :
			type === 'creature' ? this.state.mapCreatures :
			{...this.state.playerCharacters, ...this.state.mapCreatures};

		for (const [id, characterData] of Object.entries(collection)) {
			const isLivingCreature = characterData.type === 'creature' && characterData.currentHealth > 0;
			const isLivingPc = characterData.type === 'player' && !characterData.isDeadOrInsane;
			if (isLivingCreature || isLivingPc) {
				let coords = format === 'pos' ? `${characterData.coords.xPos}-${characterData.coords.yPos}` : {...characterData.coords};
				allCharactersPos.push({id, [format]: coords});
			}
		}
		return allCharactersPos;
	}

	/**
	 * Called from UI when container is opened (possibly other sources too)
	 * Determines if creature should spawn and if so, what kind, then calls _updateCreatureSpawnInfo
	 * to set spawn info, which Map listens for to find spawn pos and finally call spawnCreature
	 * @param envObjectId: string
	 */
	determineIfShouldSpawnCreature = (envObjectId) => {
		// roll die to determine if and what creature to spawn
		if (diceRoll(4) <= this.chanceToSpawnCreature) {
			const spawnObj = this.state.envObjects[envObjectId];
			const spawnIndex = diceRoll(spawnObj.canSpawnCreature.length) - 1;
			const creatureIdToSpawn = spawnObj.canSpawnCreature[spawnIndex];
			this._updateCreatureSpawnInfo({envObjectId, creatureIdToSpawn, pos: convertCoordsToPos(spawnObj.coords)});
		}
	}

	/**
	 * Object passed in and stored contains envObj id that's spawning the creature and pos of that object
	 * @param creatureSpawnInfo: object ({envObjectId, creatureIdToSpawn, pos})
	 * @private
	 */
	_updateCreatureSpawnInfo(creatureSpawnInfo) {
		this.setState({creatureSpawnInfo});
	}

	/**
	 * Spawns a new creature on the map after Map finds an open pos near the spawning obj
	 * @param spawnPos: string
	 */
	spawnCreature = (spawnPos) => {
		if (!spawnPos) return; // if no free nearby tile found to spawn creature

		const newCreatureId = this.state.creatureSpawnInfo.creatureIdToSpawn;
		let creatureData = CreatureTypes[newCreatureId];
		let allCreatures = deepCopy(this.state.mapCreatures);
		let lightingHasChanged = false; // only need to use this if creature projects light
		let uniqueIdNumber = 0;
		let uniqueCreatureId = '';

		for (const id of Object.keys(allCreatures)) {
			if (id.includes(newCreatureId)) {
				const idValue = +id.match(/\d+/g)[0];
				if (idValue >= uniqueIdNumber) {
					uniqueIdNumber = idValue + 1;
				}
			}
		}
		uniqueCreatureId = newCreatureId + uniqueIdNumber;
		creatureData.creatureId = uniqueCreatureId;
		creatureData.coords = convertPosToCoords(spawnPos);
		allCreatures[uniqueCreatureId] = new Creature(creatureData);
		this.updateCharacters('creature', allCreatures, null, lightingHasChanged, false, false, () => {
			const unitInit = this._rollCharInitiative(allCreatures[uniqueCreatureId].initiative);
			// add unit to unitsTurnOrder
			const unitsTurnOrder = this._sortInitiatives(deepCopy(this.state.unitsTurnOrder), uniqueCreatureId, unitInit, 'mapCreatures');
			this.setState({unitsTurnOrder, creatureSpawnInfo: null}, () => {
				this.updateThreatList([uniqueCreatureId], [], () => {
					// call toggleLightingHasChanged if creature projects light
					// this.toggleLightingHasChanged(lightingHasChanged);
					this.updateLog(`As the lid is opened, ${articleType(creatureData.name)} ${creatureData.name} arises and attacks the party!`);
				});
			});
		});

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
				const resetCounters = () => this._resetCounters(callback);
				let updatedPlayerCharacters = null;
				let dataIsCopied = false;
				const playerCharacters = this.state.playerCharacters;
				for (const pcId of Object.keys(playerCharacters)) {
					if (Object.keys(playerCharacters[pcId].statuses).length > 0) {
						if (!dataIsCopied) {
							updatedPlayerCharacters = deepCopy(playerCharacters);
							dataIsCopied = true;
						}
						updatedPlayerCharacters[pcId].statuses = {};
					}
				}
				if (updatedPlayerCharacters) {
					this.updateCharacters('player', updatedPlayerCharacters, null, false, false, false, resetCounters);
				} else {
					resetCounters();
				}
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
			const thirdPcPos = allPcPositions[2] && allPcPositions[2].pos;
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
	 * then if there's 0 additions to the list and none before, calls toggleTacticalMode,
	 * and if list becomes empty, calls updateIfPartyIsNearby
	 * This is the primary entry point for changing/determining whether game is in Follow mode or Tactical mode
	 * @param threatIdsToAdd: Array (of strings - IDs of creatures attacking player - empty array if none)
	 * @param threatIdsToRemove: Array (of strings - IDs of creatures no longer a threat - empty array if none)
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
			if (isInCombat && previousListSize === 0) {
				this.updateLog('Something horrific has been spotted nearby!');
				if (this.state.inSearchMode) {
					this.toggleSearchMode();
					this.updateLog('Disabling search mode.');
				}
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
	 * toggles search mode on/off
	 */
	toggleSearchMode = () => {
		this.setState(prevState => ({inSearchMode: !prevState.inSearchMode}));
	}

	/**
	 * Updates to state what PC weapon, item, or skill button is selected in the UI
	 * Data stored in actionButtonSelected: {characterId, buttonId, buttonName, stats: WeaponTypes[buttonName], ItemTypes[buttonName], or SkillTypes[buttonName]}
	 * Doesn't set actionButtonSelected if action is immediate
	 * state.actionButtonSelected gets reset in handleUnitClick (in callback after action is done) and in this.updateCurrentTurn
	 * @param characterId: String
	 * @param buttonId: String (action button ID - ie. item, weapon, or skill ID)
	 * @param buttonName: String (action button name - ie. item, weapon, or skill name)
	 * @param buttonType: String ('weapon', 'item', or 'skill')
	 * @param callback: Function
	 * @param targetData: Array (of objects containing env obj info and id)
	 */
	toggleActionButton = (characterId, buttonId, buttonName, buttonType, callback, targetData = null) => {
		let buttonState = null;
		let isImmediateAction = false; // action takes effect without needing user to select a target
		let stats = null;
		let skillModeActive = this.state.skillModeActive;
		const characterData = this.state.playerCharacters[characterId];

		// if no weapon/item selected or weapon/item selected doesn't match new weapon/item selected, set weapon/item state to new weapon/item
		if (characterId && (!this.state.actionButtonSelected ||
			(this.state.actionButtonSelected.characterId !== characterId || this.state.actionButtonSelected.buttonId !== buttonId)))
		{
			if (buttonType === 'weapon') {
				stats = deepCopy(WeaponTypes[buttonName]); // copying so if modifying below, doesn't modify WeaponTypes
				if (this.state.actionButtonSelected) {
					if (this.state.actionButtonSelected.stats.name === 'Go Ballistic') {
						stats.goBallistic = characterData.skills.goBallistic;
					} else if (this.state.actionButtonSelected.stats.name === 'Sacrificial Strike') {
						stats.sacrificialStrike = characterData.skills.sacrificialStrike;
					}
				}
			} else if (buttonType === 'item') {
				stats = ItemTypes[buttonName];
				skillModeActive = null;
			// not weapon, not item, so skill being used
			} else {
				stats = characterData.skills[buttonId];
				isImmediateAction = !stats.hasTarget;
				if (buttonId === 'goBallistic' || buttonId === 'sacrificialStrike' || buttonId === 'disarmTrap') {
					skillModeActive = buttonId;
					if (buttonId === 'disarmTrap') {
						stats.targetData = targetData;
					}
				} else {
					skillModeActive = null;
				}
			}
			buttonState = {characterId, buttonId, buttonName, stats};
		}

		if (isImmediateAction) {
			// skillType will either be 'create' or 'active' (except heal and resuscitate skills are called from handleUnitClick)
			const props = stats.skillType === 'create' ? {
				itemType: buttonId,
				activeCharId: characterId,
				partyData: this.state.playerCharacters,
				updateCharacters: this.updateCharacters,
				updateLog: this.updateLog,
				setShowDialogProps: this.setShowDialogProps,
				notEnoughLightDialogProps: this.notEnoughLightDialogProps,
				addItemToPlayerInventory: this.addItemToPlayerInventory,
				updateActivePlayerActions: this.updateActivePlayerActions,
				calcPcLightChanges: this.calcPcLightChanges,
				lightTimeCosts: this.lightTimeCosts
			} : {
				currentPcData: characterData,
				partyData: this.state.playerCharacters,
				updateCharacters: this.updateCharacters,
				updateLog: this.updateLog,
				setShowDialogProps: this.setShowDialogProps,
				notEnoughLightDialogProps: this.notEnoughLightDialogProps,
				updateActivePlayerActions: this.updateActivePlayerActions,
				calcPcLightChanges: this.calcPcLightChanges,
				toggleAudio: this.toggleAudio,
				sfxSelectors: this.sfxActionSelectorAliases,
				// dummy isExpertMining, so when expertMining in Character calls mine, can pass this in, and calling mine from here doesn't cause error
				isExpertMining: null
			};
			const skillId = stats.skillType === 'create' ? 'create' : buttonId;
			characterData[skillId](props);
			if (callback) callback();
		} else {
			if (!buttonState) {
				skillModeActive = null;
			}
			this.setState({actionButtonSelected: buttonState, skillModeActive}, () => {
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
		const updatedPcData = deepCopy(this.state.playerCharacters[this.state.activeCharacter]);
		const gunInfo = updatedPcData.weapons[weaponId];
		const gunType = gunInfo.gunType;
		const availAmmo = updatedPcData.items[gunType + 'Ammo0'].amount;
		const emptyRounds = gunInfo.rounds - gunInfo.currentRounds;
		const resupplyAmmo = emptyRounds <= availAmmo ? emptyRounds : availAmmo;
		gunInfo.currentRounds += resupplyAmmo;
		updatedPcData.items[gunType + 'Ammo0'].amount = availAmmo - resupplyAmmo;
		if (updatedPcData.items[gunType + 'Ammo0'].amount === 0) {
			delete updatedPcData.items[gunType + 'Ammo0'];
			updatedPcData.inventory.splice(updatedPcData.inventory.indexOf(gunType + 'Ammo0'), 1, null);
		}
		if (isQuickReload) {
			updatedPcData.currentSpirit = this.reduceCharSpirit('quickReload');
		}
		this.updateCharacters('player', updatedPcData, this.state.activeCharacter, false, false, false, () => {
			if (!isQuickReload) {
				this.updateActivePlayerActions();
			}
		});
	}

	/**
	 * Helper used by refillLight and calcPcLightChanges to determine if lighting has changed
	 * Returns a categorized value based on active pc's equipped remaining light time
	 * @param equippedLight: object (light item equipped by active pc)
	 * @return {string} ('none' for no light left, 'low' for below min threshold, 'med' for below low threshold, 'high' otherwise)
	 * @private
	 */
	_getLightRangeLevel (equippedLight) {
		return equippedLight.time === 0 ? 'none' :
			equippedLight.time <= (equippedLight.maxTime * this.minimalLightThreshold) ? 'low' :
			equippedLight.time <= (equippedLight.maxTime * this.lowLightThreshold) ? 'med' : 'high';
	}

	/**
	 * Reloading active character's light using oil in inv we already know we have, as determined by CharacterControls in UIElements
	 */
	refillLight = () => {
		const activePcData = deepCopy(this.state.playerCharacters[this.state.activeCharacter]);
		const equippedLight = activePcData.items[activePcData.equippedLight];
		const oil = activePcData.items.oil0;
		const oilNeeded = equippedLight.maxTime - activePcData.lightTime;
		let lightingHasChanged = false;
		const currentLightRangeLevel = this._getLightRangeLevel(equippedLight);

		equippedLight.time = oil.amount < oilNeeded ? activePcData.lightTime + oil.amount : equippedLight.maxTime;
		activePcData.lightTime = equippedLight.time;
		const newLightRangeLevel = this._getLightRangeLevel(equippedLight);
		if (currentLightRangeLevel !== newLightRangeLevel) {
			equippedLight.range = this.lightRanges[equippedLight.name] - (newLightRangeLevel === 'high' ? 0 : newLightRangeLevel === 'med' ? 1 : 2);
			activePcData.lightRange = equippedLight.range;
			lightingHasChanged = true;
		}
		oil.amount -= oil.amount < oilNeeded ? oil.amount : oilNeeded;
		if (oil.amount <= 0) {
			delete activePcData.items.oil0;
			activePcData.inventory.splice(activePcData.inventory.indexOf('oil0'), 1, null);
		}
		this.updateCharacters('player', activePcData, this.state.activeCharacter, lightingHasChanged, false, false, () => {
			this.updateActivePlayerActions();
		});
	}

	/**
	 * charData obj is modified to reduce light time (from moving, using skills, etc.) and range if light's time gets low enough
	 * Whether or not light range has changed is returned to determine if lighting needs to be recalculated
	 * @param charId: string (pc ID)
	 * @param lightCost: integer (how much to reduce lightTime)
	 * @returns object: (equippedLight, lightTime, lightRange, lightingHasChanged)
	 */
	calcPcLightChanges = (charId, lightCost = this.lightTimeCosts.move) => {
		const charData = this.state.playerCharacters[charId];
		let equippedLightItem = {...charData.items[charData.equippedLight]}; // shouldn't be any nested data in light obj
		let lightTime = charData.lightTime;
		let lightRange = charData.lightRange;
		let lightingHasChanged = false;
		const timeSpent = lightCost > lightTime ? lightTime : lightCost;
		const currentLightRangeLevel = this._getLightRangeLevel(equippedLightItem);

		equippedLightItem.time -= timeSpent;
		lightTime -= timeSpent;
		const newLightRangeLevel = this._getLightRangeLevel(equippedLightItem);
		if (currentLightRangeLevel !== newLightRangeLevel) {
			lightRange = this.lightRanges[equippedLightItem.name] - (
				newLightRangeLevel === 'none' ? this.lightRanges[equippedLightItem.name] :
				newLightRangeLevel === 'low' ? 2 : 1);
			equippedLightItem.range = lightRange;
			lightingHasChanged = true;
			if (newLightRangeLevel === 'med') {
				this.updateLog(`${charData.name}'s light source is starting to get low.`);
			} else if (newLightRangeLevel === 'low') {
				this.updateLog(`${charData.name}'s light source is very low!`);
			} else if (newLightRangeLevel === 'none') {
				this.updateLog(`${charData.name}'s light source has gone out!`);
			}
		}
		return {equippedLightItem, lightTime, lightRange, lightingHasChanged};
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
	 * Increases party expertise count and level if count has crossed threshold
	 * @param points: number
	 */
	updateExpertise = (points) => {
		let partyExpertise = this.state.partyExpertise;
		let partyLevel = this.state.partyLevel;
		let partyHasLeveled = false;
		if (partyLevel < this.maxPartyLevel) {
			partyExpertise += points;
			if (partyExpertise >= this.expertisePointLevels[partyLevel + 1]) {
				partyLevel++;
				partyHasLeveled = true;
			}
		}
		this.setState({partyExpertise, partyLevel}, () => {
			if (partyHasLeveled) {
				const partyData = deepCopy(this.state.playerCharacters);
				for (const charData of Object.values(partyData)) {
					charData.levelUpPoints += this.pointsPerLevelUp;
				}
				this.updateCharacters('player', partyData, null, false, false, false);
			}
		});
	}

	/**
	 * Adds allotted points from user's leveling to appropriate pc and deducts available leveling points from that pc
	 * note: leveling points can be held indefinitely (no reason a player would do it, but they can)
	 * @param pcId: string
	 * @param allocationChoices: object (of objects: {stats: {name: points}, skills: {name: points}}, name being stat/skill name)
	 */
	assignLevelUpPoints = (pcId, allocationChoices) => {
		const pcData = deepCopy(this.state.playerCharacters[pcId]);

		for (const [skillsOrStats, skillOrStatNames] of Object.entries(allocationChoices)) {
			for (const [name, points] of Object.entries(skillOrStatNames)) {
				skillsOrStats === 'stats' ? pcData[name] += points : pcData.skills[name].level += points;
				pcData.levelUpPoints--;
			}
		}
		this.updateCharacters('player', pcData, pcId, false, false, false);
	}

	/**
	 * User click handler for clicking on units to determine if it's being selected or acted upon (ie. attacked, healed, etc.)
	 * @param id: string (target ID)
	 * @param target: string ('player' or 'creature')
	 * @param isInRange: boolean
	 * @param checkLineOfSightToParty: function (from Map)
	 */
	handleUnitClick = (id, target, isInRange, checkLineOfSightToParty) => {
		const targetData = target === 'creature' ? this.state.mapCreatures[id] : this.state.playerCharacters[id]
		if (targetData.statuses.invisible) {
			this.setShowDialogProps(true, this.invisibleTargetDialogProps);
		} else if (this.state.actionButtonSelected && isInRange) {
			// clicked unit is getting acted upon
			const selectedItemInfo = this.state.actionButtonSelected;
			const activePC = this.state.playerCharacters[this.state.activeCharacter];
			const actionProps = {
				actionId: selectedItemInfo.buttonId,
				actionStats: selectedItemInfo.stats,
				targetData,
				pcData: activePC,
				partyData: this.state.playerCharacters,
				updateCharacters: this.updateCharacters,
				updateLog: this.updateLog,
				setShowDialogProps: this.setShowDialogProps,
				notEnoughLightDialogProps: this.notEnoughLightDialogProps,
				calcPcLightChanges: this.calcPcLightChanges,
				toggleAudio: this.toggleAudio,
				sfxSelectors: this.sfxActionSelectorAliases,
				callback: () => {
					this.toggleActionButton('', '', '', '', () => {
						if (target === 'creature' && this.state.mapCreatures[id].currentHealth <= 0) {
							if (this.state.mapCreatures[id].isRemoved) {
								this.updateLog(`The ${this.state.mapCreatures[id].name} has been banished to another dimension!`);
							} else {
								this.updateLog(`The ${this.state.mapCreatures[id].name} is dead!`);
							}
							this.updateExpertise(this.state.mapCreatures[id].expertisePoints);
							this._removeDeadFromTurnOrder(id, this.updateActivePlayerActions, checkLineOfSightToParty);
						} else {
							if (target === 'object') {
								const updatedEnvObjects = deepCopy(this.state.envObjects);
								updatedEnvObjects[id].isDestroyed = true;
								this.updateMapEnvObjects(updatedEnvObjects);
							}
							this.updateActivePlayerActions();
						}
					});
				}
			};

			if (target === 'creature') {
				if (selectedItemInfo.stats.itemType && selectedItemInfo.stats.itemType === 'Relic') {
					activePC.useRelic(actionProps);
				} else {
					activePC.attack(actionProps);
				}
			} else if (selectedItemInfo.stats.name && selectedItemInfo.stats.name === 'Resuscitate') {
				activePC.resuscitate(actionProps);
			} else if (target === 'object') {
				activePC.disarmTrap(actionProps);
			} else {
				activePC.heal(actionProps);
			}
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
		const nextActiveCharId = Object.values(this.state.unitsTurnOrder[currentTurn])[0].id;
		const nextActiveCharIsPc = this.state.playerCharacters[nextActiveCharId];
		let nextActiveChar = nextActiveCharIsPc ? deepCopy(nextActiveCharIsPc) : deepCopy(this.state.mapCreatures[nextActiveCharId]);
		let updateOrRemoveChar = null;
		let activePlayerActionsCompleted = 0;
		let activePlayerMovesCompleted = 0;

		if (nextActiveCharIsPc && (nextActiveChar.currentHealth <= 0 || nextActiveChar.currentSanity <= 0 || nextActiveChar.statuses.unconscious)) {
			currentTurn++;
			if (nextActiveChar.currentHealth <= 0 && nextActiveChar.turnsSinceDeath < this.maxTurnsToReviveDeadPlayer) {
				nextActiveChar.turnsSinceDeath++;
				if (nextActiveChar.turnsSinceDeath < this.maxTurnsToReviveDeadPlayer) {
					updateOrRemoveChar = 'isDying';
				} else {
					updateOrRemoveChar = true;
					nextActiveChar.isDeadOrInsane = true;
				}
			}
		}
		if (Object.keys(nextActiveChar.statuses).length > 0) {
			const moveItSkill = this.state.playerCharacters.veteran ? this.state.playerCharacters.veteran.skills.moveIt : null;
			const playerMoveLimit = this.playerMovesLimit + (moveItSkill ? moveItSkill.modifier[moveItSkill.level] : 0);
			updateOrRemoveChar = true;
			for (const [statusName, statusData] of Object.entries(nextActiveChar.statuses)) {
				if (statusName === 'slowed') {
					activePlayerActionsCompleted = this.playerActionsLimit - 1;
					activePlayerMovesCompleted = playerMoveLimit - 1;
				}
				if (statusData.turnsLeft === 0) {
					delete nextActiveChar.statuses[statusName];
				} else {
					statusData.turnsLeft--;
				}
			}
		}
		this.setState({currentTurn, activePlayerActionsCompleted, activePlayerMovesCompleted}, () => {
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
				if (updateOrRemoveChar === 'isDying') {
					const numTurns = this.maxTurnsToReviveDeadPlayer - nextActiveChar.turnsSinceDeath;
					const turnsText = `${numTurns} ${numTurns > 1 ? 'turns' : 'turn'}`;
					this.updateLog(`${nextActiveChar.name} is dying and has ${turnsText} to be resuscitated!`);
				}
				this.updateCharacters(nextActiveCharIsPc ? 'player' : 'creature', nextActiveChar, nextActiveCharId, false, false, false, updateActiveChar);
			} else {
				updateActiveChar();
			}
		});
	}

	/**
	 * Callback for updateActivePlayerMoves and updateActivePlayerActions to update Spirit each time thief moves or acts
	 * Only used in Tactical Mode
	 */
	updateSpiritForStealthySkill = () => {
		const updatedCharData = deepCopy(this.state.playerCharacters.thief);
		updatedCharData.currentSpirit = this.reduceCharSpirit('stealthy');
		this.updateCharacters('player', updatedCharData, 'thief', false, false, false, null);
	}

	/**
	 * Increments and sets to state the number of moves made by the active PC
	 * @param takeActionCallback function (from moveRandomly in Map, which would have been called by randomizeTurn)
	 */
	updateActivePlayerMoves = (takeActionCallback = null) => {
		const activePlayerMovesCompleted = this.state.activePlayerMovesCompleted + 1;
		this.setState({activePlayerMovesCompleted}, () => {
			if (this.state.activeCharacter === 'thief' && this.state.playerCharacters.thief.statuses.stealthy) {
				this.updateSpiritForStealthySkill();
			}
			if (takeActionCallback) takeActionCallback();
		});
	}

	/**
	 * Increments and updates to state number of actions the active PC has done
	 * @param completeTwoActions boolean (optional, for skills that use two actions)
	 * @param takeActionCallback function (optional, from takeAutomaticAction, which would have been called by randomizeTurn in Map)
	 */
	updateActivePlayerActions = (completeTwoActions = false, takeActionCallback = null) => {
		if (this.state.inTacticalMode) {
			const activePlayerActionsCompleted = this.state.activePlayerActionsCompleted + (completeTwoActions ? 2 : 1);
			this.setState({activePlayerActionsCompleted}, () => {
				if (this.state.activeCharacter === 'thief' && this.state.playerCharacters.thief.statuses.stealthy) {
					this.updateSpiritForStealthySkill();
				}
				if (takeActionCallback) takeActionCallback();
			});
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
	 * @param actionType: string (possibilities: 'examine', 'creature', 'player', 'disarmTrap', null)
	 * @param tilePos: string
	 * @param evt: event object
	 * @param actionInfo: object (props for appropriate function called upon clicking menu button)
	 * @returns {{actionToProcess: function, menuNeeded: boolean}} (if menuNeeded, actionToProcess is null)
	 */
	isContextMenuNeeded = (actionType, tilePos = null, evt = null, actionInfo = null) => {
		let contextMenuNeeded = {menuNeeded: true, actionToProcess: null};
		const actionObjInfo = actionInfo && actionInfo.objectInfo && actionInfo.objectInfo[0];

		// if clicked obj is a creature/player, check if at least one object is on that tile
		let objectOnTile = null;
		if (actionType === 'creature' || actionType === 'player') {
			objectOnTile = this._isObjectOnTile(tilePos, evt);
		}

		// if player is trying to resuscitate
		const clickedTargetId = evt.currentTarget.id;
		const skillId = this.state.actionButtonSelected ? this.state.actionButtonSelected.buttonId : null;
		let otherCharacterOnTile = '';
		let dyingChar = '';
		for (const charData of Object.values(this.state.playerCharacters)) {
			if (charData.currentHealth <= 0 && convertCoordsToPos(charData.coords) === tilePos) {
				dyingChar = charData.name;
			}
		}
		if (skillId === 'resuscitate') {
			// check if other creature/player is on clicked tile to know whether it blocks the Resuscitate skill
			const allChars = {...this.state.playerCharacters, ...this.state.mapCreatures};
			if (allChars[clickedTargetId] && convertCoordsToPos(allChars[clickedTargetId].coords) === tilePos && allChars[clickedTargetId].name !== dyingChar) {
				otherCharacterOnTile = (allChars[clickedTargetId].type === 'player' ? '' : 'The ') + allChars[clickedTargetId].name;
			}
		}

		// bypass setting up context menu if clicked target is a pc or creature with nothing else on the tile and no action cued up...
		if (!objectOnTile && !this.state.actionButtonSelected && (actionType === 'player' || actionType === 'creature')) {
			contextMenuNeeded = {
				menuNeeded: false,
				actionToProcess: () => this.handleUnitClick(actionInfo.id, actionType)
			};
		// ...or if action is being used (regardless of whether object is also there)
		} else if (this.state.actionButtonSelected && (actionType === 'creature' || actionType === 'player' || actionType === 'disarmTrap')) {
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
			} else if (actionType === 'disarmTrap') {
				contextMenuNeeded = {
					menuNeeded: false,
					actionToProcess: () => this.handleUnitClick(actionObjInfo.id, 'object', true)
				};
			} else {
				contextMenuNeeded = {
					menuNeeded: false,
					actionToProcess: () => this.handleUnitClick(actionInfo.id, actionInfo.target, actionInfo.isInRange, actionInfo.checkLineOfSightToParty)
				};
			}
		// ...or if clicked target is a torch or non-trap env object
		} else if (actionType === 'examine' && (actionObjInfo.name === 'Torch' || (actionObjInfo.isEnvObject && actionObjInfo.type !== 'trap'))) {
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
		} else {
			const isContextMenuNeeded = contextMenuInfo || this.isContextMenuNeeded(actionType, tilePos, evt, actionInfo);

			// Don't need menu, so do action instead
			if (!isContextMenuNeeded.menuNeeded) {
				isContextMenuNeeded.actionToProcess();
			// otherwise, set up context menu
			} else {
				const contextMenu = {
					actionsAvailable: {[actionType]: actionInfo},
					creatureId: null,
					tilePos,
					evt
				};
				if (actionInfo && actionInfo.id) {
					contextMenu.creatureId = actionInfo.id;
				}
				if (actionType !== 'player' && actionType !== 'creature') {
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
		} else if (actionType === 'close-door') {
			this.setState({contextMenuChoice: {actionType, tilePos: this.state.contextMenu.tilePos}}, () => {
				this.setState({contextMenu: null});
			});
		}
	}

	/**
	 * Updates to state what character is active (PC or NPC)
	 * @param callback: function (optional - at start, sets flag that chars are placed, then for PCs moves map to center)
	 * @param id: String (optional)
	 * @param newFollowOrder: Array (of strings - pc IDs - sent from Mode Info Panel in UIElements)
	 * @param restoreFromFB: boolean (only true upon first loading game if fb data exists)
	 */
	updateActiveCharacter = (callback = null, id = null, newFollowOrder = null, restoreFromFB = false) => {
		const currentTurnUnitInfo = Object.values(this.state.unitsTurnOrder[this.state.currentTurn])[0];
		const activeCharacter = restoreFromFB ? this.state.firebaseGameData.activeCharacter : (id || currentTurnUnitInfo.id);
		let playerFollowOrder = newFollowOrder ? [...newFollowOrder] : [...this.state.playerFollowOrder];
		if (!this.state.inTacticalMode && !newFollowOrder) {
			let newLeader = playerFollowOrder.splice(playerFollowOrder.indexOf(id), 1)[0];
			playerFollowOrder.unshift(newLeader);
		}
		this.setState({activeCharacter, playerFollowOrder}, () => {
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
	 * @param miningInfo: object ({miningAction: (either 'mine' or 'expertMining')})
	 */
	setMapObjectSelected = (objectInfo, selectionEvt, isPickUpAction, miningInfo = null) => {
		const objectSelected = objectInfo ? {objectList: objectInfo, evt: selectionEvt, isPickUpAction, miningAction: miningInfo ? miningInfo.miningAction : null} : null;
		this.setState({objectSelected});
	}

	/**
	 * Called from UIElements when player drags object to item drop zone in pc inv panel
	 * @param props: {objHasBeenDropped (boolean), evt (event object)}
	 */
	setHasObjBeenDropped = (props) => {
		this.setState({objHasBeenDropped: {dropped: props.objHasBeenDropped, evt: props.evt}});
	}

	/**
	 * Set by UI/App when a light source has been equipped/unequipped/dropped to tell Map to recalculate lighting
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
	 * @param containerId: string (container env object id that item was taken from)
	 */
	addItemToPlayerInventory = (itemData, objId, recipientId, isPickUpAction, isCreateAction, containerId = null) => {
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
			if (invObjects[objId]) {
				const objGenericId = objId.match(/\D+/)[0];
				let highestIdNum = 0;
				for (const invObjId of Object.keys(invObjects)) {
					if (invObjId.includes(objGenericId)) {
						const idNum = +invObjId.match(/\d+/)[0];
						highestIdNum = idNum > highestIdNum ? idNum : highestIdNum;
					}
				}
				modifiedObjId = objGenericId + (highestIdNum + 1);
				itemData.id = modifiedObjId;
				invObjects[modifiedObjId] = {...itemData};
			} else {
				invObjects[objId] = {...itemData};
			}
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
				this._removeItemFromMap(objId, containerId);
			} else if (isCreateAction) {
				this.updateActivePlayerActions();
			}
		});
	}

	/**
	 * Removes all items (equipped and unequipped) from a pc and drops them on the same map tile where pc is
	 * Mainly used when pc dies/goes insane
	 * @param pcId: string
	 * @param callback: function
	 */
	dropAllItemsInPcInventory = (pcId, callback) => {
		const pcData = this.state.playerCharacters[pcId];
		let allInvItems = {...deepCopy(pcData.items), ...deepCopy(pcData.weapons)};
		let mapObjects = deepCopy(this.state.mapObjects);
		let lightingChanged = false;

		for (const [objId, objInfo] of Object.entries(allInvItems)) {
			const objGenericId = objId.match(/\D+/)[0];
			let highestIdNum = 0;
			for (const mapObjId of Object.keys(mapObjects)) {
				if (mapObjId.includes(objGenericId)) {
					const idNum = +mapObjId.match(/\d+/)[0];
					highestIdNum = idNum > highestIdNum ? idNum : highestIdNum;
				}
			}
			const newMapObjId = objGenericId + (highestIdNum + 1);
			mapObjects[newMapObjId] = {
				...objInfo,
				coords: pcData.coords
			}
			if (!lightingChanged && objInfo.itemType && objInfo.itemType === 'Light') {
				lightingChanged = true;
			}
		}
		this.updateMapObjects(mapObjects, lightingChanged, callback);
	}

	/**
	 * Call relevant pc function to carry out action for _randomizeTurn in Map
	 * @param actionName string/key (can be attack or heal)
	 * @param actionItem string (weapon/item id)
	 * @param target object (optional (used for attack or targeted skill) deepcopy of target char data obj, from playerCharacters or mapCreatures)
	 * @param checkLineOfSightToParty function (isInLineOfSight from Map)
	 * @param takeActionCallback function (passed from _randomizeTurn in Map to call takeAction again if necessary)
	 */
	takeAutomaticAction = (actionName, actionItem, target, checkLineOfSightToParty, takeActionCallback) => {
		const pcData = this.state.playerCharacters[this.state.activeCharacter];
		const targetId = target ? target.id : this.state.activeCharacter;
		const actionStats = actionName === 'attack' ? pcData.weapons[actionItem] : pcData.items[actionItem];
		const props = {
			actionId: actionItem,
			actionStats,
			targetData: target || pcData,
			pcData,
			partyData: this.state.playerCharacters,
			updateCharacters: this.updateCharacters,
			updateLog: this.updateLog,
			setShowDialogProps: this.setShowDialogProps,
			notEnoughLightDialogProps: this.notEnoughLightDialogProps,
			calcPcLightChanges: this.calcPcLightChanges,
			toggleAudio: this.toggleAudio,
			sfxSelectors: this.sfxActionSelectorAliases,
			callback: () => {
				const updateActionsAndTakeNextAction = () => {
					this.updateActivePlayerActions(false, takeActionCallback);
				};
				if (target && target.currentHealth <= 0) {
					if (target.type === 'player') {
						this.updateLog(`${pcData.name} has killed ${target.name}!`);
					} else {
						this.updateLog(`The ${target.name} is dead!`);
						this.updateExpertise(this.state.mapCreatures[targetId].expertisePoints);
					}
					this._removeDeadFromTurnOrder(targetId, updateActionsAndTakeNextAction, checkLineOfSightToParty);
				} else {
					updateActionsAndTakeNextAction();
				}
			}
		};
		const targetName = target ? (target.type === 'player' ? target.name : `a nearby ${target.name}`) : null;
		const logAction = actionName === 'attack' ? `attacks ${targetName}!` : `uses a ${pcData.items[actionItem].name}.`;
		this.updateLog(`${pcData.name} is confused and ${logAction}`);
		pcData[actionName](props);
	}

	toggleCenterOnPlayer = () => {
		this.setState(prevState => ({
			centerOnPlayer: !prevState.centerOnPlayer,
			centeredPlayer: this.state.activeCharacter
		}));
	}

	/**
	 * Plays sound effects, processing them for reverb, panning, valume, etc. if needed beforehand
	 * (reverb only processed once per sound file for a location)
	 * @param category: string (sfx category - 'environments', 'characters', 'weapons', 'items', 'skills', 'game')
	 * @param selectorName: string (sfx name - ex 'catacombsDoor', 'catacombsBackground', 'femaleDeath', etc.)
	 * @param processors; object (optional; params for ProcessAudio in Audio.js):
	 *  {
	 *      useVolume: true/false,
	 *      useReverb: true/false,
	 *      usePan: true/false
	 *      soundCoords: {xPos: x, yPos: y}
	 *  }
	 * )
	 */
	toggleAudio = (category, selectorName, processors) => {
		const sfxReverbProcessed = {...this.state.sfxReverbProcessed};
		const audioEl = this.sfxSelectors[category][selectorName].current;
		const isBackgroundSfx = category === 'environments' && selectorName.includes('Background');

		if (audioEl.paused && this.state.gameOptions.playFx) {
			let processValues = null;
			if (processors) {
				processValues = {};
				const sndCoords = processors.soundCoords;
				const activePcCoors = this.state.centeredPlayer ? this.state.playerCharacters[this.state.centeredPlayer].coords : null;
				if (processors.useVolume) {
					// calc number of tiles sound is away from active char using longest direction on grid (x or y)
					// then multiply distance by audio gain reducing fraction to arrive at value between 0 and 1
					const xDist = Math.abs(sndCoords.xPos - activePcCoors.xPos);
					const yDist = Math.abs(sndCoords.yPos - activePcCoors.yPos);
					const modifier = 0.06 * (xDist > yDist ? xDist : yDist);
					// toFixed fixes issues with floating point math resulting in long slightly inaccurate float values
					processValues.volumeSetting = +(1 - (modifier <= 1 ? modifier : 1)).toFixed(2);
				}
				if (processors.useReverb && !sfxReverbProcessed[selectorName]) {
					processValues.reverbSetting = this.state.currentLocation;
					sfxReverbProcessed[selectorName] = true;
				}
				if (processors.usePan) {
					processValues.panSetting = {x: sndCoords.xPos - activePcCoors.xPos, y: sndCoords.yPos - activePcCoors.yPos};
				}
			}
			ProcessAudio(selectorName, audioEl, processValues);
			audioEl.volume = this.state.gameOptions.fxVolume;

			if (isBackgroundSfx) {
				audioEl.loop = true;
			}
			audioEl.play().catch(e => console.log(e));

			if (sfxReverbProcessed[selectorName] !== this.state.sfxReverbProcessed[selectorName]) {
				this.setState({sfxReverbProcessed});
			}
		} else if (isBackgroundSfx && (!audioEl.paused || !this.state.gameOptions.playFx)) {
			audioEl.pause();
		}
	}

	updateGameOptions = (gameOptions) => {
		this.setState({gameOptions});
	}

	/**
	 * Sets flag so Map knows to call saveAllData (which then calls App.saveMapData)
	 * @param needToSaveData: boolean
	 */
	toggleNeedToSaveData = (needToSaveData) => {
		this.setState({needToSaveData});
	}

	endGame = () => {
		const dialogProps = {
			dialogContent: 'The main character has died or gone insane, so the game is over. You can create a new character or load from a saved game.',
			closeButtonText: 'Restart',
			closeButtonCallback: () => {
				const dialogProps = {
					dialogContent: 'Are you sure you want to delete your saved data and restart?',
					closeButtonText: 'Cancel',
					closeButtonCallback: this.endGame,
					disableCloseButton: false,
					actionButtonVisible: true,
					actionButtonText: 'Yes',
					actionButtonCallback: () => this.resetAllData(true),
					dialogClasses: ''
				};
				this.setShowDialogProps(true, dialogProps);
			},
			disableCloseButton: false,
			actionButtonVisible: true,
			actionButtonText: 'Reload From Save',
			actionButtonCallback: () => this.resetAllData(false),
			dialogClasses: ''
		}
		this.setShowDialogProps(true, dialogProps);
	}



	/*********************
	 * PRIVATE FUNCTIONS
	 *********************/


	_saveGameData(callback, isReset = false) {
		const userId = this.state.userData.uid;
		const dataToSave = {
			gameOptions: this.state.gameOptions, // object
			playerCharacters: this.state.playerCharacters, // object
			pcObjectOrdering: this.state.pcObjectOrdering, // array
			characterCreated: this.state.characterCreated, // boolean
			createdCharData: this.state.createdCharData, // object
			partyLevel: this.state.partyLevel, // number
			partyExpertise: this.state.partyExpertise, // number
			partyJournal: this.state.partyJournal, // object
			savedMaps: this.state.savedMaps, // object
			currentLocation: this.state.currentLocation, // string
			currentFloor: this.state.currentFloor, // number
			playerFollowOrder: this.state.playerFollowOrder, // array
			unitsTurnOrder: this.state.unitsTurnOrder, // array
			currentTurn: this.state.currentTurn, // number
			activeCharacter: this.state.activeCharacter, // string
			activePlayerMovesCompleted: this.state.activePlayerMovesCompleted, // number
			activePlayerActionsCompleted: this.state.activePlayerActionsCompleted, // number
			followModePositions: this.state.followModePositions, // array
			threatList: this.state.threatList // array
		};
		this.firebase.setData(userId, isReset ? null : deepCopy(dataToSave, true), (logMessage) => {
			if (!isReset) {
				this.updateLog(logMessage);
			}
			if (callback) callback();
		});
	}

	/**
	 * To restore only non-object (including arrays) values from retrieved firebase game data
	 * Skips activeCharacter, as that is restored in updateActiveCharacter
	 * @param callback: function
	 */
	_restoreGameDataFromFB = (callback) => {
		let dataToRestore = {};
		for (const [stateKey, stateValue] of Object.entries(this.state.firebaseGameData)) {
			// will set activeCharacter in _setupPlayerCharacters
			if (typeof stateValue !== 'object' && stateKey !== 'activeCharacter') {
				dataToRestore[stateKey] = stateValue;
			}
		}
		this.setState({...dataToRestore, loadedFromFB: true}, callback);
	}

	/**
	 * Initialization function. gameSetupComplete in callback indicates Map component can render
	 * Restores objects/arrays from firebase: gameOptions, createdCharData, partyJournal, savedMaps,
	 * playerFollowOrder, followModePositions, threatList
	 * playerCharacters object from firebase gets restored in _setupPlayerCharacters
	 * activeCharacter gets set in _setupPlayerCharacters but updated by updateActiveCharacter after placing creatures in Map if no FB data
	 * unitsTurnOrder array gets restored from fb (for both pcs and creatures) in _setAllUnitsTurnOrder after creatures are initialized in Map
	 * otherwise, unitsTurnOrder gets set in _setAllUnitsTurnOrder first for pcs after they're initialized in Map, then again for creatures after they're initialized
	 * @private
	 */
	_setupGameState() {
		this._setLocation(() => {
			this._setupPlayerCharacters(() => {
				const finishSetup = () => {
					this.setState({gameSetupComplete: true, centeredPlayer: this.state.playerFollowOrder[0]});
				};
				if (this.state.firebaseGameData) {
					const gameOptions = {...this.state.firebaseGameData.gameOptions};
					const createdCharData = this.state.createdCharData || {...this.state.firebaseGameData.createdCharData};
					const partyJournal = deepCopy(this.state.firebaseGameData.partyJournal);
					const savedMaps = deepCopy(this.state.firebaseGameData.savedMaps);
					const followModePositions = this.state.firebaseGameData.followModePositions ? [...this.state.firebaseGameData.followModePositions] : [];
					const threatList = this.state.firebaseGameData.threatList ? [...this.state.firebaseGameData.threatList] : [];
					this.setState({
						gameOptions,
						createdCharData,
						partyJournal,
						savedMaps,
						followModePositions,
						threatList
					}, finishSetup);
				} else {
					finishSetup();
				}
			});
		});
	}

	/**
	 * Saves starting player chars to state as part of initialization, then runs callback to set gameSetupComplete to true
	 * @param gameSetupCallback: function
	 * @private
	 */
	_setupPlayerCharacters(gameSetupCallback) {
		const firebaseDataLoaded = this.state.firebaseGameData;
		let playerCharacters = firebaseDataLoaded ? firebaseDataLoaded.playerCharacters : {};
		let playerFollowOrder = [];
		let pcObjectOrdering = [];
		let activeCharacter = this.state.activeCharacter;

		if (!firebaseDataLoaded || Object.keys(firebaseDataLoaded.playerCharacters).length === 0) {
			this.startingPlayerCharacters.forEach(characterId => {
				const props = {...PlayerCharacterTypes[characterId], playerInventoryLimit: this.playerInventoryLimit, lightTimeCosts: this.lightTimeCosts};
				playerCharacters[characterId] = new Character(props);
				playerFollowOrder.push(characterId);
				pcObjectOrdering.push(characterId);
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
			this.setState({playerCharacters, playerFollowOrder, pcObjectOrdering, activeCharacter}, gameSetupCallback);
		} else {
			const pcsCopy = deepCopy(playerCharacters);
			firebaseDataLoaded.pcObjectOrdering.forEach(characterId => {
				const props = {isSavedData: true, ...pcsCopy[characterId]};
				playerCharacters[characterId] = new Character(props);
			});
			this.setState({
				playerCharacters,
				activeCharacter: firebaseDataLoaded.activeCharacter,
				playerFollowOrder: [...firebaseDataLoaded.playerFollowOrder],
				pcObjectOrdering: [...firebaseDataLoaded.pcObjectOrdering]
			}, gameSetupCallback);
		}
	}

	/**
	 * Saves new game location to state. For game init, fires callback to set up playerCharacters.
	 * @param setupPlayersCallback: function
	 * @private
	 */
	_setLocation(setupPlayersCallback) {
		const gameOptions = {...this.state.gameOptions};
		gameOptions.songName = this.startingLocation;
		if (this.startingLocation) {
			this.setState({currentLocation: this.startingLocation, gameOptions}, () => {
				if (setupPlayersCallback) setupPlayersCallback();
			});
		} else {
			//todo: handle location change
		}
	}

	/**
	 * Sorts passed in char into turn order list of both player and non-player chars based on initiative value for taking turns
	 * value of unitsTurnOrder is passed in before setting to state by _setAllUnitsTurnOrder, so has to be passed in rather than accessing state
	 * @param unitsTurnOrder: Array (of objects)
	 * @param newUnitId: String
	 * @param newUnitInitiative: Integer
	 * @param unitType: String ('playerCharacters' or 'mapCreatures')
	 * @return updatedTurnOrder: Array
	 * @private
	 */
	_sortInitiatives (unitsTurnOrder, newUnitId, newUnitInitiative, unitType) {
		let updatedTurnOrder = unitsTurnOrder;
		if (updatedTurnOrder.length === 0) {
			updatedTurnOrder.push({[newUnitInitiative]: {id: newUnitId, unitType}});
		} else {
			let i = 0;
			let notSorted = true;
			while (notSorted) {
				const sortedUnitInitValue = Object.keys(updatedTurnOrder[i])[0];
				const sortedUnitOrderInfo = updatedTurnOrder[i][sortedUnitInitValue];
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
					updatedTurnOrder.splice(i, 0, {[newUnitInitiative]: {id: newUnitId, unitType}});
					notSorted = false;
				} else if (i === updatedTurnOrder.length - 1) {
					updatedTurnOrder.push({[newUnitInitiative]: {id: newUnitId, unitType}});
					notSorted = false;
				}
				i++;
			}
		}
		return updatedTurnOrder;
	}

	/**
	 * Rolls and returns turn order initiative based on character base initiative
	 * @param baseInit: number
	 * @returns {*}
	 * @private
	 */
	_rollCharInitiative(baseInit) {
		return baseInit + diceRoll(6);
	}

	/**
	 * Calculates initiative values for each PC and NPC in map as Map is setting up layout,
	 * then saves turn order array to state.
	 * Called from updateCharacters
	 * @param unitType: String ('playerCharacters' or 'mapCreatures')
	 * @param callback: function (at start, sets flag that chars are placed, then for PCs moves map to center)
	 * @private
	 */
	_setAllUnitsTurnOrder(unitType, callback) {
		let unitsTurnOrder = [];
		const fbGameData = this.state.firebaseGameData;

		if (fbGameData && fbGameData.unitsTurnOrder) {
			unitsTurnOrder = deepCopy(fbGameData.unitsTurnOrder);
		} else {
			unitsTurnOrder = deepCopy(this.state.unitsTurnOrder);
			for (const [id, charData] of Object.entries(this.state[unitType])) {
				const unitInitiative = this._rollCharInitiative(charData.initiative);
				unitsTurnOrder = this._sortInitiatives(unitsTurnOrder, id, unitInitiative, unitType);
			}
		}

		this.setState({unitsTurnOrder}, () => {
			if (!fbGameData && unitType === 'mapCreatures') {
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
		this.setState({activePlayerMovesCompleted: 0, activePlayerActionsCompleted: 0, currentTurn: 0}, () => {
			this.updateActiveCharacter(callback, this.state.playerFollowOrder[0]);
		});
	}

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
	 * remove PC (not creature) from gameplay that has lost all health or sanity
	 * then drop all items to map if not primary pc or end game if primary pc
	 * @param id: String
	 * @param callback: function
	 * @private
	 */
	_removeDeadPCFromGame(id, callback) {
		const deadPc = this.state.playerCharacters[id];
		if (deadPc) {
			if (deadPc.currentHealth <= 0) {
				this.updateLog(`${deadPc.name} has gone from mostly dead to all dead!`);
			} else if (deadPc.currentSanity <= 0) {
				this.updateLog(`The horrors are too much for ${deadPc.name}, and ${deadPc.gender === 'Male' ? 'he' : 'she'} has gone insane and become catatonic!`);
			}
			//check for this.state.createdCharData is active so game doesn't crash when char creation is turned off
			if (this.state.createdCharData && id === this.state.createdCharData.id) {
				this.endGame();
			} else {
				this.dropAllItemsInPcInventory(id, () => {
					this._removeDeadFromTurnOrder(id, callback);
				});
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
			// if creature died
			if (checkLineOfSightToParty) {
				this.updateThreatList([], [id], callback, checkLineOfSightToParty);
			// otherwise player died
			} else {
				let playerFollowOrder = [...this.state.playerFollowOrder];
				playerFollowOrder.splice(this.state.playerFollowOrder.indexOf(id), 1);
				let followModePositions = [...this.state.followModePositions];
				followModePositions.splice(this.state.followModePositions.indexOf(id), 1);
				this.setState({playerFollowOrder, followModePositions}, callback);
			}
		});
	}

	_removeItemFromMap(id, containerId) {
		if (containerId) {
			let updatedObjects = deepCopy(this.state.envObjects);
			const contents = updatedObjects[containerId].containerContents;
			const itemIndex = contents.find(item => item.id === id);
			contents.splice(itemIndex, 1);
			this.updateMapEnvObjects(updatedObjects);
		} else {
			const updatedObjects = deepCopy(this.state.mapObjects);
			const lightingHasChanged = updatedObjects[id].itemType && updatedObjects[id].itemType === 'Light';
			delete updatedObjects[id];
			this.updateMapObjects(updatedObjects, lightingHasChanged);
		}
	}

	/**
	 * Called by render() to set up array of sound effects elements
	 * @returns {*[]}
	 */
	setupSoundEffects = () => {
		let effects = [];

		for (const [category, names] of Object.entries(this.sfxSelectors)) {
			for (const name of Object.keys(names)) {
				this.sfxSelectors[category][name] = createRef();
				effects.push(<SoundEffect sfxRef={this.sfxSelectors[category][name]} key={'sfx' + name} id={'sfx' + name} sourceName={name} />);
			}
		}

		return effects;
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

			// just for testing (when skipping char creation)
			if (!this.forProduction) {
				this.setState({characterCreated: true}, () => {
					this._setupGameState();
				});
			}
		}

		if (!this.showLogin) {
			this.setState({isLoggedIn: true});
		}
	}

	componentDidUpdate(prevProps, prevState, snapShot) {
		if (prevState.gameOptions.playFx !== this.state.gameOptions.playFx) {
			this.toggleAudio('environments', this.state.currentLocation + 'Background');
		}
	}

	render() {
		const moveItSkill = this.state.playerCharacters[this.state.activeCharacter] ? this.state.playerCharacters[this.state.activeCharacter].skills.moveIt : null;
		const playerMoveLimit = this.playerMovesLimit + (moveItSkill ? moveItSkill.modifier[moveItSkill.level] : 0);
		return (
			<div className={`game ${this.state.showDialog ? 'no-click' : ''}`} style={{width: `${this.state.screenData.width}px`, height: `${this.state.screenData.height}px`}}>
				{!this.state.isLoggedIn &&
				<div className='title-screen'>
					<div className='title-screen-title-container'>
						<h1 className='font-fancy'>War of the Old Ones</h1>
						<div>(Pre-Alpha)</div>
					</div>
					<div className={`general-button ${this.state.isLoginWindowRequested ? 'hidden' : ''}`} onClick={() => {
						if (this.showLogin) {
							this.setState({isLoginWindowRequested: true});
						}
					}}>Login</div>
				</div>
				}

				{this.state.isLoggedIn && <this.setupSoundEffects /> }

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
						sfxSelectors={this.sfxSelectors}
					/>
				}

				{this.state.isLoggedIn && this.state.gameSetupComplete &&
					<UI
						// screen/ui data
						screenData={this.state.screenData}
						updateGameOptions={this.updateGameOptions}
						gameOptions={this.state.gameOptions}
						toggleNeedToSaveData={this.toggleNeedToSaveData}
						resetAllData={this.resetAllData}
						objectPanelWidth={this.objectPanelWidth}
						objectPanelHeight={this.objectPanelHeight}
						contextMenuWidth={this.contextMenuWidth}
						contextMenuHeight={this.contextMenuHeight}
						uiControlBarHeight={this.uiControlBarHeight}
						// dialogs
						showDialog={this.state.showDialog}
						setShowDialogProps={this.setShowDialogProps}
						dialogProps={this.state.dialogProps}
						notEnoughSpaceDialogProps={this.notEnoughSpaceDialogProps}
						noMoreActionsDialogProps={this.noMoreActionsDialogProps}
						// logging
						logText={this.state.logText}
						updateLog={this.updateLog}
						// character info
						selectedCharacterInfo={this.state.playerCharacters[this.state.selectedCharacter]}
						selectedCreatureInfo={this.state.mapCreatures[this.state.selectedCreature]}
						characterIsSelected={this.state.characterIsSelected}
						creatureIsSelected={this.state.creatureIsSelected}
						updateUnitSelectionStatus={this.updateUnitSelectionStatus}
						updateCharacters={this.updateCharacters}
						getAllCharactersPos={this.getAllCharactersPos}
						playerInventoryLimit={this.playerInventoryLimit}
						// object info
						setMapObjectSelected={this.setMapObjectSelected}
						objectSelected={this.state.objectSelected}
						objHasBeenDropped={this.state.objHasBeenDropped}
						setHasObjBeenDropped={this.setHasObjBeenDropped}
						addItemToPlayerInventory={this.addItemToPlayerInventory}
						toggleLightingHasChanged={this.toggleLightingHasChanged}
						determineIfShouldSpawnCreature={this.determineIfShouldSpawnCreature}
						// map object info
						updateMapObjects={this.updateMapObjects}
						mapObjects={this.state.mapObjects}
						updateMapEnvObjects={this.updateMapEnvObjects}
						envObjects={this.state.envObjects}
						// control bars
						actionButtonSelected={this.state.actionButtonSelected}
						skillModeActive={this.state.skillModeActive}
						toggleActionButton={this.toggleActionButton}
						reloadGun={this.reloadGun}
						refillLight={this.refillLight}
						lightTimeCosts={this.lightTimeCosts}
						notEnoughLightDialogProps={this.notEnoughLightDialogProps}
						activeCharacter={this.state.activeCharacter}
						playerCharacters={this.state.playerCharacters}
						actionsCompleted={{moves: this.state.activePlayerMovesCompleted, actions: this.state.activePlayerActionsCompleted}}
						playerLimits={{moves: playerMoveLimit, actions: this.playerActionsLimit}}
						// context menu
						handleContextMenuSelection={this.handleContextMenuSelection}
						contextMenu={this.state.contextMenu}
						toggleCenterOnPlayer={this.toggleCenterOnPlayer}
						// mode info panel
						updateCurrentTurn={this.updateCurrentTurn}
						updateActiveCharacter={this.updateActiveCharacter}
						threatList={this.state.threatList}
						inTacticalMode={this.state.inTacticalMode}
						toggleTacticalMode={this.toggleTacticalMode}
						isPartyNearby={this.state.partyIsNearby}
						modeInfo={{inTacticalMode: this.state.inTacticalMode, turn: this.state.currentTurn + 1}}
						playerFollowOrder={this.state.playerFollowOrder}
						updateFollowModePositions={this.updateFollowModePositions}
						pcObjectOrdering={this.state.pcObjectOrdering}
						inSearchMode={this.state.inSearchMode}
						toggleSearchMode={this.toggleSearchMode}
						// party status panel
						currentLocation={this.state.currentLocation}
						currentFloor={this.state.currentFloor}
						expertisePointLevels={this.expertisePointLevels}
						// party journal panel
						partyJournal={this.state.partyJournal}
						// pc leveling
						partyLevel={this.state.partyLevel}
						partyExpertise={this.state.partyExpertise}
						assignLevelUpPoints={this.assignLevelUpPoints}
					/>
				}

				{this.state.isLoggedIn && this.state.gameSetupComplete &&
					<Map
						// game/screen data
						screenData={this.state.screenData}
						gameOptions={this.state.gameOptions}
						objectPanelWidth={this.objectPanelWidth}
						needToSaveData={this.state.needToSaveData}
						loadedFromFB={this.state.loadedFromFB}
						// dialogs
						setShowDialogProps={this.setShowDialogProps}
						notEnoughSpaceDialogProps={this.notEnoughSpaceDialogProps}
						noMoreActionsDialogProps={this.noMoreActionsDialogProps}
						noMoreMovesDialogProps={this.noMoreMovesDialogProps}
						// character info
						pcTypes={this.state.pcTypes}
						playerCharacters={this.state.playerCharacters}
						activeCharacter={this.state.activeCharacter}
						getAllCharactersPos={this.getAllCharactersPos}
						actionsCompleted={{moves: this.state.activePlayerMovesCompleted, actions: this.state.activePlayerActionsCompleted}}
						playerLimits={{moves: playerMoveLimit, actions: this.playerActionsLimit}}
						updateActivePlayerMoves={this.updateActivePlayerMoves}
						mapCreatures={this.state.mapCreatures}
						updateCharacters={this.updateCharacters}
						calcPcLightChanges={this.calcPcLightChanges}
						lightTimeCosts={this.lightTimeCosts}
						takeAutomaticAction={this.takeAutomaticAction}
						// map object data
						saveMapData={this.saveMapData}
						savedMaps={this.state.savedMaps}
						updateMapObjects={this.updateMapObjects}
						updateMapEnvObjects={this.updateMapEnvObjects}
						mapObjects={this.state.mapObjects}
						envObjects={this.state.envObjects}
						setHasObjBeenDropped={this.setHasObjBeenDropped}
						lightingHasChanged={this.state.lightingHasChanged}
						toggleLightingHasChanged={this.toggleLightingHasChanged}
						creatureSpawnInfo={this.state.creatureSpawnInfo}
						spawnCreature={this.spawnCreature}
						// turn info
						currentTurn={this.state.currentTurn}
						updateCurrentTurn={this.updateCurrentTurn}
						// environment info
						currentLocation={this.state.currentLocation}
						currentFloor={this.state.currentFloor}
						previousFloor={this.state.previousFloor}
						resetDataForNewFloor={this.resetDataForNewFloor}
						// ui data/control
						updateLog={this.updateLog}
						logText={this.state.logText}
						actionButtonSelected={this.state.actionButtonSelected}
						isContextMenuNeeded={this.isContextMenuNeeded}
						updateContextMenu={this.updateContextMenu}
						contextMenu={this.state.contextMenu}
						contextMenuChoice={this.state.contextMenuChoice}
						centerOnPlayer={this.state.centerOnPlayer}
						toggleCenterOnPlayer={this.toggleCenterOnPlayer}
						toggleAudio={this.toggleAudio}
						// modes info
						updateThreatList={this.updateThreatList}
						threatList={this.state.threatList}
						toggleTacticalMode={this.toggleTacticalMode}
						inTacticalMode={this.state.inTacticalMode}
						partyIsNearby={this.state.partyIsNearby}
						updateIfPartyIsNearby={this.updateIfPartyIsNearby}
						playerFollowOrder={this.state.playerFollowOrder}
						updateFollowModePositions={this.updateFollowModePositions}
						followModePositions={this.state.followModePositions}
						inSearchMode={this.state.inSearchMode}
						skillModeActive={this.state.skillModeActive}
					/>
				}
			</div>
		);
	}
}

export default Game;
