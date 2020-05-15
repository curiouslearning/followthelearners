
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
   * Add event listener with give eventName and listener
   * @param {String} eventName is the name of the event ('tabToggle' |)
   * @param {Method} listener method that's getting called upon event occurence
   * ('tabToggle' event passes DOM tab element ID)
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
   * @param {Number} tabIndex is the index of the button and the tab that should
   * be toggled
   */
  ToggleTab(tabIndex) {
    if (this.tabButtonsParentElement && this.tabsParentElement) {
      const tabButtons = this.tabButtonsParentElement.children;
      const tabs = this.tabsParentElement.children;
      if (tabButtons.length !== tabs.length) {
        console.log('Number of tab buttons and tabs are not equal.');
        return;
      }
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

// eslint-disable-next-line no-unused-vars
let tabSelector = null;

$(document).ready(function() {
  tabSelector = new TabSelector(
      'is-hidden', 'is-dark', 'tab-buttons', 'tabs-parent');
});

