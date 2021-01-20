import { } from "googlemaps";
import { Config } from "./config";
import { Helpers } from "./helpers";
import { MapDisplayController } from "./mapDisplayController";

/**
 * Your learners display controller
 */
export class YourLearnersDisplayController extends MapDisplayController {
  private percentFilledTextId: string = '';
  private percentFilledText: HTMLElement | null = null;
  private giveAgainButtonId: string = '';
  private giveAgainButton: HTMLButtonElement | null = null;
  private congratsTextId: string = '';
  private congratsText: HTMLElement | null = null;

  private donationAmountTextId: string = '';
  private donationAmountText: HTMLElement | null = null;
  private donationDateTextId: string = '';
  private donationDateText: HTMLElement | null = null;
  private inCountryTextId: string = '';
  private inCountryText: HTMLElement | null = null;

  private donationsFilledValue: string = '';
  private donationsNotFilledValue: string = '';
  private donationsFilledCongratsValue: string = '';
  private donationsNotFilledCongratsValue: string = '';

  private onGiveAgainButtonClick: { (): void } = () => { };
  
  constructor(config: Config) {
    super(config);
    this.mapParentId = this.config.ylMapParentId;
    this.learnerCountId = this.config.ylCountElementId;
    this.dntCountId = this.config.ylDNTCountElementId;
    this.countrySelectId = this.config.ylCountrySelectId;
    this.resetMapButtonId = this.config.ylResetMapButtonId;
    this.panoramaId = this.config.ylPanoramaId;
    this.panoramaParentId = this.config.ylPanoramaParentId;
  }

  /**
   * Initialize the controls
   */
  public init(): void {
    this.percentFilledTextId = this.config.ylPercentFilledTextId;
    this.percentFilledText = this.percentFilledTextId === "" ? null : 
      Helpers.getElement(this.percentFilledTextId) as HTMLElement;
    this.giveAgainButtonId = this.config.ylGiveAgainButtonId;
    this.giveAgainButton = this.giveAgainButtonId === "" ? null : 
      Helpers.getElement(this.giveAgainButtonId) as HTMLButtonElement;
    this.congratsTextId = this.config.ylCongratsTextId;
    this.congratsText = this.congratsTextId === "" ? null : 
      Helpers.getElement(this.congratsTextId) as HTMLElement;

    this.donationAmountTextId = this.config.ylDonationAmountTextId;
    this.donationAmountText = this.donationAmountTextId === "" ? null :
      Helpers.getElement(this.donationAmountTextId) as HTMLElement;
    this.donationDateTextId = this.config.ylDonationDateTextId;
    this.donationDateText = this.donationDateTextId === "" ? null :
      Helpers.getElement(this.donationDateTextId) as HTMLElement;
    this.inCountryTextId = this.config.ylInCountryId;
    this.inCountryText = this.inCountryTextId === "" ? null :
      Helpers.getElement(this.inCountryTextId) as HTMLElement;

    this.donationsFilledValue = this.config.ylPercentFilledValue;
    this.donationsNotFilledValue = this.config.ylPercentNotFilledValue;
    this.donationsFilledCongratsValue = this.config.ylPercentFilledCongratsValue;
    this.donationsNotFilledCongratsValue = this.config.ylPercentNotFilledCongratsValue;
    this.panoramaCloseButtonId = this.config.ylPanoramaCloseButtonId;

    this.giveAgainButton?.addEventListener('click', () => {
      this.onGiveAgainButtonClick();
    });

    super.init();
  }

  /**
   * Set on give again button click listener
   * @param callback Callback
   */
  public SetOnGiveAgainButtonClickListener(callback: { (): void }): void {
    this.onGiveAgainButtonClick = callback;
  }

