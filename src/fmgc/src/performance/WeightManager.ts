import { FmgcFlightPhase } from '@shared/flightphase';
import { FlightPhaseManager, FlightPlanManager } from '..';
import { PayloadManager } from './PayloadManager';

type Settable<T> = Computed<T> | Entered<T>
interface Computed<T> {
  readonly _tag: 'Computed'
  readonly value: T
}
interface Entered<T> {
  readonly _tag: 'Entered'
  readonly value: T
}
const computed = <T>(v: T): Settable<T> => ({ _tag: 'Computed', value: v });
const entered = <T>(v: T): Settable<T> => ({ _tag: 'Computed', value: v });
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const isComputed = <T>(v: Settable<T>): v is Computed<T> => v._tag === 'Computed';
const isEntered = <T>(v: Settable<T>): v is Entered<T> => v._tag === 'Entered';

const DEFAULT_TAXI_FUEL = 0.2;
const DEFAULT_ROUTE_FINAL_TIME = 45;

export class WeightManager {
    flightPlanManager: FlightPlanManager;

    flightPhaseManager: FlightPhaseManager;

    payloadManager: PayloadManager;

    /** @var tonnes */
    #zfw: number | null = null;

    #zfwcg: number | null = null;

    /** @var tonnes */
    #block: number | null = null;

    /** @var tonnes */
    #routeAltFuelWeight: number | null = null;

    /** @var minutes */
    routeAltFuelTime: number | null = null;

    /** @var tonnes */
    #taxiFuelWeight: Settable<number> = computed(DEFAULT_TAXI_FUEL);

    /** @var minutes */
    routeTripTime: number | null = null;

    /** @var tonnes */
    private routeTripFuelWeight: number | null = null;

    /** @var minutes */
    routeFinalFuelTime: number = 30;

    /** @var tonnes */
    #routeFinalFuelWeight: number | null = null;

    /** @var tonnes */
    #routeReservedWeight: number | null = null;

    #routeReservedPercent: number = 5;

    /** @var tonnes */
    minDestFob: number | null = null;

    /** @var tonnes */
    takeOffWeight: number | null = null;

    /** @var tonnes */
    landingWeight: number | null = null;

    constructor(flightPlanManager: FlightPlanManager, flightPhaseManager: FlightPhaseManager) {
        this.flightPlanManager = flightPlanManager;
        this.flightPhaseManager = flightPhaseManager;
        this.payloadManager = new PayloadManager();
        this.blockFuel = SimVar.GetSimVarValue('FUEL TOTAL QUANTITY', 'gallons') * SimVar.GetSimVarValue('FUEL WEIGHT PER GALLON', 'kg') / 1000;
        this.updateZfwVars();
    }

    public get zeroFuelWeight(): number {
        return this.#zfw;
    }

    public set zeroFuelWeight(zfw: number) {
        if (!this.isZFWInRange(zfw)) {
            console.error(`ZFW not in range: ${zfw}`);

            return;
        }

        this.#zfw = zfw;
    }

    public get zeroFuelWeightMassCenter(): number {
        return this.#zfwcg;
    }

    public set zeroFuelWeightMassCenter(zfwcg: number) {
        if (!this.isZFWCGInRange(zfwcg)) {
            console.error(`ZFWCG not in range: ${zfwcg}`);

            return;
        }

        this.#zfwcg = zfwcg;
    }

    public get blockFuel(): number {
        return this.#block;
    }

    public set blockFuel(block: number) {
        if (!this.isZFWInRange(block)) {
            console.error(`Block fuel not in range: ${block}`);

            return;
        }

        this.#block = block;
    }

    public get routeAltFuelWeight(): number {
        return this.#routeAltFuelWeight;
    }

    public set routeAltFuelWeight(routeAltFuelWeight: number) {
        if (!this.isAltFuelInRange(routeAltFuelWeight)) {
            console.error(`Alternate fuel not in range: ${routeAltFuelWeight}`);

            return;
        }

        this.#routeAltFuelWeight = routeAltFuelWeight;
    }

    public get taxiFuelWeight(): number {
        return this.#taxiFuelWeight.value;
    }

