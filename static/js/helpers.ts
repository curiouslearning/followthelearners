import { updateLanguageServiceSourceFile } from "typescript";
import { CountUp } from "countup.js";

/**
 * Module for helper functions
 */
export abstract class Helpers {
  
  /**
   * Get an element(s) from DOM with either their id or class
   * @param tag A string that contains either an id of an element or a class starting
   * with '#' & '.' respectively
   */
  public static getElement(tag: string): HTMLElement | HTMLCollectionOf<Element> | null {
    if (tag.startsWith('#')) {
      return document.getElementById(tag.substring(1));
    } else if (tag.startsWith('.')) {
      return document.getElementsByClassName(tag.substring(1));
    }
    return null;
  }

  /**
   * Check if the current URL contains given parameter key value
   * @param paramKey Parameter key
   */
  public static queryURLParam(paramKey: string): string | null {
    const url: URL = new URL(window.location.href);
    return url.searchParams.get(paramKey);
  }

  /**
   * Create a count up animation using the CountUp package in a given element
   * @param element Element in which to create a count up text instance
   * @param countValue Max value that the count up can reach
   */
  public static createCountUpTextInElement(element: HTMLElement, countValue: number) {
    let counter = new CountUp(element, countValue, {
      useEasing: true,
      useGrouping: true,
      duration: 5,
    });
    if (!counter.error) {
      counter.start();
    } else {
      console.error(counter.error);
    }
  }
  
  /**
   * Check if a passed keycode is a special character
   * @param keyCode Keycode
   */
  public static isKeyCodeSpecial(keyCode: number): boolean {
    switch(keyCode) {
      case 9: case 13: case 18: case 20:
        return true;
      default:
        return false;
    }
  }


  /**
   * Check to see if the given email is valid
   * @param email Email
   */
  public static isValidEmail(email: string): boolean {
    if (email === null || email === undefined) return false;
    const result = email.match(/[[\w\d-\.]+\@]?[[\w\d-]*[\.]+[\w\d-\.]+]*/);
    if (result !== null && result !== undefined && result !== ['']) {
      return true;
    }
    return false;
  }

  /**
   * Get map marker icon options based on an aggregate count value
   * @param count Amount of aggregate value
   */
  public static getIconOptionsGeneral(count: number): {Url: string, size: google.maps.Size, anchor: google.maps.Point } {
    let iconOptions = {
    Url: '/static/imgs/1.png',
    size: new google.maps.Size(52, 52),
    anchor: new google.maps.Point(26, 26)};
    if (count > 10) {
      iconOptions.Url = '/static/imgs/2.png';
      iconOptions.size = new google.maps.Size(56, 55);
      iconOptions.anchor = new google.maps.Point(28, 28);
    }
    if (count > 100) {
      iconOptions.Url = '/static/imgs/3.png';
      iconOptions.size = new google.maps.Size(66, 65);
      iconOptions.anchor = new google.maps.Point(33, 33);
    }
    if (count > 1000) {
      iconOptions.Url = '/static/imgs/4.png';
      iconOptions.size = new google.maps.Size(78, 77);
      iconOptions.anchor = new google.maps.Point(39, 39);
    }
    if (count > 10000) {
      iconOptions.Url = '/static/imgs/5.png';
      iconOptions.size = new google.maps.Size(90, 89);
      iconOptions.anchor = new google.maps.Point(45, 45);
    }
    return iconOptions;
  }

  /**
   * Get map marker icon options based on an aggregate count value in grey style
   * @param count Amount of aggregate value
   */
  public static getIconOptionsGrey(count: number): {Url: string, size: google.maps.Size, anchor: google.maps.Point } {
    let iconOptions = {
    Url: '/static/imgs/1_grey.png',
    size: new google.maps.Size(52, 52),
    anchor: new google.maps.Point(26, 26)};
    if (count > 10) {
      iconOptions.Url = '/static/imgs/2_grey.png';
      iconOptions.size = new google.maps.Size(56, 55);
      iconOptions.anchor = new google.maps.Point(28, 28);
    }
    if (count > 100) {
      iconOptions.Url = '/static/imgs/3_grey.png';
      iconOptions.size = new google.maps.Size(66, 65);
      iconOptions.anchor = new google.maps.Point(33, 33);
    }
    if (count > 1000) {
      iconOptions.Url = '/static/imgs/4_grey.png';
      iconOptions.size = new google.maps.Size(78, 77);
      iconOptions.anchor = new google.maps.Point(39, 39);
    }
    if (count > 10000) {
      iconOptions.Url = '/static/imgs/5.png';
      iconOptions.size = new google.maps.Size(90, 89);
      iconOptions.anchor = new google.maps.Point(45, 45);
    }
    return iconOptions;
  }

  /**
   * Quivalent of JQuery $.get() with XMLHttpRequest
   * @param url URL
   * @param callback Callback that return data
   */
  public static async get(url: string, callback: (data: any | null) => void) {
    const xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = () => {
      if (xhttp.readyState === 4 && xhttp.status === 200) {
        callback(JSON.parse(xhttp.responseText));
      } else if (xhttp.status === 400) {
        callback(null);
      }
    };
    xhttp.open('GET', url, true);
    xhttp.send();
  }
}