  /**
   * Override for updateUI
   */
  public updateUI(): void {
    super.updateUI();
    let aggregateDonationAmount: number = 0;
    let tempDonationStartDate: Date | null = null;
    let donationStartDate: string | undefined = undefined;
    let aggregateLearnerCount: number = 0;
    let aggregateDNTUserCount: number = 0;
    let allCountriesPercentFilled = [];
    let costPerLearner = 0;

    const campaignData: any = this.learnersData.campaignData;

    for (let i: number = 0; i < campaignData.length; i++) {
      let donation: any = campaignData[i].data;
      if (this.currentCountrySelection === this.allCountriesValue) {
        aggregateDonationAmount += typeof donation.amount === 'string' ?
          parseFloat(donation.amount) : donation.amount;
        if (tempDonationStartDate === null) {
          tempDonationStartDate = new Date(donation.startDate);
          donationStartDate = donation.startDate;
        } else if (tempDonationStartDate > new Date(donation.startDate)) {
          tempDonationStartDate = new Date(donation.startDate);
          donationStartDate = donation.startDate;
        }
        aggregateLearnerCount += donation.learnerCount;

        for (let c = 0; c < donation.countries.length; c++) {
          let country = donation.countries[c];
          if (country.country === 'no-country') {
            aggregateDNTUserCount += country.learnerCount;
          }
        }
        allCountriesPercentFilled.push(this.calculatePercentFilled(donation.amount,
            donation.learnerCount, donation.costPerLearner));
      } else if (this.currentCountrySelection === donation.country) {
        costPerLearner = donation.costPerLearner;
        aggregateDonationAmount += typeof donation.amount === 'string' ?
          parseFloat(donation.amount) : donation.amount;
        aggregateLearnerCount += donation.learnerCount;
        if (tempDonationStartDate === null) {
          tempDonationStartDate = new Date(donation.startDate);
          donationStartDate = donation.startDate;
        } else if (tempDonationStartDate > new Date(donation.startDate)) {
          tempDonationStartDate = new Date(donation.startDate);
          donationStartDate = donation.startDate;
        }

        const country = donation.countries.find((c: any) => {
          return c.country === this.currentCountrySelection;
        });

        const noRegion = country.regions.find((r: any) => {
          return r.region === 'no-region';
        });

        if (noRegion && noRegion.hasOwnProperty('learnerCount')) {
          aggregateDNTUserCount += noRegion.learnerCount;
        }
      }
    } 

    if (this.currentCountrySelection === this.allCountriesValue) {
      let allDonationsFilled = true;
  
      for (let i = 0; i < allCountriesPercentFilled.length; i++) {
        if (allCountriesPercentFilled[i] < 100) {
          allDonationsFilled = false;
        }
      }
  
      this.setDonationPercentage(allDonationsFilled ? 100 : 0);
      this.inCountryText!.innerText = ``;
    } else {
      this.setDonationPercentage(this.calculatePercentFilled(
        aggregateDonationAmount, aggregateLearnerCount, costPerLearner));
      this.inCountryText!.innerText = `in ${this.currentCountrySelection}`;
    }

    this.donationAmountText!.innerText = aggregateDonationAmount
      .toFixed(2);
    this.donationDateText!.innerText = donationStartDate!
      .toString();

    Helpers.createCountUpTextInElement(this.learnerCountElement!,
      aggregateLearnerCount);
    Helpers.createCountUpTextInElement(this.dntCountElement!,
      aggregateDNTUserCount);
  }

  /**
   * Donation percentage filled display logic
   * @param {Number} percentFilled Donation filled percentage
   */
  setDonationPercentage(percentFilled: number): void {
    this.percentFilledText!.innerHTML = percentFilled < 100 ? 
      this.donationsNotFilledValue : this.donationsFilledValue;
    this.giveAgainButton!.style.display = percentFilled < 100 ? 
      'none' : 'block';
    this.congratsText!.innerHTML = percentFilled < 100 ?
      this.donationsNotFilledCongratsValue : this.donationsFilledCongratsValue;
  }

  /**
   * Calculate donation percent filled
   * @param {Number} donationAmount Country donation
   * @param {Number} learnerCount Country learners
   * @param {Number} learnerCost Cost per learner
   * @return {Number} Percent filled
   */
  calculatePercentFilled(donationAmount: number, learnerCount: number, learnerCost: number): number {
    let learnerMax = Math.round(donationAmount / learnerCost);
    if (isNaN(learnerMax)) {
      learnerMax = 0;
    }
    let decimal = Math.round(learnerCount / learnerMax);
    if (isNaN(decimal)) {
      decimal = 0;
    }
    const percentFilled = decimal * 100;
    return percentFilled;
  }
}