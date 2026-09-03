import type { TrashStop } from '../types';

export const sampleStops: TrashStop[] = [
  { id: 's1', name: 'Main St & 1st', lat: 30.2672, lng: -97.7431 },
  { id: 's2', name: 'Congress & 6th', lat: 30.2695, lng: -97.7427 },
  { id: 's3', name: 'Red River & 7th', lat: 30.2715, lng: -97.7398 },
  { id: 's4', name: 'Guadalupe & 9th', lat: 30.2750, lng: -97.7440 },
  { id: 's5', name: 'Lamar & 11th', lat: 30.2775, lng: -97.7470 },
  { id: 's6', name: 'Barton Springs & Spring', lat: 30.2640, lng: -97.7490 },
  { id: 's7', name: 'South Lamar & Barton', lat: 30.2580, lng: -97.7680 },
  { id: 's8', name: 'South Congress & Alameda', lat: 30.2510, lng: -97.7480 },
];

export const defaultRouteOrder = sampleStops.map((s) => s.id);