    public set taxiFuelWeight(v: number | null) {
        this.#taxiFuelWeight = v === null ? computed(DEFAULT_TAXI_FUEL) : entered(v);
    }

    get taxiEntered() {
        return isEntered(this.#taxiFuelWeight);
    }

    updateZfwVars() {
        const totalWeight = SimVar.GetSimVarValue('TOTAL WEIGHT', 'kg') / 1000;
        const blockFuel = SimVar.GetSimVarValue('FUEL TOTAL QUANTITY', 'gallons') * SimVar.GetSimVarValue('FUEL WEIGHT PER GALLON', 'kg') / 1000;
        this.zeroFuelWeight = totalWeight - blockFuel;
        this.zeroFuelWeightMassCenter = this.payloadManager.zfwcg;
    }

    /**
     * @param zfw Zero Fuel Weight in tonnes
     */
    isZFWInRange(zfw: number) {
        return zfw >= 35.0 && zfw <= 80.0;
    }

    isZFWCGInRange(zfwcg) {
        return zfwcg >= 8.0 && zfwcg <= 50.0;
    }

    isBlockFuelInRange(fuel) {
        return fuel >= 0 && fuel <= 80;
    }

    get fob() {
        return SimVar.GetSimVarValue('FUEL TOTAL QUANTITY WEIGHT', 'lbs') * 0.453592 / 1000;
    }

    get grossWeight() {
        return SimVar.GetSimVarValue('TOTAL WEIGHT', 'lbs') * 0.45359237 / 1000;
    }

    get cg() {
        return SimVar.GetSimVarValue('CG PERCENT', 'Percent over 100') * 100;
    }

    isMinDestFobInRange(fuel) {
        return fuel >= 0 && fuel <= 80.0;
    }

    isTaxiFuelInRange(taxi) {
        return taxi >= 0 && taxi <= 9.9;
    }

    isFinalFuelInRange(fuel) {
        return fuel >= 0 && fuel <= 100;
    }

    isFinalTimeInRange(time: number) {
        return time >= 0 && time <= 90;
    }

    isRteRsvFuelInRange(fuel) {
        return fuel >= 0 && fuel <= 10.0;
    }

    isRteRsvPercentInRange(value) {
        return value >= 0 && value <= 15.0;
    }

    /**
     *
     * @returns {number} Returns estimated fuel on board when arriving at the destination
     */
    getDestEFOB(useFOB = false) {
        return (useFOB ? this.fob : this.blockFuel) - this.routeTripFuelWeight - this.taxiFuelWeight;
    }

    /**
     * @returns {number} Returns EFOB when arriving at the alternate dest
     */
    getAltEFOB(useFOB = false) {
        return this.getDestEFOB(useFOB) - this.routeAltFuelWeight;
    }

    // only used by trySetRouteAlternateFuel
    isAltFuelInRange(fuel) {
        return fuel > 0 && fuel < (this.blockFuel - this.routeTripFuelWeight);
    }

    tryUpdateMinDestFob() {
        this.minDestFob = this.routeAltFuelWeight + this.routeFinalFuelWeight;
    }

    updateTowIfNeeded() {
        if (Number.isFinite(this.zeroFuelWeight) && Number.isFinite(this.blockFuel)) {
            this.takeOffWeight = this.zeroFuelWeight + this.blockFuel - this.taxiFuelWeight;
        }
    }

    tryUpdateLW() {
        this.landingWeight = this.takeOffWeight - this.routeTripFuelWeight;
    }

    /**
     * Computes extra fuel
     * @param {boolean}useFOB - States whether to use the FOB rather than block fuel when computing extra fuel
     * @returns {number}
     */
    tryGetExtraFuel(useFOB = false) {
        const isFlying = SimVar.GetSimVarValue('GROUND VELOCITY', 'knots') > 30;

        if (useFOB) {
            return this.fob - this.getTotalTripFuelCons() - this.minDestFob - this.taxiFuelWeight - (isFlying ? 0 : this.getRouteReservedWeight());
        }
        return this.blockFuel - this.getTotalTripFuelCons() - this.minDestFob - this.taxiFuelWeight - (isFlying ? 0 : this.getRouteReservedWeight());
    }

    /**
     * EXPERIMENTAL
     * Attempts to calculate the extra time
     */
    tryGetExtraTime(useFOB = false) {
        if (this.tryGetExtraFuel(useFOB) <= 0) {
            return 0;
        }
        const tempWeight = this.grossWeight - this.minDestFob;
        const tempFFCoefficient = A32NX_FuelPred.computeHoldingTrackFF(tempWeight, 180) / 30;
        return (this.tryGetExtraFuel(useFOB) * 1000) / tempFFCoefficient;
    }

    getTotalTripFuelCons() {
        return this.routeTripFuelWeight;
    }

    get routeReservedWeight() {
        if (!this.routeReservedEntered() && this.rteFinalCoeffecient !== 0) {
            const fivePercentWeight = this.#routeReservedPercent * this.routeTripFuelWeight / 100;
            const fiveMinuteHoldingWeight = (5 * this.rteFinalCoeffecient) / 1000;

            return fivePercentWeight > fiveMinuteHoldingWeight ? fivePercentWeight : fiveMinuteHoldingWeight;
        }
        if (Number.isFinite(this.#routeReservedWeight) && this.#routeReservedWeight !== 0) {
            return this.#routeReservedWeight;
        }
        return this.#routeReservedPercent * this.routeTripFuelWeight / 100;
    }

    /**
     * Updates the Fuel weight cell to tons. Uses a place holder FL120 for 30 min
     */
    tryUpdateRouteFinalFuel() {
        if (this.routeFinalFuelTime <= 0) {
            this.routeFinalFuelTime = DEFAULT_ROUTE_FINAL_TIME;
        }
        this.#routeFinalFuelWeight = A32NX_FuelPred.computeHoldingTrackFF(this.zeroFuelWeight, 120) / 1000;
        this.rteFinalCoeffecient = A32NX_FuelPred.computeHoldingTrackFF(this.zeroFuelWeight, 120) / 30;
    }

    /**
     * Updates the alternate fuel and time values using a place holder FL of 330 until that can be set
     */
    tryUpdateRouteAlternate() {
        if (this._DistanceToAlt < 20) {
            this.routeAltFuelWeight = 0;
            this.routeAltFuelTime = 0;
        } else {
            const placeholderFl = 120;
            let airDistance = 0;
            if (this._windDir === this._windDirections.TAILWIND) {
                airDistance = A32NX_FuelPred.computeAirDistance(Math.round(this._DistanceToAlt), this.averageWind);
            } else if (this._windDir === this._windDirections.HEADWIND) {
                airDistance = A32NX_FuelPred.computeAirDistance(Math.round(this._DistanceToAlt), -this.averageWind);
            }

            const deviation = (this.zeroFuelWeight + this.routeFinalFuelWeight - A32NX_FuelPred.refWeight)
                * A32NX_FuelPred.computeNumbers(airDistance, placeholderFl, A32NX_FuelPred.computations.CORRECTIONS, true);
            if ((airDistance > 20 && airDistance < 200) && (placeholderFl > 100 && placeholderFl < 290)) { // This will always be true until we can setup alternate routes
                this.routeAltFuelWeight = (A32NX_FuelPred.computeNumbers(airDistance, placeholderFl, A32NX_FuelPred.computations.FUEL, true) + deviation) / 1000;
                this.routeAltFuelTime = A32NX_FuelPred.computeNumbers(airDistance, placeholderFl, A32NX_FuelPred.computations.TIME, true);
            }
        }
    }

    /**
     * Attempts to calculate trip information. Is dynamic in that it will use liveDistanceTo the destination rather than a
     * static distance. Works down to 20NM airDistance and FL100 Up to 3100NM airDistance and FL390, anything out of those ranges and values
     * won't be updated.
     */
    tryUpdateRouteTrip(dynamic = false) {
        let airDistance = 0;
        const groundDistance = dynamic ? this.flightPlanManager.getDistanceToDestination(0) : this.flightPlanManager.getDestination().cumulativeDistanceInFP;
        if (this._windDir === this._windDirections.TAILWIND) {
            airDistance = A32NX_FuelPred.computeAirDistance(groundDistance, this.averageWind);
        } else if (this._windDir === this._windDirections.HEADWIND) {
            airDistance = A32NX_FuelPred.computeAirDistance(groundDistance, -this.averageWind);
        }

        let altToUse = this.cruiseFlightLevel;
        // Use the cruise level for calculations otherwise after cruise use descent altitude down to 10,000 feet.
        if (this.flightPhaseManager.phase >= FmgcFlightPhase.Descent) {
            altToUse = SimVar.GetSimVarValue('PLANE ALTITUDE', 'Feet') / 100;
        }

        if ((airDistance >= 20 && airDistance <= 3100) && (altToUse >= 100 && altToUse <= 390)) {
            const deviation = (
                this.zeroFuelWeight + this.routeFinalFuelWeight
                + this.routeAltFuelWeight - A32NX_FuelPred.refWeight
            ) * A32NX_FuelPred.computeNumbers(airDistance, altToUse, A32NX_FuelPred.computations.CORRECTIONS, false);

            this.routeTripFuelWeight = (A32NX_FuelPred.computeNumbers(airDistance, altToUse, A32NX_FuelPred.computations.FUEL, false) + deviation) / 1000;
            this.routeTripTime = A32NX_FuelPred.computeNumbers(airDistance, altToUse, A32NX_FuelPred.computations.TIME, false);
        }
    }

    get routeFinalFuelWeight() {
        if (Number.isFinite(this.#routeFinalFuelWeight)) {
            this.#routeFinalFuelWeight = (this.routeFinalFuelTime * this.rteFinalCoeffecient) / 1000;
        }

        return this.#routeFinalFuelWeight;
    }

    /**
     * Attempts to predict required block fuel for trip
     * @returns {boolean}
     */
    // TODO: maybe make this part of an update routine?
    tryFuelPlanning() {
        if (this.fuelPlanningPhase === this.fuelPlanningPhases.IN_PROGRESS) {
            this._blockFuelEntered = true;
            this.fuelPlanningPhase = this.fuelPlanningPhases.COMPLETED;
            return true;
        }
        const tempRouteFinalFuelTime = this.routeFinalFuelTime;
        this.tryUpdateRouteFinalFuel();
        this.tryUpdateRouteAlternate();
        this.tryUpdateRouteTrip();

        this.routeFinalFuelTime = tempRouteFinalFuelTime;
        this.#routeFinalFuelWeight = (this.routeFinalFuelTime * this.rteFinalCoeffecient) / 1000;

        this.tryUpdateMinDestFob();

        this.blockFuel = this.getTotalTripFuelCons() + this.minDestFob + this.taxiFuelWeight + this.getRouteReservedWeight();
        this.fuelPlanningPhase = this.fuelPlanningPhases.IN_PROGRESS;
        return true;
    }

    fuelPredConditionsMet() {
        return Number.isFinite(this.blockFuel)
            && Number.isFinite(this.zeroFuelWeightMassCenter)
            && Number.isFinite(this.zeroFuelWeight)
            && this.cruiseFlightLevel
            && this.flightPlanManager.getWaypointsCount() > 0
            && this.zeroFuelWeightZFWCGEntered
            && this._blockFuelEntered;
    }

    get routeReservedPercent() {
        if (Number.isFinite(this.#routeReservedWeight) && Number.isFinite(this.blockFuel) && this.#routeReservedWeight !== 0) {
            return this.routeReservedWeight / this.routeTripFuelWeight * 100;
        }
        return this.#routeReservedPercent;
    }

    /**
     * Tries to estimate the landing weight at destination
     * NaN on failure
     */
    tryEstimateLandingWeight() {
        const altActive = false;
        const landingWeight = this.zeroFuelWeight + (altActive ? this.getAltEFOB(true) : this.getDestEFOB(true));
        return Number.isFinite(landingWeight) ? landingWeight : NaN;
    }
}
