import React from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, child } from 'firebase/database';
// import { getAnalytics } from 'firebase/analytics';
import {
	getAuth,
	signInWithRedirect,
	getRedirectResult,
	signOut,
	sendSignInLinkToEmail,
	isSignInWithEmailLink,
	signInWithEmailLink,
	createUserWithEmailAndPassword,
	signInWithEmailAndPassword
} from "firebase/auth";
import { GoogleAuthProvider } from "firebase/auth";
import './css/ui.css';
import './css/login.css';

// For adding SDKs for Firebase services:
// https://firebase.google.com/docs/web/setup#available-libraries

export default class Firebase extends React.PureComponent {
	constructor(props) {
		super(props);

		// For Firebase JS SDK v7.20.0 and later, measurementId is optional
		const firebaseConfig = {
			apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
			authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
			databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
			projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
			storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
			messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
			appId: process.env.REACT_APP_FIREBASE_APP_ID,
			measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
		};

		// Initialize Firebase
		const app = initializeApp(firebaseConfig);
		// const analytics = getAnalytics(app);

		this.database = getDatabase(app);

		this.state = {
			showDialog: true,
			emailSent: false,
			createTabIsActive: true
		}
	}

	_updateLogin(userData) {
		this.setState({showDialog: false});
		this._getData(userData.uid, (gameData) => {
			this.props.updateLoggedIn(userData, gameData);
		});
	}

	addGoogleScript = () => {
		let scriptTag = document.createElement('script');
		scriptTag.setAttribute('src', 'https://accounts.google.com/gsi/client');
		scriptTag.setAttribute('async', 'true');
		scriptTag.setAttribute('defer', 'true');
		document.querySelector('#google-script').appendChild(scriptTag);
	}

	presentAuthDialog = () => {
		const toggleTabs = () => {
			this.setState(prevState => ({createTabIsActive: !prevState.createTabIsActive}));
		};

		const dialogContent = (
			<>
				<h2>Choose a method to login</h2>

				<div id='login-methods-container'>

					<div className='login-email-pw-container'>
						<div className='login-method-title'>Create an account</div>
						<div className={`create-tab email-pw-tab ${this.state.createTabIsActive ? 'active-tab' : ''}`} onClick={toggleTabs}>Create account</div>
						<div className={`login-tab email-pw-tab ${this.state.createTabIsActive ? '' : 'active-tab'}`} onClick={toggleTabs}>Login</div>
						<form
							className={`login-method active-tab-content ${this.state.createTabIsActive ? '' : 'hide'}`}
							onSubmit={(e) => {this.authByPassword(e, 'create');}}>
							<div className='login-account-entry-row'><label>Email:</label><input type='email' name='email'></input></div>
							<div className='login-account-entry-row'><label>Password:</label><input type='password' name='password'></input></div>
							<button className='login-button' type='submit'>Create account</button>
						</form>
						<form
							className={`login-method active-tab-content ${this.state.createTabIsActive ? 'hide' : ''}`}
							onSubmit={(e) => {this.authByPassword(e, 'login');}}>
							<div className='login-account-entry-row'><label>Email:</label><input type='email' name='email'></input></div>
							<div className='login-account-entry-row'><label>Password:</label><input type='password' name='password'></input></div>
							<button className='login-button' type='submit'>Login</button>
						</form>
					</div>

					<div className='login-email-only-container'>
						<div className='login-method-title'>Send a link via email</div>
						<form className='login-method' onSubmit={this.authByEmailLink}>
							<div className='login-account-entry-row'><label>Email:</label><input type='email' name='email'></input></div>
							<button className='login-button' type='submit'>Send me a login link!</button>
							<div className={this.state.emailSent ? '' : 'login-email-message-hidden'}>Email sent!</div>
						</form>
					</div>

					{/*<div className='login-google-container'>*/}
					{/*	<button onClick={this.authByGoogle}>Sign in with Google</button>*/}
					{/*	<span style={{fontSize:16}}>Not currently working</span>*/}
					{/*</div>*/}

					{/*<div id="g_id_onload"*/}
					{/*     data-client_id={process.env.REACT_APP_GOOGLE_CLIENT_ID}*/}
					{/*     data-login_url={process.env.REACT_APP_GOOGLE_LOGIN_ENDPOINT}*/}
					{/*     data-auto_prompt="false">*/}
					{/*</div>*/}
					{/*<div className="g_id_signin"*/}
					{/*     data-type="standard"*/}
					{/*     data-size="medium"*/}
					{/*     data-theme="outline"*/}
					{/*     data-text="sign_in_with"*/}
					{/*     data-shape="rectangular"*/}
					{/*     data-width="200"*/}
					{/*     data-logo_alignment="center">*/}
					{/*</div>*/}
				</div>
			</>
		);

		return (
			<DialogWindow
				classes='dialog-login'
				dialogContent={dialogContent} />
		);
	}

