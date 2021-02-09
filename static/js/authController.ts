import { Helpers } from "./helpers";
import { Config } from "./config";
import firebase from "firebase/app";
import "firebase/auth";

/**
 * Class that controls Authentication capabilities
 */
export class AuthController {
  private config: Config;

  private token: any;
  private uid: string = "";
  private email: string = "";
  private currentDonorEmail: string = "";
  private emailVerified: boolean = false;
  private lastRefreshDate: number | null = null;
  private tokenTimeout: number = 0;

  private isUserAuthenticated: boolean = false;

  private signInButtonTextId: string = "";
  private signInButtonTextElement: HTMLElement | null = null;

  private signInButtonAuthIconId: string = "";
  private signInButtonAuthIconElement: HTMLElement | null = null;
  private signInButtonSignedInTextValue: string = "";
  private signInButtonSignedOutTextValue: string = "";
  private signInButtonIconSignedInClass: string = "";
  private signInButtonIconSignedOutClass: string = "";

  public signInCallback: () => void;
  public signOutCallback: () => void;

  constructor(config: Config) {
    this.config = config;

    this.signInCallback = () => {};
    this.signOutCallback = () => {};

    this.tokenTimeout = this.config.tokenTimeout;

    this.signInButtonTextId = this.config.signInTextButtonTextId;
    this.signInButtonTextElement = this.signInButtonTextId === "" ? null :
      Helpers.getElement(this.signInButtonTextId) as HTMLElement;

    this.signInButtonAuthIconId = this.config.signInButtonIconId;
    this.signInButtonAuthIconElement = this.signInButtonAuthIconId === "" ? 
      null : Helpers.getElement(this.signInButtonAuthIconId) as HTMLElement;

    this.signInButtonSignedInTextValue = 
      this.config.signInButtonSignedInTextValue;
    this.signInButtonSignedOutTextValue = 
      this.config.signInButtonSignedOutTextValue;
    this.signInButtonIconSignedInClass = 
      this.config.signInButtonIconSignedInClass;
    this.signInButtonIconSignedOutClass =
      this.config.signInButtonIconSignedOutClass;
      
    const firebaseConfig = {
      apiKey: "AIzaSyDEl20cTMsc72W_TasuK5PlWYIgMrzyuAU",
      authDomain: "follow-the-learners.firebaseapp.com",
      databaseURL: "https://follow-the-learners.firebaseio.com",
      projectId: "follow-the-learners",
      storageBucket: "follow-the-learners.appspot.com",
      messagingSenderId: "52524997488",
      appId: "1:52524997488:web:cc42d966a6643432598db5",
      measurementId: "G-Y5QNCPJZ9D"
    };

    firebase.initializeApp(firebaseConfig);

    /**
     * Auth and set persistence
     */
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION)
      .then(() => {
        return true;
      }).catch((err: string) => {
        console.error(err);
      });
    firebase.auth().onAuthStateChanged((user: firebase.User | null) => {
      // console.log('auth state changed', user);
      if (user != null) {
        this.isUserAuthenticated = true;
        this.uid = user.uid;
        this.email = user.email as string;
        this.emailVerified = user.emailVerified;
        
        this.signInButtonTextElement!.innerHTML = 
          this.signInButtonSignedInTextValue;
        this.signInButtonAuthIconElement?.classList.remove(this.signInButtonIconSignedOutClass);
        this.signInButtonAuthIconElement?.classList.add(this.signInButtonIconSignedInClass);
        this.refreshToken();
      } else {
        this.signInButtonTextElement!.innerHTML = 
          this.signInButtonSignedOutTextValue;
        this.signInButtonAuthIconElement?.classList.remove(this.signInButtonIconSignedInClass);
        this.signInButtonAuthIconElement?.classList.add(this.signInButtonIconSignedOutClass);
        this.isUserAuthenticated = false;
        this.uid = '';
        this.email = '';
        this.token = undefined;
        this.emailVerified = false;
        this.currentDonorEmail = '';
        this.signOutCallback();
      }
    });
  }

  /**
   * Returns the current email or null if the user is not signed in
   */
  public getEmail(): string | null {
    return this.currentDonorEmail ? this.currentDonorEmail : null;
  }

  /**
   * Returns the current user token or null if the user is not signed in
   */
  public getToken(): string | null {
    return this.token ? this.token : null;
  }

  public signInWithGoogle(): void {
    const googleAuth = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(googleAuth).catch((error) => {
      console.log('Authentication was unsuccessful!');
    });
  }

  public signInWithFacebook(): void {
    const facebookAuth = new firebase.auth.FacebookAuthProvider();
    firebase.auth().signInWithPopup(facebookAuth).catch((error) => {
      console.log('Authentication was unsuccessful!');
    });
  }

  /**
   * Send a magic link to a user with the given email
   * @param email Email
   * @param callback Callback after successfully sending a magic link
   */
  public sendMagicLink(email: string, callback: { (): void }): void {
    const actionCodeSettings = {
      url: 'https://followthelearners.curiouslearning.org/',
      handleCodeInApp: true,
    };
    firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings)
      .then(function() {
        callback();
      }).catch((err) =>{
        console.error(err.code);
      });
  }

  /**
   * Sign in
   */
  public signIn(): void {
    if (firebase.auth().isSignInWithEmailLink(window.location.href)) {
      let email: string | null = window.localStorage.getItem('emailForSignIn');
      if (!email) {
        email = window.prompt('Please enter your email to finish the log in procedure.');
      }
      firebase.auth().signInWithEmailLink(email!, window.location.href)
        .then((result: firebase.auth.UserCredential) => {
          this.currentDonorEmail = email!;
          window.localStorage.removeItem('emailForSignIn');
          window.history.replaceState({}, document.title, '/');
          this.refreshToken();
        }).catch((err) => {
          window.localStorage.removeItem('emailForSignIn');
          window.history.replaceState({}, document.title, '/');
          console.error(err);
        });
    } else if (this.token) {
      this.refreshToken();
    }
  }

  /**
   * Initiate sign out
   */
  public signOut(): void {
    firebase.auth().signOut();
  }

  /**
   * Add event listener
   * @param event Event name 'signIn' | 'signOut'
   * @param callback Callback when such event happens
   */
  addEventListener(event: string, callback: () => void) {
    if (event === 'signIn') {
      this.signInCallback = callback;
    } else if (event === 'signOut') {
      this.signOutCallback = callback;
    }
  }

  /**
   * Refresh the token and call sign in callback if necessary
   */
  refreshToken(): void {
    // Check to see if we need to get a new token if the current one is timed out
    // or the is undefined to allow users to sign out and sign back in the same
    // session
    if (this.lastRefreshDate! <= (Date.now() - this.tokenTimeout) || this.token === undefined) {
      firebase.auth().currentUser?.getIdToken(true).then((newToken: string) => {
        this.token = newToken;
        this.lastRefreshDate = Date.now();
        this.signInCallback();
      }).catch((err) => {
        console.error(err);
      });
    } else if (this.token !== undefined) {
      this.signInCallback();
    }
  }

  /**
   * Check to see if the user is authenticated
   */
  isAuthenticated(): boolean {
    return this.token !== undefined;
  }

}