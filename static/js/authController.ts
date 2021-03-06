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

  private methodGoogleValue: string = '';
  private methodFacebookValue: string = '';
  private methodEmailLinkValue: string = '';
  private errorAccountExists: string = '';
  private errorPopupBlocked: string = '';
  private infoAuthGoogleConfirmText: string = '';
  private infoAuthFacebookConfirmText: string = '';
  private infoPopupBlockedText: string = '';
  private googleAccountLinkedText: string = '';
  private facebookAccountLinkedText: string = '';

  private infoEmailLinkGoogleText: string = '';
  private infoEmailLinkFacebookText: string = '';

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

    this.methodGoogleValue = this.config.authMethodGoogleValue;
    this.methodFacebookValue = this.config.authMethodFacebookValue;
    this.methodEmailLinkValue = this.config.authMethodEmailLinkValue;
    this.errorAccountExists = this.config.authErrorAccountExists;
    this.errorPopupBlocked = this.config.authErrorPopupBlocked;
    this.infoAuthGoogleConfirmText = this.config.authInfoAuthGoogleConfirmText;
    this.infoAuthFacebookConfirmText = this.config.authInfoAuthFacebookConfirmText;
    this.infoPopupBlockedText = this.config.authInfoPopupBlockedText;
    this.googleAccountLinkedText = this.config.authGoogleAccountLinkedText;
    this.facebookAccountLinkedText = this.config.authFacebookAccountLinkedText;

    this.infoEmailLinkGoogleText = this.config.authInfoEmailLinkGoogleText;
    this.infoEmailLinkFacebookText = this.config.authInfoEmailLinkFacebookText;
      
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
    const facebookAuth = new firebase.auth.FacebookAuthProvider();
    firebase.auth().signInWithPopup(googleAuth).then((userCred) => {
      this.email = userCred.user?.email!;
      this.currentDonorEmail = userCred.user?.email!;
    }).catch((error) => {
      if (error.code === this.errorAccountExists) {
        let pendingCredential = error.credential;
        let email = error.email;
        firebase.auth().fetchSignInMethodsForEmail(email).then((methods: any) => {
          if (methods.length > 0) {
            if (methods[0] === this.methodFacebookValue) {
              if (window.confirm(this.infoAuthGoogleConfirmText)) {
                
                firebase.auth().signInWithPopup(facebookAuth).then((result) => {
                  result.user!.linkWithCredential(pendingCredential).then((usercred) => {
                    window.alert(this.googleAccountLinkedText);
                  }).catch((reason) => {
                    console.log("Reason: ", reason);
                  });
                });
              } else {
                this.signInWithFacebook();
              }
            } else if (methods[0] === this.methodEmailLinkValue) {
              window.alert(this.infoEmailLinkGoogleText);
              window.localStorage.setItem('gcr', JSON.stringify(pendingCredential));
            }
          }
        });
      } else if (error.code === this.errorPopupBlocked) {
        window.alert(this.infoPopupBlockedText);
      }
    });
  }

  public signInWithFacebook(): void {
    const facebookAuth = new firebase.auth.FacebookAuthProvider();
    const googleAuth = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(facebookAuth).then((userCred) => {
      this.email = userCred.user?.email!;
      this.currentDonorEmail = userCred.user?.email!;
    }).catch((error) => {
      if (error.code === this.errorAccountExists) {
        let pendingCredential = error.credential;
        let email = error.email;

        firebase.auth().fetchSignInMethodsForEmail(email).then((methods: any) => {
          if (methods.length > 0) {
            if (methods[0] === this.methodGoogleValue) {
              if (window.confirm(this.infoAuthFacebookConfirmText)) {
                firebase.auth().signInWithPopup(googleAuth).then((result) => {
                  result.user!.linkWithCredential(pendingCredential).then((usercred) => {
                    window.alert(this.facebookAccountLinkedText);
                  }).catch((reason) => {
                    console.log('Reason: ', reason);
                  });
                });
              } else {
                this.signInWithGoogle();
              }
            } else if (methods[0] === this.methodEmailLinkValue) {
              window.alert(this.infoEmailLinkFacebookText);
              window.localStorage.setItem('fbcr', JSON.stringify(pendingCredential));
            }
          }
        });
      } else if (error.code === this.errorPopupBlocked) {
        window.alert(this.infoPopupBlockedText);
      }
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
          let googleCred = JSON.parse(window.localStorage.getItem('gcr')!);
          let fbCred = JSON.parse(window.localStorage.getItem('fbcr')!);
          if (googleCred) {
            let googleCredToken = firebase.auth.GoogleAuthProvider.credential(googleCred.oauthAccessToken);
            result.user!.linkWithCredential(googleCredToken).then((usercred) => {
                window.alert(this.googleAccountLinkedText);
                window.localStorage.removeItem('gcr');
              }).catch((reason) => {
                console.log('Reason: ', reason);
              });
          }
          if (fbCred) {
            let fbCredToken = firebase.auth.FacebookAuthProvider.credential(fbCred.oauthAccessToken);
            result.user!.linkWithCredential(fbCredToken).then((usercred) => {
                window.alert(this.facebookAccountLinkedText);
                window.localStorage.removeItem('fbcr');
              }).catch((reason) => {
                console.log('Reason: ', reason);
              });
          }
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
    window.localStorage.removeItem('emailForSignIn');
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
