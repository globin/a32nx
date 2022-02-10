const PAX_STATIONS = {
    rows1_6: {
        name: 'ROWS [1-6]',
        seats: 36,
        weight: 3024,
        pax: 0,
        paxTarget: 0,
        stationIndex: 0 + 1,
        position: 21.98,
        seatsRange: [1, 36],
        simVar: 'A32NX_PAX_TOTAL_ROWS_1_6',
    },
    rows7_13: {
        name: 'ROWS [7-13]',
        seats: 42,
        weight: 3530,
        pax: 0,
        paxTarget: 0,
        stationIndex: 1 + 1,
        position: 2.86,
        seatsRange: [37, 78],
        simVar: 'A32NX_PAX_TOTAL_ROWS_7_13',
    },
    rows14_21: {
        name: 'ROWS [14-21]',
        seats: 48,
        weight: 4032,
        pax: 0,
        paxTarget: 0,
        stationIndex: 2 + 1,
        position: -15.34,
        seatsRange: [79, 126],
        simVar: 'A32NX_PAX_TOTAL_ROWS_14_21',
    },
    rows22_29: {
        name: 'ROWS [22-29]',
        seats: 48,
        weight: 4032,
        pax: 0,
        paxTarget: 0,
        stationIndex: 3 + 1,
        position: -32.81,
        seatsRange: [127, 174],
        simVar: 'A32NX_PAX_TOTAL_ROWS_22_29',
    },
};

const CARGO_STATIONS = {
    fwdBag: {
        name: 'FWD BAGGAGE/CONTAINER',
        weight: 3402,
        load: 0,
        stationIndex: 4 + 1,
        position: 18.28,
        visible: true,
        simVar: 'A32NX_CARGO_FWD_BAGGAGE_CONTAINER',
    },
    aftCont: {
        name: 'AFT CONTAINER',
        weight: 2426,
        load: 0,
        stationIndex: 5 + 1,
        position: -15.96,
        visible: true,
        simVar: 'A32NX_CARGO_AFT_CONTAINER',
    },
    aftBag: {
        name: 'AFT BAGGAGE',
        weight: 2110,
        load: 0,
        stationIndex: 6 + 1,
        position: -27.10,
        visible: true,
        simVar: 'A32NX_CARGO_AFT_BAGGAGE',
    },
    aftBulk: {
        name: 'AFT BULK/LOOSE',
        weight: 1497,
        load: 0,
        stationIndex: 7 + 1,
        position: -37.35,
        visible: true,
        simVar: 'A32NX_CARGO_AFT_BULK_LOOSE',
    },
};

// FIXME
// const MAX_SEAT_AVAILABLE = 174;
const PAX_WEIGHT = 84;
// const BAG_WEIGHT = 20;

export class PayloadManager {
    paxStations = PAX_STATIONS;

    cargoStations = CARGO_STATIONS;

    /**
     * Calculate %MAC ZWFCG of all stations
     */
    get zfwcg() {
        const currentPaxWeight = PAX_WEIGHT;

        const leMacZ = -5.386; // Accurate to 3 decimals, replaces debug weight values
        const macSize = 13.454; // Accurate to 3 decimals, replaces debug weight values

        const emptyWeight = SimVar.GetSimVarValue('EMPTY WEIGHT', 'kg');
        const emptyPosition = -8.75; // Value from flight_model.cfg
        const emptyMoment = emptyPosition * emptyWeight;

        const paxTotalMass = Object.values(this.paxStations).map(
            (station) => (SimVar.GetSimVarValue(`L:${station.simVar}`, 'Number') * currentPaxWeight),
        ).reduce((acc, cur) => acc + cur, 0);
        const paxTotalMoment = Object.values(this.paxStations).map(
            (station) => (SimVar.GetSimVarValue(`L:${station.simVar}`, 'Number') * currentPaxWeight) * station.position,
        ).reduce((acc, cur) => acc + cur, 0);

        const cargoTotalMass = Object.values(this.cargoStations).map(
            (station) => SimVar.GetSimVarValue(`PAYLOAD STATION WEIGHT:${station.stationIndex}`, 'Number'),
        ).reduce((acc, cur) => acc + cur, 0);
        const cargoTotalMoment = Object.values(this.cargoStations).map(
            (station) => (SimVar.GetSimVarValue(`PAYLOAD STATION WEIGHT:${station.stationIndex}`, 'Number') * station.position),
        ).reduce((acc, cur) => acc + cur, 0);

        const totalMass = emptyWeight + paxTotalMass + cargoTotalMass;
        const totalMoment = emptyMoment + paxTotalMoment + cargoTotalMoment;

        const cgPosition = totalMoment / totalMass;
        const cgPositionToLemac = cgPosition - leMacZ;
        const cgPercentMac = -100 * (cgPositionToLemac / macSize);

        return cgPercentMac;
    }

    get totalCargo() {
        const cargoTotalMass = Object.values(this.cargoStations).filter(
            (station) => station.visible,
        ).map(
            (station) => SimVar.GetSimVarValue(`PAYLOAD STATION WEIGHT:${station.stationIndex}`, 'Number'),
        ).reduce((acc, cur) => acc + cur, 0);

        return cargoTotalMass;
    }

    get totalPayload() {
        const currentPaxWeight = PAX_WEIGHT;

        const paxTotalMass = Object.values(this.paxStations).map((station) => (SimVar.GetSimVarValue(`L:${station.simVar}`, 'Number') * currentPaxWeight)).reduce((acc, cur) => acc + cur, 0);
        const cargoTotalMass = this.totalCargo;

        return paxTotalMass + cargoTotalMass;
    }

    get zfw() {
        const emptyWeight = SimVar.GetSimVarValue('EMPTY WEIGHT', 'kg');
        return emptyWeight + this.totalPayload;
    }
}
