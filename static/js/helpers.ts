import { updateLanguageServiceSourceFile } from "typescript";
import { CountUp } from "countup.js";

/**
 * Module for helper functions
 */
export abstract class Helpers {
  
  public static getElement(tag: string): HTMLElement | HTMLCollectionOf<Element> | null {
    if (tag.startsWith('#')) {
      return document.getElementById(tag.substring(1));
    } else if (tag.startsWith('.')) {
      return document.getElementsByClassName(tag.substring(1));
    }
    return null;
  }

  public static queryURLParam(paramKey: string): string | null {
    const url: URL = new URL(window.location.href);
    return url.searchParams.get(paramKey);
  }

  public static createCountUpTextInElement(id: HTMLElement, countValue: number) {
    let counter = new CountUp(id, countValue, {
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
  
  public static isKeyCodeSpecial(keyCode: number): boolean {
    switch(keyCode) {
      case 9: case 13: case 18: case 20:
        return true;
      default:
        return false;
    }
  }

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


