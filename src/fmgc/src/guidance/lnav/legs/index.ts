// Copyright (c) 2021-2022 FlyByWire Simulations
// Copyright (c) 2021-2022 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { Leg } from '@fmgc/guidance/lnav/legs/Leg';
import { AltitudeDescriptor, ProcedureLeg, SpeedDescriptor } from 'msfs-navdata';

export enum AltitudeConstraintType {
    at,
    atOrAbove,
    atOrBelow,
    range,
}

export enum SpeedConstraintType {
    at,
    atOrAbove,
    atOrBelow,
}

export interface AltitudeConstraint {
    type: AltitudeConstraintType,
    altitude1: Feet,
    altitude2: Feet | undefined,
}

export interface SpeedConstraint {
    type: SpeedConstraintType,
    speed: Knots,
}

export abstract class FXLeg extends Leg {
    from: WayPoint;
}

export function getAltitudeConstraintFromWaypoint(wp: WayPoint): AltitudeConstraint | undefined {
    if (wp.legAltitudeDescription && wp.legAltitude1) {
        const ac: Partial<AltitudeConstraint> = {};
        ac.altitude1 = wp.legAltitude1;
        ac.altitude2 = undefined;
        switch (wp.legAltitudeDescription) {
        case 1:
            ac.type = AltitudeConstraintType.at;
            break;
        case 2:
            ac.type = AltitudeConstraintType.atOrAbove;
            break;
        case 3:
            ac.type = AltitudeConstraintType.atOrBelow;
            break;
        case 4:
            ac.type = AltitudeConstraintType.range;
            ac.altitude2 = wp.legAltitude2;
            break;
        default:
            break;
        }
        return ac as AltitudeConstraint;
    }
    return undefined;
}

export function altitudeConstraintFromProcedureLeg(procedureLeg: ProcedureLeg): AltitudeConstraint | undefined {
    if (procedureLeg.altitudeDescriptor !== undefined && procedureLeg.altitude1 !== undefined) {
        const ac: Partial<AltitudeConstraint> = {};

        ac.altitude1 = procedureLeg.altitude1;
        ac.altitude2 = undefined;

        switch (procedureLeg.altitudeDescriptor) {
        case AltitudeDescriptor.AtAlt1:
            ac.type = AltitudeConstraintType.at;
            break;
        case AltitudeDescriptor.AtOrAboveAlt1:
            ac.type = AltitudeConstraintType.atOrAbove;
            break;
        case AltitudeDescriptor.AtOrBelowAlt1:
            ac.type = AltitudeConstraintType.atOrBelow;
            break;
        case AltitudeDescriptor.BetweenAlt1Alt2:
            ac.type = AltitudeConstraintType.range;
            ac.altitude2 = procedureLeg.altitude2;
            break;
        default:
            break;
        }
        return ac as AltitudeConstraint;
    }

    return undefined;
}

export function getSpeedConstraintFromWaypoint(wp: WayPoint): SpeedConstraint | undefined {
    if (wp.speedConstraint) {
        const sc: Partial<SpeedConstraint> = {};
        sc.type = SpeedConstraintType.at;
        sc.speed = wp.speedConstraint;
        return sc as SpeedConstraint;
    }
    return undefined;
}

export function speedConstraintFromProcedureLeg(procedureLeg: ProcedureLeg): SpeedConstraint | undefined {
    if (procedureLeg.speedDescriptor !== undefined) {
        let type;
        if (procedureLeg.speedDescriptor === SpeedDescriptor.Minimum) {
            type = SpeedConstraintType.atOrAbove;
        } else if (procedureLeg.speedDescriptor === SpeedDescriptor.Mandatory) {
            type = SpeedConstraintType.at;
        } else if (procedureLeg.speedDescriptor === SpeedDescriptor.Maximum) {
            type = SpeedConstraintType.atOrBelow;
        }

        return { type, speed: procedureLeg.speed! };
    }

    return undefined;
}

export function waypointToLocation(wp: WayPoint): LatLongData {
    const loc: LatLongData = {
        lat: wp.infos.coordinates.lat,
        long: wp.infos.coordinates.long,
    };
    return loc;
}
