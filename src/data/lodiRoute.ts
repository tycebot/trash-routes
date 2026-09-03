import rawRoute from './lodiRoute.json';
import { parseRouteDocument } from '../domain/routeDocument';

export const LODI_SOURCE_URL = 'https://www.openstreetmap.org/copyright';
export const LODI_RETRIEVED_ON = '2026-09-03' as const;
export const LODI_ROUTE = parseRouteDocument(rawRoute);
