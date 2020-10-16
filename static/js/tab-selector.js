
/**
 * Class that contains logic for sections/tabs selection using buttons
 */
class TabSelector {
  /**
   * Constructs a TabSelector object that is used to toggle tabs using buttons
   * @param {String} hiddenTab is the class that hides the tab
   * @param {String} activeBtn is the class that activates the button visually
   * @param {String} btnParentID is the parent element ID for button elements
   * @param {String} tabParentID is the parent element ID for tabs/sections
   */
  constructor(hiddenTab, activeBtn, btnParentID, tabParentID) {
    this.hiddenTabClassName = hiddenTab;
    this.selectedTabButtonClassName = activeBtn;
    this.preToggleListeners = [];
    this.toggleListeners = [];
    this.preventDefaultAction = false;

    this.tabButtonsParentElement = document.getElementById(btnParentID);
    if (!this.tabButtonsParentElement) {
      console.log('Element with "tab-buttons" ID not found on the page.');
    }
    this.tabsParentElement = document.getElementById(tabParentID);
    if (!this.tabsParentElement) {
      console.log('Element with "tabs-parent" ID not found on the page.');
    }
  }

  /**
   * Prevents the default toggle action to execute as needed
   */
  preventDefault() {
    this.preventDefaultAction = true;
  }

  /**
   * Add event listener with give eventName and listener
   * @param {String} eventName is the name of the event ('preTabToggle' | 
   * 'tabToggle')
   * @param {Method} listener method that's getting called upon event occurence
   * ('preTabToggle' event passes DOM tab element ID |
   * 'tabToggle' event passes DOM tab element ID)
   */
  addEventListener(eventName, listener) {
    if (eventName === 'tabToggle') {
      this.toggleListeners.push(listener);
    } else if (eventName === 'preTabToggle') {
      this.preToggleListeners.push(listener);
    }
  }

  /**
   * Toggles the tab with given tabIndex & updates the button selection state
   * @param {String} tabID is the id of the button and the tab that should
   * be toggled
   */
  ToggleTab(tabID) {
    this.preventDefaultAction = false;
    if (this.tabButtonsParentElement && this.tabsParentElement) {
      const tabButtons = this.tabButtonsParentElement.children;
      const tabs = this.tabsParentElement.children;
      if (tabButtons.length !== tabs.length) {
        console.log('Number of tab buttons and tabs are not equal.');
        return;
      }
      let tabIndex = 0;
      for (let i = 0; i < tabs.length; i++) {
        if (tabs[i].id === tabID) {
          tabIndex = i;
          this.preToggleListeners.forEach((listener) => {
            listener(tabs[i].id);
          });
        }
      }

      if (!this.preventDefaultAction) {
        for (let i = 0; i < tabButtons.length; i++) {
          if (i === tabIndex) {
            tabButtons[i].classList.add(this.selectedTabButtonClassName);
            tabs[i].classList.remove(this.hiddenTabClassName);
            // Call listeners for tab toggle event with tab ID
            this.toggleListeners.forEach((listener) => {
              listener(tabs[i].id);
            });
          } else {
            tabButtons[i].classList.remove(this.selectedTabButtonClassName);
            tabs[i].classList.add(this.hiddenTabClassName);
          }
        }
      }
    }
  }
}

// eslint-disable-next-line no-unused-vars
let tabSelector = null;

$(document).ready(function() {
  tabSelector = new TabSelector(
      'is-hidden', 'is-dark', 'tab-buttons', 'tabs-parent');
});