	// not currently in use
	// authByGoogle = () => {
	// 	const googleAuthProvider = new GoogleAuthProvider();
	// 	const auth = getAuth();
	//
	// 	signInWithRedirect(auth, googleAuthProvider).then(() => {
	// 		getRedirectResult(auth)
	// 			.then((result) => {
	// 				// This gives a Google Access Token. Can use it to access Google APIs.
	// 				const credential = GoogleAuthProvider.credentialFromResult(result);
	// 				const token = credential.accessToken;
	// 				// The signed-in user info.
	// 				const user = result.user;
	// 				// IdP data available using getAdditionalUserInfo(result)
	//
	// 				this._updateLogin(user);
	// 			}).catch((error) => {
	// 				// The email of the user's account used.
	// 				const email = error.customData.email;
	// 				// The AuthCredential type that was used.
	// 				const credential = GoogleAuthProvider.credentialFromError(error);
	//
	// 				console.log(error.code, error.message);
	// 		});
	// 	});
	// }

	authByEmailLink = (e) => {
		e.preventDefault();
		const email = e.target[0].value;
		const auth = getAuth();
		const actionCodeSettings = {
			// URL you want to redirect back to. The domain (www.example.com) for this
			// URL must be in the authorized domains list in the Firebase Console.
			url: 'https://lovecraft-oldones.firebaseapp.com', //'http://localhost:5002',
			// This must be true.
			handleCodeInApp: true,
			// iOS: {
			// 	bundleId: 'com.example.ios'
			// },
			// android: {
			// 	packageName: 'com.example.android',
			// 	installApp: true,
			// 	minimumVersion: '12'
			// },
			// dynamicLinkDomain: 'example.page.link'
		};

		sendSignInLinkToEmail(auth, email, actionCodeSettings)
			.then(() => {
				// The link was successfully sent. Inform the user.
				// Save the email locally so you don't need to ask the user for it again
				// if they open the link on the same device.
				window.localStorage.setItem('emailForSignIn', email);
				this.setState({emailSent: true});
			})
			.catch((error) => {
				console.log(error.code, error.message);
			});
	}

	_verifySignInWithEmailLink() {
		const auth = getAuth();
		if (isSignInWithEmailLink(auth, window.location.href)) {
			// Additional state parameters can also be passed via URL.
			// This can be used to continue the user's intended action before triggering
			// the sign-in operation.
			// Get the email if available. This should be available if the user completes
			// the flow on the same device where they started it.
			let email = window.localStorage.getItem('emailForSignIn');
			if (!email) {
				// User opened the link on a different device. To prevent session fixation
				// attacks, ask the user to provide the associated email again. For example:
				email = window.prompt('Please provide your email for confirmation');
			}
			// The client SDK will parse the code from the link for you.
			signInWithEmailLink(auth, email, window.location.href)
				.then((result) => {
					// Clear email from storage.
					window.localStorage.removeItem('emailForSignIn');
					// You can access the new user via result.user
					// Additional user info profile not available via:
					// result.additionalUserInfo.profile == null
					// You can check if the user is new or existing:
					// result.additionalUserInfo.isNewUser

					const user = result.user;
					this._updateLogin(user);
				})
				.catch((error) => {
					// Some error occurred, you can inspect the code: error.code
					// Common errors could be invalid email and invalid or expired OTPs.
					console.log(error.code, error.message);
				});
		}
	}

	authByPassword = (e, action) => {
		e.preventDefault();
		const email = e.target[0].value;
		const password = e.target[1].value;
		const auth = getAuth();
		const authAction = action === 'create' ? createUserWithEmailAndPassword : signInWithEmailAndPassword;
		authAction(auth, email, password)
			.then((userCredential) => {
				// Signed in
				const user = userCredential.user;
				this._updateLogin(user);
			})
			.catch((error) => {
				alert('Incorrect email or password. Please try again.');
				console.log(error.code, error.message);
			});
	}

	signOut(auth) {
		signOut(auth).then(() => {
			// Sign-out successful.
		}).catch((error) => {
			// An error happened.
			console.log(error);
		});
	}

	/**
	 * Save data to FB. Called by saveGameData in App.
	 * Callback is updateLog
	 * @param userId: string
	 * @param data: object
	 * @param callback: function
	 */
	setData = (userId, data, callback) => {
		set(ref(this.database, `users/${userId}/gameData`), {...data}).then(() => {
			callback('Game saved!');
		}).catch((error) => {
			console.error(error);
		});
	}

	/**
	 * Gets saved data from FB
	 * @param userId: string
	 * @param callback: function
	 */
	_getData(userId, callback) {
		const dbRef = ref(this.database);
		get(child(dbRef, `users/${userId}/gameData`)).then((snapshot) => {
			if (snapshot.exists()) {
				callback(snapshot.val());
			} else {
				console.log("No game save available");
				callback(null);
			}
		}).catch((error) => {
			console.error(error);
			callback(null);
		});
	}

	componentDidMount() {
		// this.addGoogleScript();
		this._verifySignInWithEmailLink();
	}

	render() {
		return (
			<>
				<div id='google-script'></div>
				{this.state.showDialog && <this.presentAuthDialog />}
			</>
		)
	}
}

function DialogWindow(props) {
	return (
		<div className={`dialog ui-panel ${props.classes}`}>
			<div className='dialog-message'>{props.dialogContent}</div>
		</div>
	);
}
